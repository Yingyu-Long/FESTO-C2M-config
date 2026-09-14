import net from "node:net";

export class ModbusError extends Error {
  constructor(message, code = "MODBUS_ERROR") {
    super(message);
    this.code = code;
  }
}

// One transaction per socket: the device service serializes complete operations.
export class ModbusClient {
  constructor({ timeout = 2000 } = {}) {
    this.timeout = timeout;
    this.sequence = 0;
  }
  async connect({ host, port, unit }) {
    this.close();
    this.unit = unit;
    this.buffer = Buffer.alloc(0);
    const socket = new net.Socket();
    this.socket = socket;
    socket.setNoDelay(true);
    socket.on("data", (data) => {
      if (this.socket === socket) this.receive(data);
    });
    socket.on("error", (error) => {
      if (this.socket === socket) this.fail(error);
    });
    socket.on("close", () => {
      if (this.socket === socket)
        this.fail(new ModbusError("Connection closed", "DISCONNECTED"));
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new ModbusError("Connection timed out", "TIMEOUT"));
      }, this.timeout);
      const onError = (error) => {
        clearTimeout(timer);
        reject(error);
      };
      socket.once("error", onError);
      socket.connect(port, host, () => {
        clearTimeout(timer);
        socket.removeListener("error", onError);
        resolve();
      });
    });
  }
  fail(error) {
    const pending = this.pending;
    this.pending = undefined;
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
  }
  close() {
    this.fail(new ModbusError("Connection closed", "DISCONNECTED"));
    this.socket?.destroy();
    this.socket = undefined;
  }
  receive(data) {
    this.buffer = Buffer.concat([this.buffer, data]);
    while (this.buffer.length >= 7) {
      const length = this.buffer.readUInt16BE(4);
      if (this.buffer.readUInt16BE(2) !== 0 || length < 2 || length > 254) {
        this.fail(new ModbusError("Invalid MBAP header", "PROTOCOL_ERROR"));
        this.close();
        return;
      }
      if (this.buffer.length < 6 + length) return;
      const frame = this.buffer.subarray(0, 6 + length);
      this.buffer = this.buffer.subarray(6 + length);
      const pending = this.pending;
      if (
        !pending ||
        frame.readUInt16BE(0) !== pending.id ||
        frame[6] !== this.unit
      ) {
        this.fail(
          new ModbusError(
            "Unexpected transaction or unit identifier",
            "PROTOCOL_ERROR",
          ),
        );
        this.close();
        return;
      }
      this.pending = undefined;
      clearTimeout(pending.timer);
      const pdu = frame.subarray(7);
      if (pdu[0] === (pending.fc | 0x80))
        pending.reject(
          new ModbusError(
            `Modbus exception ${pdu[1]}`,
            `MODBUS_EXCEPTION_${pdu[1]}`,
          ),
        );
      else if (pdu[0] !== pending.fc)
        pending.reject(
          new ModbusError("Unexpected function code", "PROTOCOL_ERROR"),
        );
      else pending.resolve(pdu);
    }
  }
  request(pdu) {
    if (!this.socket || this.socket.destroyed)
      return Promise.reject(
        new ModbusError("Device disconnected", "DISCONNECTED"),
      );
    if (this.pending)
      return Promise.reject(
        new ModbusError("Concurrent Modbus request", "BUSY"),
      );
    const id = (this.sequence = (this.sequence + 1) & 0xffff);
    const frame = Buffer.alloc(7 + pdu.length);
    frame.writeUInt16BE(id);
    frame.writeUInt16BE(pdu.length + 1, 4);
    frame[6] = this.unit;
    pdu.copy(frame, 7);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.fail(
          new ModbusError(
            "Device response timed out; result may be unknown",
            "TIMEOUT",
          ),
        );
        this.close();
      }, this.timeout);
      this.pending = { id, fc: pdu[0], timer, resolve, reject };
      this.socket.write(frame, (error) => {
        if (error) {
          this.fail(error);
          this.close();
        }
      });
    });
  }
  async read(address, count) {
    validateRange(address, count, 125);
    const request = Buffer.alloc(5);
    request[0] = 3;
    request.writeUInt16BE(address, 1);
    request.writeUInt16BE(count, 3);
    const response = await this.request(request);
    if (response.length !== 2 + count * 2 || response[1] !== count * 2)
      throw new ModbusError(
        "Invalid register response length",
        "PROTOCOL_ERROR",
      );
    return Array.from({ length: count }, (_, i) =>
      response.readUInt16BE(2 + i * 2),
    );
  }
  async readDeviceIdentification() {
    const objects = {};
    let next = 0;
    // FC43/14 basic identification: vendor, product code and revision.
    for (let page = 0; page < 256; page++) {
      const response = await this.request(Buffer.from([43, 14, 1, next]));
      if (response.length < 7 || response[1] !== 14 || response[2] !== 1 ||
          ![0, 255].includes(response[4]))
        throw new ModbusError("Invalid device identification response", "PROTOCOL_ERROR");
      let offset = 7;
      for (let i = 0; i < response[6]; i++) {
        if (offset + 2 > response.length)
          throw new ModbusError("Truncated identification object", "PROTOCOL_ERROR");
        const id = response[offset++], length = response[offset++];
        if (offset + length > response.length || Object.hasOwn(objects, id))
          throw new ModbusError("Invalid identification object", "PROTOCOL_ERROR");
        objects[id] = response.subarray(offset, offset + length).toString("utf8");
        offset += length;
      }
      if (offset !== response.length)
        throw new ModbusError("Invalid identification response length", "PROTOCOL_ERROR");
      if (response[4] === 0) {
        if (![0, 1, 2].every(id => objects[id]?.trim()))
          throw new ModbusError("Missing basic device identification", "PROTOCOL_ERROR");
        return { vendor: objects[0], productCode: objects[1], revision: objects[2] };
      }
      if (response[5] <= next)
        throw new ModbusError("Invalid identification pagination", "PROTOCOL_ERROR");
      next = response[5];
    }
    throw new ModbusError("Too many identification pages", "PROTOCOL_ERROR");
  }
  async write(address, values) {
    validateRange(address, values.length, 123);
    if (values.some((v) => !Number.isInteger(v) || v < 0 || v > 65535))
      throw new ModbusError("Invalid register value", "VALIDATION");
    const request = Buffer.alloc(6 + values.length * 2);
    request[0] = 16;
    request.writeUInt16BE(address, 1);
    request.writeUInt16BE(values.length, 3);
    request[5] = values.length * 2;
    values.forEach((value, i) => request.writeUInt16BE(value, 6 + i * 2));
    const response = await this.request(request);
    if (
      response.length !== 5 ||
      response.readUInt16BE(1) !== address ||
      response.readUInt16BE(3) !== values.length
    )
      throw new ModbusError("Write acknowledgement mismatch", "PROTOCOL_ERROR");
  }
}
function validateRange(address, count, max) {
  if (
    !Number.isInteger(address) ||
    address < 0 ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > max ||
    address + count > 65536
  )
    throw new ModbusError("Invalid register range", "VALIDATION");
}

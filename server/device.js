import { setTimeout as delay } from "node:timers/promises";
import { ModbusClient } from "./modbus.js";
import { connectionConfig } from "./config.js";

export class DeviceError extends Error {
  constructor(message, code = "VALIDATION", status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
const PULSE_MASK = (1 << 2) | (1 << 13);
const phaseByCode = {
  0: "RISE",
  1: "NORMAL",
  2: "NORMAL",
  3: "NORMAL",
  4: "NORMAL",
  5: "SHUTOFF",
  8: "NORMAL",
  9: "WAIT",
  10: "HOLD",
  11: "SHUTOFF",
  12: "STANDBY",
  13: "RISE",
};
export const pressureScale = (unit) =>
  ({ mbar: 0.001, kPa: 0.01, "psi/10": 0.006894757293 })[unit];
export const volumeScale = (unit) =>
  ({ l: 0.001, m3: 1, scf: 0.028316846592 })[unit];
const swap = (word) => ((word & 255) << 8) | (word >>> 8);

export class DeviceService {
  constructor(config, client = new ModbusClient({ timeout: config.timeout })) {
    this.config = config;
    this.client = client;
    this.queue = Promise.resolve();
    this.queued = 0;
    this.state = {
      status: "disconnected",
      connection: null,
      telemetry: null,
      controls: null,
      parameters: null,
      lastError: null,
      identity: null,
      deviceInfo: null,
      sequence: 0,
      warnings: [],
    };
    this.price = 0.12;
    this.leakLimit = 0.1;
  }
  snapshot() {
    const fresh =
      this.state.status === "connected" &&
      this.state.telemetry &&
      Date.now() - this.state.telemetry.timestamp <
        Math.max(3000, (this.state.connection?.poll ?? 1000) * 3);
    return {
      ...this.state,
      fresh: !!fresh,
      canWrite: !!(
        fresh &&
        this.config.mappingConfirmed &&
        !!phaseByCode[this.state.telemetry.stateCode] &&
        this.config.writesEnabled &&
        this.state.controls &&
        !this.state.controls.resetPending
      ),
      canConfigure: !!(
        fresh &&
        this.config.mappingConfirmed &&
        !!phaseByCode[this.state.telemetry.stateCode] &&
        this.config.writesEnabled &&
        this.config.diagnosticInput !== null &&
        this.state.controls &&
        !this.state.controls.resetPending
      ),
      mappingReady: this.config.mappingConfirmed,
      readingEnabled: this.readingEnabled(),
      localSettings: { price: this.price, leakLimit: this.leakLimit },
    };
  }
  readingEnabled() {
    return this.config.inputBase !== null && this.config.mappingConfirmed;
  }
  exclusive(work) {
    if (this.queued >= 8)
      return Promise.reject(
        new DeviceError("Device queue is busy", "BUSY", 409),
      );
    this.queued++;
    const next = this.queue.then(work).finally(() => {
      this.queued--;
    });
    this.queue = next.catch(() => {});
    return next;
  }
  stopPolling() {
    clearTimeout(this.timer);
    this.timer = undefined;
  }
  schedule() {
    this.stopPolling();
    if (this.state.status !== "connected" || !this.readingEnabled())
      return;
    this.timer = setTimeout(() => {
      this.exclusive(async () => {
        if (this.state.status !== "connected") return;
        try {
          await this.poll();
        } catch (error) {
          this.fault(error);
        }
      }).finally(() => this.schedule());
    }, this.state.connection.poll);
    this.timer.unref?.();
  }
  fault(error) {
    this.stopPolling();
    this.client.close();
    this.state.status = "error";
    this.state.parameters = null;
    this.state.lastError = {
      code: error.code || "DEVICE_ERROR",
      message: error.message,
    };
  }
  connect(body) {
    const connection = connectionConfig(body);
    return this.exclusive(async () => {
      this.stopPolling();
      this.client.close();
      this.state = {
        ...this.state,
        status: "connecting",
        connection,
        telemetry: null,
        controls: null,
        parameters: null,
        lastError: null,
        warnings: [],
        identity: null,
        deviceInfo: null,
      };
      try {
        await this.client.connect(connection);
        const info = await this.client.readDeviceIdentification();
        this.state.deviceInfo = info;
        this.state.identity = info.productCode;
        if (!/^CPX-(M-)?FB36$/i.test(info.productCode.trim()))
          throw new DeviceError(
            `Expected CPX-FB36, received ${info.productCode}`,
            "DEVICE_MISMATCH", 409,
          );
        this.state.status = "connected";
        if (this.readingEnabled()) await this.poll();
        else this.state.warnings = ["MAPPING_REQUIRED"];
        this.schedule();
        return this.snapshot();
      } catch (error) {
        this.fault(error);
        throw error;
      }
    });
  }
  disconnect() {
    return this.exclusive(async () => {
      this.stopPolling();
      this.client.close();
      this.state.status = "disconnected";
      this.state.lastError = null;
      this.state.warnings = [];
      return this.snapshot();
    });
  }
  decodeWords(words) {
    return this.config.swapProcessBytes ? words.map(swap) : words;
  }
  async readOutputs() {
    if (!this.config.mappingConfirmed || this.config.outputEchoBase === null) return null;
    return this.decodeWords(
      await this.client.read(this.config.outputEchoBase, 3),
    );
  }
  async poll() {
    const words = this.decodeWords(await this.client.read(this.config.inputBase, 7));
    const outputs = await this.readOutputs();
    const statusWord = words[3],
      stateCode = (statusWord >>> 8) & 15;
    if (words[0] > 32767 || words[2] > 32767)
      throw new DeviceError(
        "Invalid process values; verify mapping and byte order",
        "INVALID_MAPPING",
        502,
      );
    const timestamp = Date.now();
    const previous = this.state.telemetry;
    const pressure = words[2] * pressureScale(this.config.pressureUnit);
    const delta = previous
      ? (pressure - previous.pressure) /
        ((timestamp - previous.timestamp) / 1000 || 1)
      : null;
    const is32 = words[4] === 10000;
    const rawVolume = is32 ? words[6] * 65536 + words[5] : words[1];
    const warnings = [];
    if (!is32 && rawVolume === 65535) warnings.push("CONSUMPTION_SATURATED");
    if (!(statusWord & 0x1000)) warnings.push("CONSUMPTION_STOPPED");
    if (stateCode === 7) warnings.push("LOAD_VOLTAGE_MISSING");
    if (!phaseByCode[stateCode]) warnings.push("UNKNOWN_MODULE_STATE");
    this.state.telemetry = {
      timestamp,
      flow: words[0] * (this.config.flowUnit === "l/min" ? 1 : 2.8316846592),
      pressure,
      consumption: rawVolume * volumeScale(this.config.consumptionUnit),
      delta,
      phase: phaseByCode[stateCode] || "UNKNOWN",
      stateCode,
      timerState: (statusWord >>> 4) & 3,
      valveOpen: !(statusWord & 1),
      consumptionRunning: !!(statusWord & 0x1000),
      consumptionBits: is32 ? 32 : 16,
      tick: ++this.state.sequence,
    };
    // Commands are reflected by the output echo, valve state by Em.3.0.
    this.state.controls = outputs
      ? {
          mode: outputs[0] & 2 ? "auto" : "user",
          enabled: !!(outputs[0] & 32),
          manualOpen: !(outputs[0] & 1),
          resetPending: !!(outputs[0] & PULSE_MASK),
          userPressure: outputs[2] * pressureScale(this.config.pressureUnit),
        }
      : null;
    if (this.state.controls?.resetPending) warnings.push("RESET_PENDING");
    this.state.warnings = warnings;
    this.state.lastError = null;
  }
  assertWrite(allowReset = false) {
    const s = this.snapshot();
    if (!s.fresh || !phaseByCode[this.state.telemetry.stateCode])
      throw new DeviceError(
        "Device data is unavailable or stale",
        "NOT_CONNECTED",
        409,
      );
    if (!this.config.mappingConfirmed || !this.config.writesEnabled || !this.state.controls)
      throw new DeviceError(
        "Writes require a confirmed output/echo mapping and writesEnabled",
        "WRITES_DISABLED",
        409,
      );
    if (this.state.controls.resetPending && !allowReset)
      throw new DeviceError(
        "Reset bit is still asserted; release reset before continuing",
        "RESET_PENDING",
        409,
      );
  }
  async writeOutputs(offset, words) {
    await this.client.write(
      this.config.outputBase + offset,
      this.config.swapProcessBytes ? words.map(swap) : words,
    );
    const end = Date.now() + this.config.timeout;
    do {
      const echo = await this.readOutputs();
      if (words.every((v, i) => echo[offset + i] === v)) return;
      await delay(30);
    } while (Date.now() < end);
    throw new DeviceError(
      "Output feedback did not confirm command; check other controllers",
      "FEEDBACK_MISMATCH",
      502,
    );
  }
  async maskedControl(mask, value) {
    const [word] = await this.readOutputs();
    if (word & PULSE_MASK && mask !== PULSE_MASK)
      throw new DeviceError("Reset remains asserted", "RESET_PENDING", 409);
    const next = (word & ~mask) | (value & mask);
    await this.writeOutputs(0, [next]);
  }
  control(body) {
    return this.exclusive(async () => {
      const { action, value } = body || {};
      const allowed = [
        "mode",
        "valve",
        "enabled",
        "consumption-run",
        "reset-timer",
        "reset-consumption",
        "release-reset",
        "consumption-32",
      ];
      if (!allowed.includes(action))
        throw new DeviceError("Unknown control action");
      if (action === "mode" && !["auto", "user"].includes(value))
        throw new DeviceError("Invalid mode");
      if (
        ["valve", "enabled", "consumption-run"].includes(action) &&
        typeof value !== "boolean"
      )
        throw new DeviceError("Expected boolean value");
      this.assertWrite(action === "release-reset");
      try {
        if (action === "mode")
          await this.maskedControl(2, value === "auto" ? 2 : 0);
        if (action === "valve") {
          const [word] = await this.readOutputs();
          if (word & 2)
            throw new DeviceError(
              "Manual valve control requires user mode",
              "AUTO_MODE",
              409,
            );
          await this.maskedControl(1, value ? 0 : 1);
        }
        if (action === "enabled") await this.maskedControl(32, value ? 32 : 0);
        if (action === "consumption-run")
          await this.maskedControl(4096, value ? 4096 : 0);
        if (action === "release-reset") await this.maskedControl(PULSE_MASK, 0);
        if (action === "consumption-32") {
          await this.writeOutputs(1, [10000]);
          const end = Date.now() + this.config.timeout;
          do {
            const data = this.decodeWords(
              await this.client.read(this.config.inputBase + 4, 1),
            );
            if (data[0] === 10000) break;
            if (Date.now() >= end)
              throw new DeviceError(
                "Optional input selection not confirmed",
                "FEEDBACK_MISMATCH",
                502,
              );
            await delay(30);
          } while (Date.now() <= end);
        }
        if (action === "reset-timer" || action === "reset-consumption") {
          const bit = action === "reset-timer" ? 4 : 8192;
          const [word] = await this.readOutputs();
          try {
            await this.writeOutputs(0, [word | bit]);
            await delay(this.config.pulseMs);
          } finally {
            await this.writeOutputs(0, [word & ~bit]);
          }
        }
        await this.poll();
        return this.snapshot();
      } catch (error) {
        if (!(error instanceof DeviceError && error.status < 500))
          this.fault(error);
        throw error;
      }
    });
  }
  assertDiagnostic() {
    this.assertWrite();
    if (this.config.diagnosticInput === null)
      throw new DeviceError(
        "I/O diagnostic mapping is required for parameters",
        "DIAGNOSTICS_REQUIRED",
        409,
      );
  }
  // FB36 table 140: bit15 rising edge, bit14 byte/word, bit13 read/write.
  async systemByte(offset, value, word = false) {
    const functionNumber = 4828 + this.config.moduleNumber * 64 + offset;
    const command =
      functionNumber | (value === undefined ? 0 : 0x2000) | (word ? 0x4000 : 0);
    const out = this.config.diagnosticOutput,
      input = this.config.diagnosticInput;
    await this.client.write(out, [command, value ?? 0]);
    const clearDeadline = Date.now() + this.config.timeout;
    while ((await this.client.read(input, 1))[0] !== 0) {
      if (Date.now() > clearDeadline)
        throw new DeviceError(
          "Diagnostic interface did not clear",
          "DIAGNOSTIC_TIMEOUT",
          502,
        );
      await delay(20);
    }
    await this.client.write(out, [command | 0x8000, value ?? 0]);
    try {
      const deadline = Date.now() + this.config.timeout;
      do {
        const [result, data] = await this.client.read(input, 2);
        if (result === 0x8000) return word ? data : data & 255;
        if (result > 0x8000)
          throw new DeviceError(
            `CPX diagnostic error 0x${result.toString(16)}`,
            "DIAGNOSTIC_ERROR",
            502,
          );
        await delay(20);
      } while (Date.now() < deadline);
      throw new DeviceError(
        "Diagnostic request timed out",
        "DIAGNOSTIC_TIMEOUT",
        502,
      );
    } finally {
      await this.client.write(out, [command, value ?? 0]);
    }
  }
  async checkUnits() {
    const units = await this.systemByte(8);
    const actual = {
      pressureUnit: ["mbar", "kPa", "psi/10"][units & 3],
      flowUnit: ["l/min", null, "scfm/10"][(units >>> 2) & 3],
      consumptionUnit: ["l", "m3", "scf"][(units >>> 4) & 3],
    };
    for (const key of Object.keys(actual))
      if (actual[key] !== this.config[key])
        throw new DeviceError(
          `Device ${key} differs from configured units`,
          "UNIT_MISMATCH",
          409,
        );
  }
  async readWord(offset) {
    return this.systemByte(offset, undefined, true);
  }
  async readParameters() {
    await this.checkUnits();
    const result = {};
    for (const [key, offset] of [
      ["delay", 17],
      ["threshold", 19],
      ["normal", 21],
      ["standby", 23],
    ]) {
      const raw = await this.readWord(offset);
      result[key] =
        key === "normal" || key === "standby"
          ? raw * pressureScale(this.config.pressureUnit)
          : key === "threshold" && this.config.flowUnit !== "l/min"
            ? raw * 2.8316846592
            : raw;
    }
    const outputs = await this.readOutputs();
    result.userPressure = outputs[2] * pressureScale(this.config.pressureUnit);
    this.state.parameters = {
      ...result,
      price: this.price,
      leakLimit: this.leakLimit,
    };
    return this.state.parameters;
  }
  refreshParameters() {
    return this.exclusive(async () => {
      this.assertDiagnostic();
      try {
        await this.readParameters();
        await this.poll();
        return this.snapshot();
      } catch (error) {
        this.state.parameters = null;
        if (
          error.code === "UNIT_MISMATCH" ||
          !(error instanceof DeviceError && error.status < 500)
        )
          this.fault(error);
        throw error;
      }
    });
  }
  applyParameters(body) {
    return this.exclusive(async () => {
      this.assertDiagnostic();
      const fields = {
        threshold: [0, 32767],
        delay: [0, 65535],
        normal: [2.5, 10],
        standby: [2.5, 10],
        userPressure: [2.5, 10],
        price: [0, 100],
        leakLimit: [0.01, 10],
      };
      for (const [key, [min, max]] of Object.entries(fields))
        if (
          typeof body?.[key] !== "number" ||
          !Number.isFinite(body[key]) ||
          body[key] < min ||
          body[key] > max
        )
          throw new DeviceError(`Invalid parameter: ${key}`);
      if (!Number.isInteger(body.delay) || body.normal <= body.standby)
        throw new DeviceError("Invalid delay/threshold or pressure order");
      try {
        // Apply a parameter set only in manual mode; the entire set is not atomic.
        const outputs = await this.readOutputs();
        if (outputs[0] & 2)
          throw new DeviceError(
            "Switch to manual mode before applying device parameters",
            "AUTO_MODE",
            409,
          );
        const old = await this.readParameters();
        const ps = pressureScale(this.config.pressureUnit);
        const toRaw = (key, value) =>
          Math.round(
            value /
              (["normal", "standby"].includes(key)
                ? ps
                : key === "threshold" && this.config.flowUnit !== "l/min"
                  ? 2.8316846592
                  : 1),
          );
        if (toRaw("normal", body.normal) <= toRaw("standby", body.standby))
          throw new DeviceError("Pressure values round to an invalid order");
        const pressureKeys =
          body.normal <= old.standby
            ? ["standby", "normal"]
            : ["normal", "standby"];
        for (const key of ["threshold", "delay", ...pressureKeys]) {
          const offset = { threshold: 19, delay: 17, normal: 21, standby: 23 }[
            key
          ];
          const raw = toRaw(key, body[key]);
          if (raw !== toRaw(key, old[key])) {
            await this.systemByte(offset, raw, true);
            if ((await this.readWord(offset)) !== raw)
              throw new DeviceError(
                `Parameter readback mismatch: ${key}`,
                "PARAMETER_MISMATCH",
                502,
              );
          }
        }
        const userRaw = Math.round(body.userPressure / ps);
        await this.writeOutputs(2, [userRaw]);
        await this.maskedControl(0x18, 0x18);
        this.price = body.price;
        this.leakLimit = body.leakLimit;
        await this.readParameters();
        await this.poll();
        return this.snapshot();
      } catch (error) {
        this.state.parameters = null;
        if (
          error.code === "UNIT_MISMATCH" ||
          !(error instanceof DeviceError && error.status < 500)
        ) {
          error.message +=
            "; some parameters may already have changed. Read back before retrying.";
          this.fault(error);
        }
        throw error;
      }
    });
  }
}

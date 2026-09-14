import type { DeviceStatus } from "./api";

export function connectionLabel(status: DeviceStatus | null, zh: boolean) {
  if (!status) return zh ? "正在加载连接状态" : "Loading connection";
  if (status.status === "connecting") return zh ? "正在连接" : "Connecting";
  if (status.status !== "connected") return zh ? "设备未连接" : "Device offline";
  if (!status.fresh) return zh ? "已连接，等待数据" : "Connected, waiting for data";
  return zh ? "实机在线" : "Device online";
}

export function connectionNotice(status: DeviceStatus | null, dataReady: boolean, zh: boolean) {
  if (!status) return zh ? "正在加载设备连接状态…" : "Loading device connection…";
  if (status.lastError) {
    if (status.lastError.code === "TIMEOUT") return zh
      ? "设备通讯超时，请检查网络、Modbus TCP 协议和设备编号。"
      : "Device communication timed out. Check the network, Modbus TCP protocol and Unit ID.";
    return status.lastError.message;
  }
  if (status.status === "disconnected") return zh
    ? "请在设备连接页连接设备。" : "Connect your device on the connection page.";
  if (status.status === "connecting") return zh
    ? "正在连接设备并读取数据…" : "Connecting and reading device data…";
  if (!status.mappingReady) return zh
    ? "通讯映射尚未加载，请检查设备配置文件。"
    : "Communication mapping is missing. Check the device configuration file.";
  if (!dataReady) return zh
    ? "实时数据不可用，请检查设备连接。" : "Live data unavailable. Check the device connection.";
  return zh ? "设备有状态提示，请在设备连接页查看。"
    : "Device status notice. Check the connection page.";
}

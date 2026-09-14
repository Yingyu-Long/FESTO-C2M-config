import { useState } from "react";
import Panel from "../components/Panel";
import { translations, type Language } from "../../translate";
import type { DeviceController } from "../dashboard/useDevice";
import { connectionToDraft, defaultConnection, isConnectionDraft, readStored, storageKeys, writeStored } from "../persistence";
import type { ConnectionDraft } from "../persistence";

type ModbusProps = {
  notify: (message: string) => void;
  language: Language;
  device: DeviceController;
};
export default function Modbus({ notify, language, device }: ModbusProps) {
  const [draft, setDraft] = useState(()=>readStored(storageKeys.connectionDraft,isConnectionDraft));
  const connection = draft ?? connectionToDraft(device.backend?.connection ?? device.savedConnection ?? defaultConnection);
  function setConnection(next:ConnectionDraft) {
    writeStored(storageKeys.connectionDraft,next);
    setDraft(next);
  }
  const [error, setError] = useState("");
  const copy = translations[language].modbus;
  const zh = language === "zh";
  const connected = device.backend?.status === "connected";
  async function run(operation: () => Promise<unknown>) {
    try {
      await operation();
      setError("");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
      notify(message);
    }
  }
  const warnings: Record<string, string> = {
    MAPPING_REQUIRED: zh
      ? "通讯映射尚未加载，请检查设备配置文件。"
      : "Communication mapping is missing. Check the device configuration file.",
    CONSUMPTION_SATURATED: zh
      ? "16 位耗气量已达上限，请先记录数据，再重置或启用32位读取。"
      : "16-bit consumption is saturated. Record the value before resetting or selecting 32-bit data.",
    CONSUMPTION_STOPPED: zh
      ? "耗气量累计已停止。"
      : "Consumption measurement is stopped.",
    LOAD_VOLTAGE_MISSING: zh
      ? "设备负载电源缺失。"
      : "Device load voltage is missing.",
    UNKNOWN_MODULE_STATE: zh
      ? "设备状态未知，请检查通讯映射及设备诊断。"
      : "Unknown device state. Check mapping and diagnostics.",
    RESET_PENDING: zh
      ? "复位信号仍处于置位状态，请先释放复位信号。"
      : "A reset signal remains asserted. Release it before continuing.",
  };
  return (
    <div className="connection-grid">
      <Panel
        title={copy.title}
        extra={
          <span className="badge">
            {connected
              ? `${device.backend?.deviceInfo?.productCode || ""} ${zh ? "已连接" : "Connected"}`.trim()
              : copy.disconnected}
          </span>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() =>
              device.connect({
                host: connection.host,
                port: Number(connection.port),
                unit: Number(connection.unit),
                poll: Number(connection.poll),
              }),
            );
          }}
        >
          <div className="form-grid">
            <label className="field">
              <span>{copy.host}</span>
              <input
                required
                disabled={device.busy}
                value={connection.host}
                pattern="[a-zA-Z0-9][a-zA-Z0-9.:-]*"
                onChange={(e) =>
                  setConnection({ ...connection, host: e.target.value })
                }
              />
            </label>
            {[
              { key: "port", label: copy.port, min: 1, max: 65535 },
              { key: "unit", label: copy.unit, min: 0, max: 255 },
              { key: "poll", label: copy.poll, min: 100, max: 60000 },
            ].map((f) => (
              <label className="field" key={f.key}>
                <span>{f.label}</span>
                <input
                  type="number"
                  required
                  disabled={device.busy}
                  min={f.min}
                  max={f.max}
                  step="1"
                  value={connection[f.key as keyof typeof connection]}
                  onChange={(e) =>
                    setConnection({ ...connection, [f.key]: e.target.value })
                  }
                />
              </label>
            ))}
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <span>
              {device.backend?.canWrite
                ? zh
                  ? "读写已启用"
                  : "Read/write enabled"
                : zh
                  ? "只读模式"
                  : "Read-only mode"}
            </span>
            <button
              className="button"
              type="button"
              disabled={device.busy || !connected}
              onClick={() => run(device.disconnect)}
            >
              {zh ? "断开连接" : "Disconnect"}
            </button>
            <button
              className="button primary"
              type="submit"
              disabled={device.busy}
            >
              {device.busy
                ? zh
                  ? "处理中…"
                  : "Working…"
                : zh
                  ? "连接设备"
                  : "Connect"}
            </button>
          </div>
        </form>
      </Panel>
      {device.backend?.warnings.map((code) => (
        <p className="device-notice" key={code}>
          {warnings[code] || code}
        </p>
      ))}
      {connected && (
        <div className="source-choice">
          {!device.backend?.telemetry?.consumptionRunning && (
            <button
              className="button"
              disabled={!device.canControl}
              onClick={() => run(device.startConsumption)}
            >
              {zh ? "启动耗气量累计" : "Start consumption measurement"}
            </button>
          )}
          {device.backend?.telemetry?.consumptionBits === 16 && (
            <button
              className="button"
              disabled={!device.canControl}
              onClick={() => run(device.select32Bit)}
            >
              {zh ? "启用32位耗气量" : "Use 32-bit consumption"}
            </button>
          )}
          {device.backend?.controls?.resetPending && (
            <button
              className="button"
              disabled={device.busy || !device.backend.fresh}
              onClick={() => run(device.releaseReset)}
            >
              {zh ? "释放复位信号" : "Release reset signal"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

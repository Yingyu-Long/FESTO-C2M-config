import { useState } from "react";
import Panel from "../components/Panel";

type ModbusProps = {
  notify: (message: string) => void;
};

export default function Modbus({ notify }: ModbusProps) {
  const [connection, setConnection] = useState({
    host: "192.168.1.10",
    port: "502",
    unit: "1",
    poll: "1000",
  });
  const [connectionSaved, setConnectionSaved] = useState(false);
  return (
    <div className="connection-grid">
      <Panel title="设备连接" extra={<span className="badge">未连接</span>}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setConnectionSaved(true);
            notify("配置已暂存，设备未连接");
          }}
        >
          <div className="form-grid">
            <label className="field">
              <span>设备 IP / 主机名</span>
              <input
                required
                value={connection.host}
                pattern="[a-zA-Z0-9][a-zA-Z0-9.:-]*"
                onChange={(e) => {
                  setConnectionSaved(false);
                  setConnection({ ...connection, host: e.target.value });
                }}
              />
            </label>
            {[
              { key: "port", label: "端口", min: 1, max: 65535 },
              { key: "unit", label: "设备编号", min: 0, max: 255 },
              {
                key: "poll",
                label: "更新间隔 (ms)",
                min: 100,
                max: 60000,
              },
            ].map((f) => (
              <label className="field" key={f.key}>
                <span>{f.label}</span>
                <input
                  type="number"
                  required
                  min={f.min}
                  max={f.max}
                  step="1"
                  value={connection[f.key as keyof typeof connection]}
                  onChange={(e) => {
                    setConnectionSaved(false);
                    setConnection({
                      ...connection,
                      [f.key]: e.target.value,
                    });
                  }}
                />
              </label>
            ))}
          </div>
          <div className="form-actions">
            <span>
              {connectionSaved ? "配置已暂存" : "演示模式，设备未连接"}
            </span>
            <button type="submit" className="button primary">
              保存配置
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}

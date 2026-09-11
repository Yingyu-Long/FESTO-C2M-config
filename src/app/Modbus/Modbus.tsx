import { useState } from "react";
import Panel from "../components/Panel";
import { translations, type Language } from "../../i18n";

type ModbusProps = {
  notify: (message: string) => void;
  language: Language;
};

export default function Modbus({ notify, language }: ModbusProps) {
  const [connection, setConnection] = useState({
    host: "192.168.1.10",
    port: "502",
    unit: "1",
    poll: "1000",
  });
  const [connectionSaved, setConnectionSaved] = useState(false);
  const copy = translations[language].modbus;
  return (
    <div className="connection-grid">
      <Panel
        title={copy.title}
        extra={<span className="badge">{copy.disconnected}</span>}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setConnectionSaved(true);
            notify(copy.savedToast);
          }}
        >
          <div className="form-grid">
            <label className="field">
              <span>{copy.host}</span>
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
              { key: "port", label: copy.port, min: 1, max: 65535 },
              { key: "unit", label: copy.unit, min: 0, max: 255 },
              {
                key: "poll",
                label: copy.poll,
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
            <span>{connectionSaved ? copy.saved : copy.demoStatus}</span>
            <button type="submit" className="button primary">
              {copy.save}
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}

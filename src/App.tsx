import { useEffect, useRef, useState } from "react";
import { defaults } from "./simulation";
import type { Parameters } from "./simulation";
import Dashboard from "./app/dashboard/Dashboard";
import { useDevice } from "./app/dashboard/useDevice";
import Config from "./app/config/Config";
import Modbus from "./app/Modbus/Modbus";
import Icon from "./app/components/Icon";
import logo from "./assets/festo-logo.png";
import "./App.css";

export default function App() {
  const [tab, setTab] = useState("overview");
  const [params, setParams] = useState<Parameters>(defaults);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  function notify(message: string) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4000);
  }

  const device = useDevice(params, notify);
  return (
    <div className="app">
      <header className="topbar">
        <div className="product">
          <img src="/dashboard.png" alt="" />
          <span>Energy Efficiency</span>
        </div>
        <nav aria-label="主导航">
          {[
            ["overview", "设备概览"],
            ["parameters", "参数设置"],
            ["connection", "设备连接"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        <img className="brand" src={logo} alt="Festo" />
      </header>
      <main>
        <div className="page-heading">
          <div>
            <h1>
              MSE6-C2M <span>节能模块</span>
            </h1>
          </div>
          <div className="heading-actions">
            <span className="badge demo">
              <i />
              模拟演示
            </span>

          </div>
        </div>

        {/* Keep page-local drafts and selections when switching tabs. */}
        <div hidden={tab !== "overview"}>
          <Dashboard params={params} device={device} onOpenConfig={() => setTab("parameters")} notify={notify} />
        </div>
        <div hidden={tab !== "parameters"}>
          <Config params={params} onApply={setParams} notify={notify} />
        </div>
        <div hidden={tab !== "connection"}>
          <Modbus notify={notify} />
        </div>
        <footer>
          <span>FESTO · MSE6-C2M</span>
          <span>演示数据 · 未连接设备</span>
        </footer>
      </main>
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}

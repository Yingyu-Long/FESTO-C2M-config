import { useEffect, useRef, useState } from "react";
import {
  Navigate,
  NavLink,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import Dashboard from "./app/dashboard/Dashboard";
import { useDevice } from "./app/dashboard/useDevice";
import { connectionLabel, connectionNotice } from "./app/connectionStatus";
import Config from "./app/config/Config";
import Modbus from "./app/Modbus/Modbus";
import Icon from "./app/components/Icon";
import logo from "./assets/festo-logo.png";
import { translations, type Language } from "./translate";
import "./App.css";
import "./app/theme.css";

const LANGUAGE_STORAGE_KEY = "festo-c2m-language";

export default function App() {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      return localStorage.getItem(LANGUAGE_STORAGE_KEY) === "zh" ? "zh" : "en";
    } catch { return "en"; }
  });
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => {
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language); } catch { /* Browser storage can be disabled. */ }
  }, [language]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  function notify(message: string) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4000);
  }

  const copy = translations[language];
  const device = useDevice(notify, language);
  const params = device.params;
  const navigate = useNavigate();
  const statusLabel = connectionLabel(device.backend, language === "zh");
  return (
    <div className="app">
      <header className="topbar">
        <button
          className="product"
          onClick={() => navigate("/overview")}
          aria-label={copy.nav.overview}
          title={copy.nav.overview}
        >
          <img src="/dashboard.png" alt="" />
        </button>
        <nav aria-label={copy.nav.label}>
          {[
            ["/overview", copy.nav.overview],
            ["/parameters", copy.nav.parameters],
            ["/connection", copy.nav.connection],
          ].map(([path, label]) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <label className="language-select">
          <span className="sr-only">{copy.app.language}</span>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value as Language)}
            aria-label={copy.app.language}
          >
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </label>
        <img className="brand" src={logo} alt="Festo" />
      </header>
      <main>
        <div className="page-heading">
          <div>
            <h1>
              MSE6-C2M <span>{copy.app.module}</span>
            </h1>
          </div>
          <div className="heading-actions">
            <span className="badge connection-status">
              <i />
              {statusLabel}
            </span>
          </div>
        </div>

        {(!device.dataReady || device.apiError || device.backend?.warnings.length) && (
          <div className="device-notice" role="status">
            {device.apiError ||
              connectionNotice(device.backend, device.dataReady, language === "zh")}
          </div>
        )}
        <Routes>
          <Route
            path="/overview"
            element={
              <Dashboard
                params={params}
                device={device}
                onOpenConfig={() => navigate("/parameters")}
                notify={notify}
                language={language}
              />
            }
          />
          <Route
            path="/parameters"
            element={
              <Config
                key={device.settingsScope}
                params={params}
                onApply={device.applyParameters}
                device={device}
                notify={notify}
                language={language}
              />
            }
          />
          <Route
            path="/connection"
            element={
              <Modbus notify={notify} language={language} device={device} />
            }
          />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
        <footer>
          <span>FESTO · MSE6-C2M</span>
          <span>Modbus TCP · FB36</span>
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

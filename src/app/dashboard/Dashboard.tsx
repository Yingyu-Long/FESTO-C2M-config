import { useEffect, useRef, useState } from "react";
import type { Parameters, Snapshot } from "../types";
import type { DeviceController } from "./useDevice";
import { fields } from "../config/fields";
import Icon from "../components/Icon";
import Panel from "../components/Panel";
import { translations, type Language } from "../../translate";

type DashboardProps = {
  params: Parameters;
  device: DeviceController;
  onOpenConfig: () => void;
  notify: (message: string) => void;
  language: Language;
};

export default function Dashboard({
  params,
  device,
  onOpenConfig,
  notify,
  language,
}: DashboardProps) {
  const {
    mode,
    enabled,
    setEnabled,
    manualOpen,
    setManualOpen,
    samples,
    resetConsumption,
    changeMode,
    resetTimer,
  } = device;
  const current: Snapshot = samples[samples.length - 1] ?? {
    flow: 0, pressure: 0, consumption: 0, delta: 0, tick: 0, phase: "UNKNOWN",
  };
  const copy = translations[language].dashboard;
  const phaseNames = copy.phase;
  const [metric, setMetric] = useState<"flow" | "pressure">("flow");
  const [resetOpen, setResetOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const resetTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (resetOpen) cancelRef.current?.focus();
  }, [resetOpen]);
  const valveOpen = device.valveOpen;
  const leakEligible =
    device.dataReady && device.deltaReady && !valveOpen && mode === "user";
  const leak = leakEligible && -current.delta > params.leakLimit;
  const maxY =
    metric === "flow"
      ? Math.max(400, params.threshold * 1.2, ...samples.map((s) => s.flow))
      : 10;
  const chartPoints = samples
    .map((s, i) => `${44 + (i / 59) * 700},${164 - (s[metric] / maxY) * 140}`)
    .join(" ");
  const closeReset = () => {
    setResetOpen(false);
    resetTrigger.current?.focus();
  };
  return (
    <>
      <>
        <div className="metrics">
          {[
            {
              label: copy.currentFlow,
              value: current.flow.toFixed(1),
              unit: "l/min",
              icon: "flow",
              detail:
                !device.backend?.parameters
                  ? "—"
                  : `${copy.lowFlowThreshold} ${params.threshold} l/min`,
            },
            {
              label: copy.outputPressure,
              value: current.pressure.toFixed(2),
              unit: "bar",
              icon: "pressure",
              detail:
                !device.backend?.parameters
                  ? "—"
                  : `${copy.targetPressure} ${mode === "user" ? params.userPressure : ["SHUTOFF", "STANDBY"].includes(current.phase) ? params.standby : params.normal} bar`,
            },
            {
              label: copy.totalConsumption,
              value: current.consumption.toFixed(3),
              unit: "m³",
              icon: "total",
              detail: copy.sessionTotal,
            },
            {
              label: copy.pressureChange,
              value: `${current.delta > 0 ? "+" : ""}${current.delta.toFixed(2)}`,
              unit: "bar/s",
              icon: "trend",
              detail: leak
                ? copy.leakWarning
                : leakEligible
                  ? copy.leakMonitoring
                  : copy.leakAssessment,
            },
          ].map((m) => (
            <section className="metric-card" key={m.label}>
              <div className="metric-label">
                <span>{m.label}</span>
                <Icon name={m.icon} />
              </div>
              <div className="metric-value">
                {device.dataReady && (m.icon !== "trend" || device.deltaReady)
                  ? m.value
                  : "—"}
                <span>{m.unit}</span>
              </div>
              <div className="metric-bottom">
                <span>{device.dataReady ? m.detail : "—"}</span>
              </div>
            </section>
          ))}
        </div>
        <div className="primary-grid">
          <Panel title={copy.operationControl}>
            <div className="control-body">
              <div className="label-row">
                <span>{copy.controlMode}</span>
              </div>
              <div
                className="mode-switch"
                role="group"
                aria-label={copy.controlMode}
              >
                <button
                  className={mode === "auto" ? "selected" : ""}
                  disabled={!device.canControl}
                  onClick={() => changeMode("auto")}
                >
                  <Icon name="settings" />
                  {copy.autoMode}
                </button>
                <button
                  className={mode === "user" ? "selected" : ""}
                  disabled={!device.canControl}
                  onClick={() => changeMode("user")}
                >
                  <Icon name="plug" />
                  {copy.manualMode}
                </button>
              </div>
              {mode === "auto" ? (
                <>
                  <div className="setting-row">
                    <div>
                      <strong>{copy.autoStandby}</strong>
                    </div>
                    <button
                      className={`switch ${enabled ? "on" : ""}`}
                      role="switch"
                      aria-checked={enabled}
                      aria-label={copy.autoStandby}
                      disabled={!device.canControl}
                      onClick={() => setEnabled(!enabled)}
                    >
                      <span />
                    </button>
                  </div>
                  <div className="timer">
                    <div className="label-row">
                      <span>{copy.lowFlowTimer}</span>
                      <strong>
                        {!device.dataReady ? "—" :
                          device.backend?.telemetry?.timerState === 2
                            ? language === "zh" ? "已超时" : "Elapsed"
                            : device.backend?.telemetry?.timerState === 1
                              ? language === "zh" ? "计时中" : "Running"
                              : language === "zh" ? "未计时" : "Idle"}
                      </strong>
                    </div>
                    <div className="timer-foot">
                      <span>
                        {device.dataReady ? phaseNames[current.phase] : "—"}
                      </span>
                      <button
                        className="text-button"
                        disabled={!device.canControl}
                        onClick={resetTimer}
                      >
                        <Icon name="reset" size={14} />
                        {copy.restoreAndRet}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="setting-row">
                    <div>
                      <strong>{copy.shutoffValve}</strong>
                    </div>
                    <div className="segmented">
                      <button
                        className={manualOpen ? "selected" : ""}
                        disabled={!device.canControl}
                        onClick={() => setManualOpen(true)}
                      >
                        {copy.open}
                      </button>
                      <button
                        className={!manualOpen ? "selected" : ""}
                        disabled={!device.canControl}
                        onClick={() => setManualOpen(false)}
                      >
                        {copy.closed}
                      </button>
                    </div>
                  </div>
                  <div className="manual-pressure">
                    <span>
                      {copy.manualTargetPressure}{" "}
                      <strong>
                        {device.backend?.parameters
                          ? `${params.userPressure.toFixed(1)} bar`
                          : "—"}
                      </strong>
                    </span>
                    <button
                      className="text-button"
                      onClick={() => onOpenConfig()}
                    >
                      {copy.adjustPressure} <Icon name="arrow" size={14} />
                    </button>
                  </div>
                </>
              )}
              <div className="control-status">
                <span className={`dot ${valveOpen ? "" : "muted"}`} />
                <strong>
                  {copy.shutoffValve}{" "}
                  {device.dataReady
                    ? valveOpen
                      ? copy.open
                      : copy.closed
                    : "—"}
                </strong>
              </div>
            </div>
          </Panel>
          <Panel
            title={copy.liveTrend}
            extra={
              <div className="segmented">
                <button
                  className={metric === "flow" ? "selected" : ""}
                  onClick={() => setMetric("flow")}
                >
                  {copy.flow}
                </button>
                <button
                  className={metric === "pressure" ? "selected" : ""}
                  onClick={() => setMetric("pressure")}
                >
                  {copy.pressure}
                </button>
              </div>
            }
          >
            <div className="chart-meta">
              <span>
                <i className="legend-line" />
                {metric === "flow" ? copy.flowTrend : copy.pressureTrend}
              </span>
              <span>{copy.recentSeconds}</span>
            </div>
            <div
              className="chart"
              style={{ visibility: device.dataReady ? "visible" : "hidden" }}
              aria-hidden={!device.dataReady}
            >
              <svg
                viewBox="0 0 770 194"
                role="img"
                aria-label={`${metric === "flow" ? copy.flow : copy.pressure}${copy.trendAria}`}
              >
                <defs>
                  <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0091dc" stopOpacity=".18" />
                    <stop offset="100%" stopColor="#0091dc" stopOpacity=".01" />
                  </linearGradient>
                </defs>
                {[0, 1, 2, 3, 4].map((i) => (
                  <g key={i}>
                    <line
                      x1="44"
                      x2="744"
                      y1={24 + i * 35}
                      y2={24 + i * 35}
                      stroke="#e9edef"
                    />
                    <text x="33" y={28 + i * 35} textAnchor="end">
                      {Math.round(maxY * (1 - i / 4))}
                    </text>
                  </g>
                ))}
                {metric === "flow" &&
                  device.backend?.parameters && (
                    <line
                      x1="44"
                      x2="744"
                      y1={164 - (params.threshold / maxY) * 140}
                      y2={164 - (params.threshold / maxY) * 140}
                      stroke="#e2ad55"
                      strokeDasharray="5 5"
                    />
                  )}
                <polygon
                  points={`44,164 ${chartPoints} ${44 + ((samples.length - 1) / 59) * 700},164`}
                  fill="url(#chart-fill)"
                />
                <polyline
                  points={chartPoints}
                  fill="none"
                  stroke="#0091dc"
                  strokeWidth="2.5"
                />
                {[0, 15, 30, 45, 59].map((i) => (
                  <text
                    key={i}
                    x={44 + (i / 59) * 700}
                    y="186"
                    textAnchor="middle"
                  >
                    {i}s
                  </text>
                ))}
              </svg>
            </div>
            <div className="chart-footer">
              <span>
                {metric === "flow" &&
                device.backend?.parameters
                  ? `${copy.threshold} ${params.threshold} l/min`
                  : ""}
              </span>
            </div>
          </Panel>
        </div>
        <div className="secondary-grid">
          <Panel
            title={copy.automaticParameters}
            extra={
              <button className="text-button" onClick={() => onOpenConfig()}>
                <Icon name="settings" size={16} />
                {copy.editParameters}
              </button>
            }
          >
            <div className="parameter-summary">
              {fields.slice(0, 4).map((f) => (
                <div key={f.key}>
                  <span>{language === "en" ? f.titleEn : f.title}</span>
                  <strong>
                    {device.backend?.parameters
                      ? params[f.key]
                      : "—"}{" "}
                    <small>{f.unit}</small>
                  </strong>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title={copy.consumptionManagement}>
            <div className="consumption-body">
              <div>
                <span>{copy.consumptionCost}</span>
                <strong>
                  {device.dataReady
                    ? `¥ ${(current.consumption * params.price).toFixed(2)}`
                    : "—"}
                </strong>
                <small>
                  {copy.estimatedAt} ¥ {params.price.toFixed(2)} / m³
                </small>
              </div>
              <button
                ref={resetTrigger}
                className="button"
                disabled={!device.canControl}
                onClick={() => setResetOpen(true)}
              >
                <Icon name="reset" size={16} />
                {copy.resetConsumption}
              </button>
            </div>
          </Panel>
        </div>
      </>
      {resetOpen && (
        <div className="modal-backdrop" onClick={closeReset}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") closeReset();
              if (e.key === "Tab") {
                e.preventDefault();
                const buttons = e.currentTarget.querySelectorAll("button");
                (document.activeElement === buttons[0]
                  ? buttons[1]
                  : buttons[0]
                ).focus();
              }
            }}
          >
            <div className="modal-icon">
              <Icon name="reset" size={26} />
            </div>
            <h2 id="reset-title">{copy.resetTitle}</h2>
            <p>
              {copy.resetMessage}{" "}
              <strong>{current.consumption.toFixed(3)} m³</strong>
              {copy.resetMessageEnd}
            </p>
            <div className="modal-actions">
              <button ref={cancelRef} className="button" onClick={closeReset}>
                {copy.cancel}
              </button>
              <button
                className="button primary"
                disabled={!device.canControl}
                onClick={async () => {
                  try {
                    await resetConsumption();
                    closeReset();
                    notify(copy.resetDone);
                  } catch (error) {
                    notify(
                      error instanceof Error ? error.message : String(error),
                    );
                  }
                }}
              >
                {copy.confirmReset}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

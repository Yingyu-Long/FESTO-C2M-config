import { useEffect, useRef, useState } from "react";
import type { Parameters } from "../../simulation";
import type { DeviceController } from "./useDevice";
import { fields } from "../config/fields";
import Icon from "../components/Icon";
import Panel from "../components/Panel";

const phaseNames = {
  NORMAL: "正常供气",
  WAIT: "低流量计时",
  HOLD: "等待开启自动待机",
  SHUTOFF: "切断降压",
  STANDBY: "待机保压",
  RISE: "恢复压力",
};

type DashboardProps = {
  params: Parameters;
  device: DeviceController;
  onOpenConfig: () => void;
  notify: (message: string) => void;
};

export default function Dashboard({
  params,
  device,
  onOpenConfig,
  notify,
}: DashboardProps) {
  const {
    mode,
    enabled,
    setEnabled,
    manualOpen,
    setManualOpen,
    running,
    setRunning,
    idle,
    setIdle,
    samples,
    updateCurrent,
    changeMode,
    resetTimer,
  } = device;
  const current = samples[samples.length - 1];
  const [metric, setMetric] = useState<"flow" | "pressure">("flow");
  const [resetOpen, setResetOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const resetTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (resetOpen) cancelRef.current?.focus();
  }, [resetOpen]);
  const valveOpen = mode === "user" ? manualOpen : current.phase !== "SHUTOFF";
  const leakEligible = !valveOpen && mode === "user";
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
              label: "当前流量",
              value: current.flow.toFixed(1),
              unit: "l/min",
              icon: "flow",
              detail: `低流量阈值 ${params.threshold} l/min`,
            },
            {
              label: "输出压力",
              value: current.pressure.toFixed(2),
              unit: "bar",
              icon: "pressure",
              detail: `目标压力 ${mode === "user" ? params.userPressure : ["SHUTOFF", "STANDBY"].includes(current.phase) ? params.standby : params.normal} bar`,
            },
            {
              label: "累计耗气量",
              value: current.consumption.toFixed(3),
              unit: "m³",
              icon: "total",
              detail: "本次累计",
            },
            {
              label: "压力变化",
              value: `${current.delta > 0 ? "+" : ""}${current.delta.toFixed(2)}`,
              unit: "bar/s",
              icon: "trend",
              detail: leak
                ? "压降异常，请检查"
                : leakEligible
                  ? "压降监测中"
                  : "切断后可评估泄漏",
            },
          ].map((m) => (
            <section className="metric-card" key={m.label}>
              <div className="metric-label">
                <span>{m.label}</span>
                <Icon name={m.icon} />
              </div>
              <div className="metric-value">
                {m.value}
                <span>{m.unit}</span>
              </div>
              <div className="metric-bottom">
                <span>{m.detail}</span>
              </div>
            </section>
          ))}
        </div>
        <div className="primary-grid">
          <Panel title="运行控制">
            <div className="control-body">
              <div className="label-row">
                <span>控制模式</span>
              </div>
              <div className="mode-switch" role="group" aria-label="控制模式">
                <button
                  className={mode === "auto" ? "selected" : ""}
                  onClick={() => changeMode("auto")}
                >
                  <Icon name="settings" />
                  自动模式
                </button>
                <button
                  className={mode === "user" ? "selected" : ""}
                  onClick={() => changeMode("user")}
                >
                  <Icon name="plug" />
                  手动模式
                </button>
              </div>
              {mode === "auto" ? (
                <>
                  <div className="setting-row">
                    <div>
                      <strong>自动待机</strong>
                    </div>
                    <button
                      className={`switch ${enabled ? "on" : ""}`}
                      role="switch"
                      aria-checked={enabled}
                      aria-label="自动待机"
                      onClick={() => setEnabled(!enabled)}
                    >
                      <span />
                    </button>
                  </div>
                  <div className="timer">
                    <div className="label-row">
                      <span>低流量计时</span>
                      <strong>
                        {Math.floor(current.elapsed / 60)}:
                        {String(current.elapsed % 60).padStart(2, "0")}{" "}
                        <span>/ {params.delay} min</span>
                      </strong>
                    </div>
                    <div className="progress">
                      <div
                        style={{
                          width: `${Math.min(100, (current.elapsed / Math.max(1, params.delay * 60)) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="timer-foot">
                      <span>{phaseNames[current.phase]}</span>
                      <button className="text-button" onClick={resetTimer}>
                        <Icon name="reset" size={14} />
                        恢复供气 / 重新计时
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="setting-row">
                    <div>
                      <strong>截止阀控制</strong>
                    </div>
                    <div className="segmented">
                      <button
                        className={manualOpen ? "selected" : ""}
                        onClick={() => setManualOpen(true)}
                      >
                        供气
                      </button>
                      <button
                        className={!manualOpen ? "selected" : ""}
                        onClick={() => setManualOpen(false)}
                      >
                        切断
                      </button>
                    </div>
                  </div>
                  <div className="manual-pressure">
                    <span>
                      手动目标压力{" "}
                      <strong>{params.userPressure.toFixed(1)} bar</strong>
                    </span>
                    <button
                      className="text-button"
                      onClick={() => onOpenConfig()}
                    >
                      调整压力 <Icon name="arrow" size={14} />
                    </button>
                  </div>
                </>
              )}
              <div className="control-status">
                <span className={`dot ${valveOpen ? "" : "muted"}`} />
                <strong>截止阀{valveOpen ? "已打开" : "已关闭"}</strong>
              </div>
            </div>
          </Panel>
          <Panel
            title="实时趋势"
            extra={
              <div className="segmented">
                <button
                  className={metric === "flow" ? "selected" : ""}
                  onClick={() => setMetric("flow")}
                >
                  流量
                </button>
                <button
                  className={metric === "pressure" ? "selected" : ""}
                  onClick={() => setMetric("pressure")}
                >
                  压力
                </button>
              </div>
            }
          >
            <div className="chart-meta">
              <span>
                <i className="legend-line" />
                {metric === "flow" ? "当前流量 (l/min)" : "输出压力 (bar)"}
              </span>
              <span>最近 60 秒</span>
            </div>
            <div className="chart">
              <svg
                viewBox="0 0 770 194"
                role="img"
                aria-label={`${metric === "flow" ? "流量" : "压力"}最近60个采样点趋势`}
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
                {metric === "flow" && (
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
              <span>{running ? "" : "更新已暂停"}</span>
              <span>
                {metric === "flow"
                  ? `虚线：阈值 ${params.threshold} l/min`
                  : ""}
              </span>
            </div>
          </Panel>
        </div>
        <div className="secondary-grid">
          <Panel
            title="自动控制参数"
            extra={
              <button className="text-button" onClick={() => onOpenConfig()}>
                <Icon name="settings" size={16} />
                编辑参数
              </button>
            }
          >
            <div className="parameter-summary">
              {fields.slice(0, 4).map((f) => (
                <div key={f.key}>
                  <span>{f.title}</span>
                  <strong>
                    {params[f.key]} <small>{f.unit}</small>
                  </strong>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="耗气量管理">
            <div className="consumption-body">
              <div>
                <span>累计用气成本</span>
                <strong>
                  ¥ {(current.consumption * params.price).toFixed(2)}
                </strong>
                <small>按 ¥ {params.price.toFixed(2)} / m³ 估算</small>
              </div>
              <button
                ref={resetTrigger}
                className="button"
                onClick={() => setResetOpen(true)}
              >
                <Icon name="reset" size={16} />
                重置耗气量
              </button>
            </div>
          </Panel>
        </div>
        <details className="demo-controls">
          <summary>演示控制</summary>
          <div className="demo-controls-body">
            <div className="segmented">
              <button
                className={!idle ? "selected" : ""}
                onClick={() => setIdle(false)}
              >
                设备运行
              </button>
              <button
                className={idle ? "selected" : ""}
                onClick={() => setIdle(true)}
              >
                设备停机
              </button>
            </div>
            <button
              className="text-button"
              onClick={() => setRunning(!running)}
            >
              {running ? "暂停演示" : "继续演示"}
            </button>
          </div>
        </details>
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
            <h2 id="reset-title">重置累计耗气量？</h2>
            <p>
              当前累计耗气量为{" "}
              <strong>{current.consumption.toFixed(3)} m³</strong>
              。重置后耗气量与成本归零。
            </p>
            <div className="modal-actions">
              <button ref={cancelRef} className="button" onClick={closeReset}>
                取消
              </button>
              <button
                className="button primary"
                onClick={() => {
                  updateCurrent({ consumption: 0 });
                  closeReset();
                  notify("累计耗气量已重置");
                }}
              >
                确认重置
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

import type { DeviceController } from "../dashboard/useDevice";
import { useState } from "react";
import type { FormEvent } from "react";
import type { Parameters } from "../types";
import { fields } from "./fields";
import Icon from "../components/Icon";
import Panel from "../components/Panel";
import { translations, type Language } from "../../translate";
import { isParameterDraft, parameterDraftKey, parametersToDraft, readStored, removeStored, writeStored } from "../persistence";
import type { ParameterDraft } from "../persistence";

type ConfigProps = {
  params: Parameters;
  onApply: (params: Parameters) => Promise<void>;
  device: DeviceController;
  notify: (message: string) => void;
  language: Language;
};

export default function Config({
  params,
  onApply,
  notify,
  language,
  device,
}: ConfigProps) {
  const draftKey = parameterDraftKey(device.settingsScope);
  const [savedDraft, setSavedDraft] = useState(()=>readStored(draftKey,isParameterDraft));
  const draft = savedDraft ?? parametersToDraft(params);
  function setDraft(next:ParameterDraft) {
    writeStored(draftKey,next);
    setSavedDraft(next);
  }
  function clearDraft() {
    removeStored(draftKey);
    setSavedDraft(null);
  }
  const [error, setError] = useState("");
  const copy = translations[language].config;
  if (!device.settingsReady) return <Panel title={copy.title}><p>{language==='zh'?'正在加载配置…':'Loading settings…'}</p></Panel>;
  async function saveParameters(e: FormEvent) {
    e.preventDefault();
    const next = Object.fromEntries(
      Object.entries(draft).map(([k, v]) => [k, Number(v)]),
    ) as Parameters;
    if (
      fields.some(
        (f) =>
          draft[f.key].trim() === "" ||
          !Number.isFinite(next[f.key]) ||
          next[f.key] < f.min ||
          next[f.key] > f.max,
      )
    ) {
      setError(copy.required);
      return;
    }
    if (next.normal <= next.standby) {
      setError(copy.pressureOrder);
      return;
    }
    try {
      await onApply(next);
      clearDraft();
      setError("");
      notify(copy.applied);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  }
  const dirty = fields.some(
    (f) => Number(draft[f.key]) !== params[f.key] || draft[f.key] === "",
  );
  return (
    <Panel
      title={copy.title}
      extra={
          <button
            className="text-button"
            disabled={device.busy || !device.backend?.canConfigure}
            onClick={async () => {
              try {
                const result = await device.refreshParameters();
                if (result.parameters) clearDraft();
                setError("");
              } catch (error) {
                setError(
                  error instanceof Error ? error.message : String(error),
                );
              }
            }}
          >
            {language === "zh" ? "读取设备参数" : "Read from device"}
          </button>
      }
    >
      <p className="device-notice">
          {language === "zh"
            ? "先读取设备参数，切换手动模式后再应用修改。"
            : "Read device parameters first. Switch to manual mode before applying changes."}
      </p>
      <form onSubmit={saveParameters}>
        <div className="form-grid">
          {fields.map((f) => (
            <label className="field" key={f.key}>
              <span>{language === "en" ? f.titleEn : f.title}</span>
              <div className="input-unit">
                <input
                  type="number"
                  disabled={device.busy}
                  required
                  min={f.min}
                  max={f.max}
                  step={f.key !== "delay" ? "any" : f.step}
                  value={draft[f.key]}
                  onChange={(e) =>
                    setDraft({ ...draft, [f.key]: e.target.value })
                  }
                />
                <span>{f.unit}</span>
              </div>
              <small>
                {copy.range} {f.min} – {f.max} {f.unit}
              </small>
            </label>
          ))}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <span>{dirty ? copy.unsaved : ""}</span>
          <button
            type="button"
            className="button"
            disabled={device.busy}
            onClick={() => {
              clearDraft();
              setError("");
            }}
          >
            {copy.undo}
          </button>
          <button
            className="button primary"
            type="submit"
            disabled={
              !dirty ||
              device.busy ||
              !device.backend?.canConfigure ||
              !device.backend.parameters ||
              device.mode === "auto"
            }
          >
            <Icon name="check" size={17} />
            {copy.apply}
          </button>
        </div>
      </form>
    </Panel>
  );
}

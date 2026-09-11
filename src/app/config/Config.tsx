import { useState } from "react";
import type { FormEvent } from "react";
import type { Parameters } from "../../simulation";
import { fields } from "./fields";
import Icon from "../components/Icon";
import Panel from "../components/Panel";
import { translations, type Language } from "../../translate";

type ConfigProps = {
  params: Parameters;
  onApply: (params: Parameters) => void;
  notify: (message: string) => void;
  language: Language;
};

export default function Config({
  params,
  onApply,
  notify,
  language,
}: ConfigProps) {
  const [draft, setDraft] = useState<Record<keyof Parameters, string>>(
    () =>
      Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v)]),
      ) as Record<keyof Parameters, string>,
  );
  const [error, setError] = useState("");
  const copy = translations[language].config;
  function saveParameters(e: FormEvent) {
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
    onApply(next);
    setError("");
    notify(copy.applied);
  }
  const dirty = fields.some(
    (f) => Number(draft[f.key]) !== params[f.key] || draft[f.key] === "",
  );
  return (
    <Panel title={copy.title}>
      <form onSubmit={saveParameters}>
        <div className="form-grid">
          {fields.map((f) => (
            <label className="field" key={f.key}>
              <span>{language === "en" ? f.titleEn : f.title}</span>
              <div className="input-unit">
                <input
                  type="number"
                  required
                  min={f.min}
                  max={f.max}
                  step={f.step}
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
            onClick={() => {
              setDraft(
                Object.fromEntries(
                  Object.entries(params).map(([k, v]) => [k, String(v)]),
                ) as Record<keyof Parameters, string>,
              );
              setError("");
            }}
          >
            {copy.undo}
          </button>
          <button className="button primary" type="submit" disabled={!dirty}>
            <Icon name="check" size={17} />
            {copy.apply}
          </button>
        </div>
      </form>
    </Panel>
  );
}

import { useState } from "react";
import type { FormEvent } from "react";
import type { Parameters } from "../../simulation";
import { fields } from "./fields";
import Icon from "../components/Icon";
import Panel from "../components/Panel";

type ConfigProps = {
  params: Parameters;
  onApply: (params: Parameters) => void;
  notify: (message: string) => void;
};

export default function Config({ params, onApply, notify }: ConfigProps) {
  const [draft, setDraft] = useState<Record<keyof Parameters, string>>(
    () =>
      Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v)]),
      ) as Record<keyof Parameters, string>,
  );
  const [error, setError] = useState("");
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
      setError("请检查参数范围，所有参数均为必填。");
      return;
    }
    if (next.normal <= next.standby) {
      setError("正常工作压力必须大于待机压力。");
      return;
    }
    onApply(next);
    setError("");
    notify("参数已应用");
  }
  const dirty = fields.some(
    (f) => Number(draft[f.key]) !== params[f.key] || draft[f.key] === "",
  );
  return (
    <Panel title="模块参数">
      <form onSubmit={saveParameters}>
        <div className="form-grid">
          {fields.map((f) => (
            <label className="field" key={f.key}>
              <span>{f.title}</span>
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
                范围 {f.min} – {f.max} {f.unit}
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
          <span>{dirty ? "尚未保存" : ""}</span>
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
            撤销修改
          </button>
          <button className="button primary" type="submit" disabled={!dirty}>
            <Icon name="check" size={17} />
            应用参数
          </button>
        </div>
      </form>
    </Panel>
  );
}

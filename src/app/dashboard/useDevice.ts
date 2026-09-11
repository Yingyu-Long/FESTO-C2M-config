import { useEffect, useState } from "react";
import { initial, step } from "../../simulation";
import type { Mode, Parameters, Snapshot } from "../../simulation";
import type { Language } from "../../i18n";

export function useDevice(
  params: Parameters,
  notify: (message: string) => void,
  language: Language,
) {
  const [mode, setMode] = useState<Mode>("auto");
  const [enabled, setEnabled] = useState(true);
  const [manualOpen, setManualOpen] = useState(true);
  const [running, setRunning] = useState(true);
  const [idle, setIdle] = useState(false);
  const [samples, setSamples] = useState<Snapshot[]>([initial]);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(
      () =>
        setSamples((s) => [
          ...s.slice(-59),
          step(s[s.length - 1], params, mode, enabled, manualOpen, idle),
        ]),
      1000,
    );
    return () => clearInterval(timer);
  }, [running, params, mode, enabled, manualOpen, idle]);
  function updateCurrent(update: Partial<Snapshot>) {
    setSamples((s) => [...s.slice(0, -1), { ...s[s.length - 1], ...update }]);
  }
  function changeMode(next: Mode) {
    setMode(next);
    setManualOpen(true);
    updateCurrent({ phase: "NORMAL", elapsed: 0 });
    notify(
      language === "en"
        ? `Switched to ${next === "auto" ? "automatic" : "manual"} mode`
        : `已切换至${next === "auto" ? "自动" : "手动"}模式`,
    );
  }
  function resetTimer() {
    updateCurrent({ elapsed: 0, phase: "RISE" });
    notify(
      language === "en"
        ? "Timer reset; restoring supply"
        : "计时已重置，正在恢复供气",
    );
  }
  return {
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
  };
}

export type DeviceController = ReturnType<typeof useDevice>;

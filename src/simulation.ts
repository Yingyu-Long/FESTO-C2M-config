export type Mode = "auto" | "user";
export type Phase = "NORMAL" | "WAIT" | "HOLD" | "SHUTOFF" | "STANDBY" | "RISE";
export type Parameters = {
  threshold: number;
  delay: number;
  normal: number;
  standby: number;
  userPressure: number;
  price: number;
  leakLimit: number;
};
export const defaults: Parameters = {
  threshold: 50,
  delay: 10,
  normal: 6,
  standby: 3,
  userPressure: 6,
  price: 0.12,
  leakLimit: 0.1,
};
export type Snapshot = {
  flow: number;
  pressure: number;
  consumption: number;
  elapsed: number;
  phase: Phase;
  tick: number;
  delta: number;
};
export const initial: Snapshot = {
  flow: 248,
  pressure: 6,
  consumption: 128.426,
  elapsed: 0,
  phase: "NORMAL",
  tick: 0,
  delta: 0,
};
export function step(
  s: Snapshot,
  p: Parameters,
  mode: Mode,
  enabled: boolean,
  manualOpen: boolean,
  idle: boolean,
): Snapshot {
  let phase = s.phase;
  let elapsed = s.elapsed;
  const demand = idle ? 12 : 248 + Math.sin(s.tick * 0.7) * 14;
  if (mode === "auto") {
    if (phase === "RISE") {
      if (s.pressure >= p.normal - 0.01) phase = "NORMAL";
    } else if (phase === "SHUTOFF") {
      if (s.pressure <= p.standby + 0.01) phase = "STANDBY";
    } else if (phase !== "STANDBY") {
      elapsed = demand < p.threshold ? elapsed + 1 : 0;
      phase =
        demand >= p.threshold
          ? "NORMAL"
          : elapsed > p.delay * 60
            ? enabled
              ? "SHUTOFF"
              : "HOLD"
            : "WAIT";
    }
  } else {
    phase = "NORMAL";
    elapsed = 0;
  }
  const open = mode === "user" ? manualOpen : phase !== "SHUTOFF";
  const target =
    mode === "user"
      ? open
        ? p.userPressure
        : 0
      : phase === "SHUTOFF" || phase === "STANDBY"
        ? p.standby
        : p.normal;
  const pressure = Math.max(
    0,
    s.pressure + Math.max(-0.5, Math.min(0.5, target - s.pressure)),
  );
  const flow = open ? demand * (phase === "STANDBY" ? 0.25 : 1) : 0;
  return {
    flow,
    pressure,
    consumption: s.consumption + flow / 60000,
    elapsed,
    phase,
    tick: s.tick + 1,
    delta: pressure - s.pressure,
  };
}

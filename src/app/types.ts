export type Mode = "auto" | "user";
export type Phase = "NORMAL" | "WAIT" | "HOLD" | "SHUTOFF" | "STANDBY" | "RISE" | "UNKNOWN";
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
  phase: Phase;
  tick: number;
  delta: number;
};

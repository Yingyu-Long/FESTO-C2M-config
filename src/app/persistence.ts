import type { Parameters } from "./types";
import type { Connection } from "./api";

export type ConnectionDraft = Record<keyof Connection, string>;
export type ParameterDraft = Record<keyof Parameters, string>;

export const storageKeys = {
  connection: "festo-c2m:connection:v1",
  connectionDraft: "festo-c2m:connection-draft:v1",
};
export const defaultConnection: Connection = {
  host: "192.168.1.10",
  port: 502,
  unit: 1,
  poll: 1000,
};
const parameterKeys: (keyof Parameters)[] = [
  "threshold",
  "delay",
  "normal",
  "standby",
  "userPressure",
  "price",
  "leakLimit",
];
const connectionKeys: (keyof Connection)[] = ["host", "port", "unit", "poll"];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function readStored<T>(
  key: string,
  valid: (value: unknown) => value is T,
): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    return valid(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    const raw = JSON.stringify(value);
    if (localStorage.getItem(key) !== raw) localStorage.setItem(key, raw);
  } catch {
    // Keep the form usable when browser storage is unavailable or full.
  }
}

export function removeStored(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* Storage can be disabled. */
  }
}

export function isConnection(value: unknown): value is Connection {
  return (
    isRecord(value) &&
    typeof value.host === "string" &&
    value.host.length > 0 &&
    ["port", "unit", "poll"].every((key) => Number.isInteger(value[key])) &&
    Number(value.port) >= 1 &&
    Number(value.port) <= 65535 &&
    Number(value.unit) >= 0 &&
    Number(value.unit) <= 255 &&
    Number(value.poll) >= 100 &&
    Number(value.poll) <= 60000
  );
}
export function isConnectionDraft(value: unknown): value is ConnectionDraft {
  return (
    isRecord(value) &&
    connectionKeys.every((key) => typeof value[key] === "string")
  );
}
export function isParameters(value: unknown): value is Parameters {
  return (
    isRecord(value) &&
    parameterKeys.every(
      (key) => typeof value[key] === "number" && Number.isFinite(value[key]),
    )
  );
}
export function isParameterDraft(value: unknown): value is ParameterDraft {
  return (
    isRecord(value) &&
    parameterKeys.every((key) => typeof value[key] === "string")
  );
}
export function connectionToDraft(value: Connection): ConnectionDraft {
  return {
    host: value.host,
    port: String(value.port),
    unit: String(value.unit),
    poll: String(value.poll),
  };
}
export function parametersToDraft(value: Parameters): ParameterDraft {
  return Object.fromEntries(
    parameterKeys.map((key) => [key, String(value[key])]),
  ) as ParameterDraft;
}
export function parameterScope(
  connection: Connection | null,
) {
  return connection
    ? `device:${JSON.stringify([connection.host.toLowerCase(), connection.port, connection.unit])}`
    : "device:unconfigured";
}
export const parameterStorageKey = (scope: string) =>
  `festo-c2m:parameters:v1:${scope}`;
export const parameterDraftKey = (scope: string) =>
  `festo-c2m:parameter-draft:v1:${scope}`;

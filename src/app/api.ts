import type { Parameters, Snapshot } from "./types";
export type Connection = {
  host: string;
  port: number;
  unit: number;
  poll: number;
};
export type DeviceStatus = {
  status: "disconnected" | "connecting" | "connected" | "error";
  connection: Connection | null;
  deviceInfo: { vendor: string; productCode: string; revision: string } | null;
  telemetry:
    | (Omit<Snapshot, "delta"> & {
        delta: number | null;
        timestamp: number;
        valveOpen: boolean;
        stateCode: number;
        timerState: number;
        consumptionRunning: boolean;
        consumptionBits: number;
      })
    | null;
  controls: {
    mode: "auto" | "user";
    enabled: boolean;
    manualOpen: boolean;
    resetPending: boolean;
    userPressure: number;
  } | null;
  parameters: Parameters | null;
  fresh: boolean;
  canWrite: boolean;
  canConfigure: boolean;
  mappingReady: boolean;
  readingEnabled: boolean;
  warnings: string[];
  lastError: { code: string; message: string } | null;
};
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
  const responseText = await response.text();
  let data: T & { error?: { message?: string } };
  try {
    data = responseText
      ? (JSON.parse(responseText) as T & { error?: { message?: string } })
      : ({} as T & { error?: { message?: string } });
  } catch {
    throw new Error(
      `Invalid server response (${response.status} ${response.statusText})`,
    );
  }
  if (!response.ok)
    throw new Error(
      data.error?.message ||
        (responseText.trim()
          ? `Request failed (${response.status}): ${responseText}`
          : `Backend request failed (${response.status} ${response.statusText})`),
    );
  return data as T;
}

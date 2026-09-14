import { readFile } from "node:fs/promises";

export const defaultConfig = {
  mappingConfirmed: false,
  writesEnabled: false,
  inputBase: null,
  outputBase: null,
  outputEchoBase: null,
  diagnosticInput: null,
  diagnosticOutput: null,
  moduleNumber: 0,
  swapProcessBytes: false,
  pressureUnit: "mbar",
  flowUnit: "l/min",
  consumptionUnit: "l",
  timeout: 2000,
  pulseMs: 150,
};
export async function loadConfig(
  path = process.env.FB36_CONFIG,
  localPath = new URL("./fb36.config.local.json", import.meta.url),
) {
  let saved = {};
  try {
    saved = JSON.parse(await readFile(path || localPath, "utf8"));
    if (!saved || typeof saved !== "object" || Array.isArray(saved))
      throw new Error("Device configuration must be a JSON object");
  } catch (error) {
    if (path || error.code !== "ENOENT") throw error;
  }
  const config = {
    ...defaultConfig,
    ...saved,
  };
  for (const [key, count] of [
    ["inputBase", 7],
    ["outputBase", 3],
    ["outputEchoBase", 3],
    ["diagnosticInput", 2],
    ["diagnosticOutput", 2],
  ]) {
    const n = config[key];
    if (n !== null && (!Number.isInteger(n) || n < 0 || n + count > 65536))
      throw new Error(`Invalid zero-based address: ${key}`);
  }
  for (const key of ["mappingConfirmed", "writesEnabled", "swapProcessBytes"])
    if (typeof config[key] !== "boolean") throw new Error(`Invalid ${key}`);
  if (
    !Number.isInteger(config.moduleNumber) ||
    config.moduleNumber < 0 ||
    config.moduleNumber > 47
  )
    throw new Error("Invalid module number");
  if (
    !Number.isInteger(config.timeout) ||
    config.timeout < 200 ||
    config.timeout > 10000
  )
    throw new Error("Invalid timeout");
  if (
    !Number.isInteger(config.pulseMs) ||
    config.pulseMs < 50 ||
    config.pulseMs > 2000
  )
    throw new Error("Invalid pulse duration");
  if (
    !["mbar", "kPa", "psi/10"].includes(config.pressureUnit) ||
    !["l/min", "scfm/10"].includes(config.flowUnit) ||
    !["l", "m3", "scf"].includes(config.consumptionUnit)
  )
    throw new Error("Invalid configured units");
  if (config.mappingConfirmed && config.inputBase === null)
    throw new Error("Reading requires inputBase");
  if (
    config.writesEnabled &&
    (!config.mappingConfirmed ||
      config.outputBase === null ||
      config.outputEchoBase === null)
  )
    throw new Error("Writing requires confirmed input/output/echo mapping");
  if ((config.diagnosticInput === null) !== (config.diagnosticOutput === null))
    throw new Error("Configure both diagnostic addresses");
  const overlaps = (a, n, b, m) =>
    a !== null && b !== null && a < b + m && b < a + n;
  if (
    overlaps(config.inputBase, 7, config.outputEchoBase, 3) ||
    overlaps(config.inputBase, 7, config.diagnosticInput, 2) ||
    overlaps(config.outputEchoBase, 3, config.diagnosticInput, 2) ||
    overlaps(config.outputBase, 3, config.diagnosticOutput, 2)
  )
    throw new Error("Configured process/diagnostic ranges overlap");
  return config;
}
export function connectionConfig(body) {
  if (
    !body ||
    typeof body.host !== "string" ||
    body.host.length > 253 ||
    !/^[a-zA-Z0-9][a-zA-Z0-9.:-]*$/.test(body.host)
  )
    throw new Error("Invalid device host");
  const result = { host: body.host };
  for (const [key, min, max] of [
    ["port", 1, 65535],
    ["unit", 0, 255],
    ["poll", 100, 60000],
  ]) {
    if (!Number.isInteger(body[key]) || body[key] < min || body[key] > max)
      throw Object.assign(new Error(`Invalid ${key}`), { status: 400 });
    result[key] = body[key];
  }
  return result;
}

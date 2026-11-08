const DEFAULT_BASE_URL = "https://hackertube.org";
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_USER_AGENT = "hackertube-mcp/0.1.0";
const DEFAULT_DATA_DIR = process.env.NODE_ENV === "production" ? "/data" : "./data";

/**
 * @typedef {object} Config
 * @property {string} baseUrl
 * @property {number} timeoutMs
 * @property {string} dataDir
 * @property {string} userAgent
 */

/**
 * Parse and validate configuration from an environment-like object.
 * @param {Record<string, string | undefined>} [env]
 * @returns {Config}
 */
export function loadConfig(env = process.env) {
  const baseUrl = normalizeBaseUrl(env.HACKERTUBE_BASE_URL ?? DEFAULT_BASE_URL);
  const timeoutMs = parseTimeout(env.HACKERTUBE_TIMEOUT_MS);
  const dataDir = (env.HACKERTUBE_DATA_DIR ?? DEFAULT_DATA_DIR).trim() || "./data";
  const userAgent = (env.HACKERTUBE_USER_AGENT ?? DEFAULT_USER_AGENT).trim() || DEFAULT_USER_AGENT;
  return { baseUrl, timeoutMs, dataDir, userAgent };
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeBaseUrl(value) {
  const trimmed = value.trim();
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`HACKERTUBE_BASE_URL is not a valid URL: ${trimmed}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("HACKERTUBE_BASE_URL must use http or https");
  }
  return url.toString().replace(/\/+$/, "");
}

/**
 * @param {string | undefined} value
 * @returns {number}
 */
function parseTimeout(value) {
  if (value === undefined || value.trim() === "") return DEFAULT_TIMEOUT_MS;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1_000 || parsed > 120_000) {
    throw new Error("HACKERTUBE_TIMEOUT_MS must be an integer between 1000 and 120000");
  }
  return parsed;
}

export const defaults = {
  baseUrl: DEFAULT_BASE_URL,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  userAgent: DEFAULT_USER_AGENT,
};

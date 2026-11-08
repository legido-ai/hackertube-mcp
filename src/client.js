import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadConfig } from "./config.js";
import { compactComment, compactPlaylist, compactVideo, normalizeSearch, normalizeVideoList } from "./format.js";

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export class HackerTubeError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {{status?: number, cause?: unknown}} [options]
   */
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = "HackerTubeError";
    this.code = code;
    this.status = options.status;
  }
}

/**
 * @typedef {object} HackerTubeClientOptions
 * @property {ReturnType<typeof loadConfig>} [config]
 * @property {typeof fetch} [fetchImpl]
 */

export class HackerTubeClient {
  /**
   * @param {HackerTubeClientOptions} [options]
   */
  constructor(options = {}) {
    this.config = options.config ?? loadConfig();
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (typeof this.fetchImpl !== "function") {
      throw new Error("A fetch implementation is required");
    }
  }

  /**
   * @param {string} pathname
   * @param {Record<string, unknown>} [params]
   * @returns {Promise<any>}
   */
  async requestJson(pathname, params = {}) {
    const response = await this.request(pathname, params);
    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new HackerTubeError("upstream_protocol", "HackerTube returned invalid JSON.", { cause: error });
    }
    return payload;
  }

  /**
   * @param {string} pathname
   * @param {Record<string, unknown>} [params]
   * @returns {Promise<Response>}
   */
  async request(pathname, params = {}) {
    const url = new URL(pathname, `${this.config.baseUrl}/`);
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "" || value === false) continue;
      if (Array.isArray(value)) {
        if (value.length === 0) continue;
        url.searchParams.set(key, value.join(","));
      } else if (value === true) {
        url.searchParams.set(key, "1");
      } else {
        url.searchParams.set(key, String(value));
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let response;
    try {
      response = await this.fetchImpl(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": this.config.userAgent,
        },
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new HackerTubeError(
          "timeout",
          `HackerTube did not respond within ${this.config.timeoutMs} ms.`,
          { cause: error },
        );
      }
      throw new HackerTubeError("upstream_unavailable", "Could not reach HackerTube.", { cause: error });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      this.throwForStatus(response.status, pathname);
    }
    return response;
  }

  /**
   * @param {number} status
   * @param {string} pathname
   */
  throwForStatus(status, pathname) {
    if (status === 404) {
      throw new HackerTubeError("not_found", `HackerTube has no record for ${pathname}.`, { status });
    }
    if (status === 429) {
      throw new HackerTubeError("rate_limited", "HackerTube is rate limiting requests; retry shortly.", { status });
    }
    if (status >= 500) {
      throw new HackerTubeError("upstream_unavailable", "HackerTube is temporarily unavailable.", { status });
    }
    throw new HackerTubeError("upstream_unavailable", `HackerTube returned HTTP ${status}.`, { status });
  }

  /**
   * @param {object} input
   * @param {string} input.query
   * @param {number} [input.limit]
   * @param {string} [input.contentType]
   * @param {string} [input.duration]
   * @param {string} [input.date]
   * @param {string} [input.sort]
   * @param {boolean} [input.hiddenGems]
   * @param {boolean} [input.evergreenOnly]
   */
  async search(input) {
    const query = requireNonEmpty(input.query, "query");
    const limit = clampInt(input.limit ?? 10, 1, 25, "limit");
    const payload = await this.requestJson("/api/search", {
      q: query,
      type: input.contentType,
      dur: input.duration,
      date: input.date,
      sort: input.sort,
      gems: input.hiddenGems ? "1" : undefined,
      evergreen: input.evergreenOnly ? "1" : undefined,
    });
    const normalized = normalizeSearch(payload, limit);
    return { query, weak: normalized.weak, count: normalized.results.length, results: normalized.results };
  }

  /**
   * @param {string} vid
   * @param {{includeComments?: boolean, maxComments?: number}} [options]
   */
  async video(vid, options = {}) {
    const id = requireVideoId(vid);
    const payload = await this.requestJson("/api/video", { vid: id });
    if (!payload || typeof payload !== "object" || !payload.video) {
      throw new HackerTubeError("upstream_protocol", "HackerTube returned a video response without a video record.");
    }
    const includeComments = options.includeComments !== false;
    const maxComments = clampInt(options.maxComments ?? 10, 0, 20, "max_comments");
    const comments = includeComments && Array.isArray(payload.comments)
      ? payload.comments.slice(0, maxComments).map(compactComment)
      : [];
    return { video: compactVideo(payload.video), comments };
  }

  /**
   * @param {string} vid
   * @param {number} [limit]
   */
  async related(vid, limit = 10) {
    const id = requireVideoId(vid);
    const count = clampInt(limit, 1, 25, "limit");
    const payload = await this.requestJson("/api/related", { vid: id, n: count });
    const results = normalizeVideoList(payload, count);
    return { vid: id, count: results.length, results };
  }

  async browse() {
    const payload = await this.requestJson("/api/browse");
    if (!Array.isArray(payload)) {
      throw new HackerTubeError("upstream_protocol", "HackerTube returned an unexpected browse response.");
    }
    return { count: payload.length, areas: payload };
  }

  async playlists() {
    const payload = await this.requestJson("/api/playlists");
    if (!Array.isArray(payload)) {
      throw new HackerTubeError("upstream_protocol", "HackerTube returned an unexpected playlist list.");
    }
    return { count: payload.length, playlists: payload.map((playlist) => compactPlaylist(playlist)) };
  }

  /**
   * @param {string} slug
   */
  async playlist(slug) {
    const value = requireNonEmpty(slug, "slug");
    const payload = await this.requestJson("/api/playlist", { slug: value });
    return compactPlaylist(payload, { includeVideos: true });
  }

  /**
   * @param {object} [input]
   * @param {number} [input.limit]
   * @param {number} [input.offset]
   * @param {number} [input.seed]
   * @param {string[]} [input.liked]
   * @param {string[]} [input.disliked]
   * @param {string[]} [input.seen]
   */
  async feed(input = {}) {
    const limit = clampInt(input.limit ?? 20, 1, 36, "limit");
    const offset = clampInt(input.offset ?? 0, 0, 10_000, "offset");
    const seed = input.seed ?? Math.floor(Math.random() * 1_000_000_000);
    const payload = await this.requestJson("/api/feed", {
      n: limit,
      offset,
      seed,
      like: input.liked,
      dislike: input.disliked,
      seen: input.seen,
    });
    const results = normalizeVideoList(payload, limit);
    return { seed, offset, count: results.length, results };
  }

  async stats() {
    const payload = await this.requestJson("/api/stats");
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new HackerTubeError("upstream_protocol", "HackerTube returned unexpected corpus stats.");
    }
    return { ...payload, source: "https://hackertube.org", generated_at: new Date().toISOString() };
  }

  async dataset() {
    const payload = await this.requestJson("/api/export");
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new HackerTubeError("upstream_protocol", "HackerTube returned an unexpected export manifest.");
    }
    const files = Array.isArray(payload.files) ? payload.files : [];
    return {
      ...payload,
      zip: payload.zip
        ? { ...payload.zip, download_url: downloadUrl(payload.zip.name) }
        : null,
      files: files.map((file) => ({ ...file, download_url: downloadUrl(file.name) })),
    };
  }

  /**
   * Download one file advertised by the HackerTube export manifest.
   * @param {string} filename
   * @param {string} [outputDir]
   */
  async downloadDataset(filename, outputDir) {
    const name = requireSafeFilename(filename);
    const manifest = await this.dataset();
    const advertised = [manifest.zip, ...manifest.files].filter(Boolean);
    const entry = advertised.find((file) => file.name === name);
    if (!entry) {
      throw new HackerTubeError(
        "download_rejected",
        `"${name}" is not in the HackerTube export manifest.`,
      );
    }

    const directory = path.resolve(outputDir || this.config.dataDir);
    await mkdir(directory, { recursive: true, mode: 0o755 });
    const target = path.resolve(directory, name);
    if (!target.startsWith(`${directory}${path.sep}`)) {
      throw new HackerTubeError("download_rejected", "Resolved download path escapes the data directory.");
    }

    let response;
    try {
      response = await this.request(`/download/${encodeURIComponent(name)}`);
    } catch (error) {
      if (error instanceof HackerTubeError && error.code === "not_found") {
        throw new HackerTubeError("download_failed", `HackerTube no longer serves ${name}.`, { cause: error });
      }
      throw error;
    }

    let bytes;
    try {
      bytes = Buffer.from(await response.arrayBuffer());
    } catch (error) {
      throw new HackerTubeError("download_failed", `Could not read ${name} from HackerTube.`, { cause: error });
    }

    try {
      await writeFile(target, bytes, { mode: 0o644 });
    } catch (error) {
      throw new HackerTubeError("download_failed", `Could not save ${name}: ${error?.code ?? "filesystem error"}.`, {
        cause: error,
      });
    }

    return { filename: name, path: target, bytes: bytes.byteLength, rows: entry.rows ?? null };
  }
}

/**
 * @param {string} name
 * @returns {string}
 */
function downloadUrl(name) {
  return `https://hackertube.org/download/${encodeURIComponent(name)}`;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HackerTubeError("invalid_input", `${field} must be a non-empty string.`);
  }
  return value.trim();
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function requireVideoId(value) {
  if (typeof value !== "string" || !VIDEO_ID.test(value)) {
    throw new HackerTubeError("invalid_input", "vid must be an 11-character YouTube id.");
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {string} field
 * @returns {number}
 */
function clampInt(value, min, max, field) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new HackerTubeError("invalid_input", `${field} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function requireSafeFilename(value) {
  const name = requireNonEmpty(value, "filename");
  if (name !== path.basename(name) || name === "." || name === ".." || name.includes("\0")) {
    throw new HackerTubeError("download_rejected", "filename must be a plain name, not a path.");
  }
  return name;
}

/**
 * Compact projections for HackerTube records.
 *
 * The upstream payload is rich; returning it verbatim would consume an agent's
 * context. These helpers keep the decision-relevant fields and add canonical
 * links.
 */

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

/**
 * @param {any} video
 * @returns {Array<{id: string, name: string, area?: string, area_name?: string}>}
 */
function compactCategories(video) {
  if (!Array.isArray(video?.categories)) return [];
  return video.categories
    .filter((category) => category && typeof category === "object")
    .map((category) => ({
      id: String(category.id ?? ""),
      name: String(category.name ?? ""),
      area: category.area ? String(category.area) : undefined,
      area_name: category.area_name ? String(category.area_name) : undefined,
    }))
    .filter((category) => category.id || category.name);
}

/**
 * @param {any} video
 * @returns {any}
 */
export function compactVideo(video) {
  if (!video || typeof video !== "object" || typeof video.vid !== "string") {
    throw new TypeError("video record is missing a vid");
  }
  const vid = video.vid;
  return {
    vid,
    title: video.title ?? "",
    channel: video.channel ?? "",
    published: video.published ?? null,
    duration_s: video.duration_s ?? null,
    views: video.views ?? null,
    likes: video.likes ?? null,
    content_type: video.content_type ?? null,
    level: video.level ?? null,
    shelf_life: video.shelf_life ?? null,
    primary_topic: video.primary_topic ?? null,
    summary: video.summary ?? "",
    why_hn: video.why_hn ?? "",
    tags: stringArray(video.tags),
    categories: compactCategories(video),
    score: video.score ?? null,
    hn: video.hn ?? null,
    quote: video.quote ?? null,
    thumbnail: video.thumbnail ?? `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`,
    hackertube_url: `https://hackertube.org/watch/${vid}`,
    youtube_url: `https://www.youtube.com/watch?v=${vid}`,
  };
}

/**
 * @param {any} comment
 * @returns {any}
 */
export function compactComment(comment) {
  const id = comment?.id;
  return {
    id,
    author: comment?.author ?? "",
    ym: comment?.ym ?? "",
    story: comment?.story ?? "",
    stance: comment?.stance ?? "",
    why: comment?.why ?? "",
    quote: comment?.quote ?? "",
    text: comment?.text ?? "",
    hn_url: id == null ? null : `https://news.ycombinator.com/item?id=${id}`,
  };
}

/**
 * @param {any} playlist
 * @param {{includeVideos?: boolean}} [options]
 * @returns {any}
 */
export function compactPlaylist(playlist, options = {}) {
  if (!playlist || typeof playlist !== "object") {
    throw new TypeError("playlist record is invalid");
  }
  const result = {
    slug: playlist.slug ?? "",
    title: playlist.title ?? "",
    pitch: playlist.pitch ?? "",
    intro: playlist.intro ?? "",
    tier: playlist.tier ?? null,
    kind: playlist.kind ?? null,
    minutes: playlist.minutes ?? null,
    count: playlist.count ?? (Array.isArray(playlist.videos) ? playlist.videos.length : null),
    cover: stringArray(playlist.cover),
    hackertube_url: playlist.slug ? `https://hackertube.org/p/${playlist.slug}` : null,
  };
  if (options.includeVideos && Array.isArray(playlist.videos)) {
    result.videos = playlist.videos.map(compactVideo);
  }
  return result;
}

/**
 * @param {unknown} payload
 * @param {number} limit
 * @returns {{weak: boolean, results: any[]}}
 */
export function normalizeSearch(payload, limit) {
  const weak = Boolean(payload && typeof payload === "object" && payload.weak);
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.results)
      ? payload.results
      : [];
  return { weak, results: raw.slice(0, limit).map(compactVideo) };
}

/**
 * @param {unknown} payload
 * @param {number} limit
 * @returns {any[]}
 */
export function normalizeVideoList(payload, limit) {
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.results)
      ? payload.results
      : [];
  return raw.slice(0, limit).map(compactVideo);
}

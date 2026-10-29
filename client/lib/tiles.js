export const TILE_CACHE = "dandong-tiles-v1";

const CITY = { south: 39.98, west: 124.22, north: 40.28, east: 124.58 };
const CORE = { south: 40.08, west: 124.34, north: 40.16, east: 124.42 };
const BRIDGES = { south: 40.1, west: 124.35, north: 40.14, east: 124.41 };
const MAX_TILES = 160;

function lngToX(lng, zoom) {
  return Math.floor(((lng + 180) / 360) * 2 ** zoom);
}

function latToY(lat, zoom) {
  const radians = (lat * Math.PI) / 180;
  const mercator = Math.log(Math.tan(radians) + 1 / Math.cos(radians));
  return Math.floor(((1 - mercator / Math.PI) / 2) * 2 ** zoom);
}

function tilesFor(bounds, zoom) {
  let x1 = lngToX(bounds.west, zoom);
  let x2 = lngToX(bounds.east, zoom);
  let y1 = latToY(bounds.north, zoom);
  let y2 = latToY(bounds.south, zoom);
  if (x2 < x1) [x1, x2] = [x2, x1];
  if (y2 < y1) [y1, y2] = [y2, y1];
  const urls = [];
  for (let x = x1; x <= x2; x += 1) {
    for (let y = y1; y <= y2; y += 1) {
      urls.push(`https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`);
    }
  }
  return urls;
}

export function planTileUrls() {
  const groups = [
    { bounds: CITY, zooms: [12, 13] },
    { bounds: CORE, zooms: [14] },
    { bounds: BRIDGES, zooms: [15] },
  ];
  const urls = [];
  const seen = new Set();
  for (const group of groups) {
    for (const zoom of group.zooms) {
      for (const url of tilesFor(group.bounds, zoom)) {
        if (seen.has(url)) continue;
        if (urls.length >= MAX_TILES) return urls;
        seen.add(url);
        urls.push(url);
      }
    }
  }
  return urls;
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function prefetchTiles(urls, onProgress) {
  if (!("caches" in window)) {
    throw new Error("This browser can't store map tiles.");
  }
  const cache = await caches.open(TILE_CACHE);
  let done = 0;
  let failed = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < urls.length) {
      const url = urls[cursor];
      cursor += 1;
      try {
        const hit = await cache.match(url, { ignoreVary: true });
        if (!hit) {
          const response = await fetch(url, {
            mode: "cors",
            signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
          });
          if (!response.ok) failed += 1;
          else await cache.put(url, response);
          await wait(60);
        }
      } catch {
        failed += 1;
      }
      done += 1;
      onProgress({ done, total: urls.length, failed });
    }
  }

  await Promise.all([worker(), worker()]);
  return { total: urls.length, failed };
}

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200, extraHeaders: Record<string, string> = {}) =>
  Response.json(body, {
    status,
    headers: {...corsHeaders, "content-type": "application/json; charset=utf-8", ...extraHeaders},
  });

const feeds: Record<string, string[]> = {
  deportes: [
    "https://e00-marca.uecdn.es/rss/portada.xml",
    "https://as.com/rss/tags/ultimas_noticias.xml",
    "https://www.mundodeportivo.com/rss/home.xml",
    "https://www.rtve.es/api/noticias/deportes.rss",
    "https://news.google.com/rss/search?q=%22Fabrizio%20Romano%22%20OR%20site%3Amundodeportivo.com%20OR%20site%3Asport.es&hl=es&gl=ES&ceid=ES%3Aes",
  ],
  espana: [
    "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada",
    "https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml",
    "https://www.rtve.es/api/noticias.rss",
    "https://www.20minutos.es/rss/",
    "https://www.europapress.es/rss/rss.aspx",
  ],
  mundo: [
    "https://feeds.bbci.co.uk/mundo/rss.xml",
    "https://es.euronews.com/rss?level=theme&name=news",
    "https://www.france24.com/es/rss",
    "https://rss.dw.com/rdf/rss-sp-all",
    "https://www.rtve.es/api/noticias/internacional.rss",
  ],
};

// Edge isolates are reused, so keep a short in-memory news cache and coalesce
// refreshes. This makes category switches and repeat visits return immediately.
const NEWS_TTL_MS = 90_000;
const newsCache = new Map<string, {items: ReturnType<typeof parseFeed>; sources: number; refreshedAt: string; savedAt: number}>();
const refreshes = new Map<string, Promise<{items: ReturnType<typeof parseFeed>; sources: number; refreshedAt: string} | null>>();

function decodeXml(value = "") {
  const named: Record<string, string> = {amp: "&", quot: "\"", apos: "'", lt: "<", gt: ">", nbsp: " "};
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(x?[0-9a-f]+);/gi, (entity, code) => {
      const cp = parseInt(code.replace(/^x/i, ""), /^x/i.test(code) ? 16 : 10);
      return Number.isInteger(cp) && cp >= 0 && cp <= 0x10ffff && (cp < 0xd800 || cp > 0xdfff)
        ? String.fromCodePoint(cp)
        : entity;
    })
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLowerCase()] ?? entity)
    .replace(/<[^>]+>/g, "")
    .trim();
}

function tag(item: string, name: string) {
  return decodeXml(item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] || "");
}

// Only URLs supplied by the configured publishers' feeds are used. No article scraping.
function safeFeedUrl(value: string) {
  try {
    const url = new URL(decodeXml(value).replace(/^\/\//, "https://"));
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
}

function feedImage(item: string) {
  const attribute = (element: string, name: string) =>
    element.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1] || "";
  for (const match of item.matchAll(/<(?:media:content|media:thumbnail|enclosure)\b[^>]*>/gi)) {
    const element = match[0];
    const type = attribute(element, "type");
    const medium = attribute(element, "medium");
    if (/^<enclosure/i.test(element) && !/^image\//i.test(type)) continue;
    if (/^<media:content/i.test(element) && (type && !/^image\//i.test(type) || medium && medium !== "image")) continue;
    const image = safeFeedUrl(attribute(element, "url"));
    if (image) return image;
  }
  // Description images can be CDATA HTML or entity-escaped HTML.
  const description = item.match(/<(?:description|content:encoded)(?:\s[^>]*)?>([\s\S]*?)<\/(?:description|content:encoded)>/i)?.[1] || "";
  const html = description.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"');
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const image = safeFeedUrl(attribute(match[0], "src"));
    if (image) return image;
  }
  const image = item.match(/<image(?:\s[^>]*)?>([\s\S]*?)<\/image>/i)?.[1] || "";
  return safeFeedUrl(tag(image, "url") || image);
}

function parseFeed(xml: string) {
  const channelSource = tag(xml.slice(0, Math.max(0, xml.search(/<item(?:\s|>)/i))), "title");
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(match => {
    const item = match[1];
    const title = tag(item, "title");
    const source = tag(item, "source") || channelSource || title.split(" - ").pop() || "Medio de comunicación";
    return {
      title,
      link: safeFeedUrl(tag(item, "link") || tag(item, "guid")),
      image: feedImage(item),
      summary: tag(item, "description").replace(/\s+/g, " ").slice(0, 300),
      published: tag(item, "pubDate") || tag(item, "dc:date") || tag(item, "published") || tag(item, "updated") || tag(item, "date"),
      source,
    };
  }).filter(item => item.title && item.link);
}

async function fetchFeed(url: string) {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.7",
      "User-Agent": "Mozilla/5.0 (compatible; TheBigBoyRules/1.0; +https://raulculsan.github.io/The-Big-Boy-Rules/)",
    },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`RSS ${response.status}`);
  return parseFeed(await response.text());
}

function combine(results: PromiseSettledResult<ReturnType<typeof parseFeed>>[]) {
  const fulfilled = results.filter((result): result is PromiseFulfilledResult<ReturnType<typeof parseFeed>> => result.status === "fulfilled");
  const seen = new Set<string>();
  const items = fulfilled.flatMap(result => result.value)
    .sort((a, b) => (Date.parse(b.published) || 0) - (Date.parse(a.published) || 0))
    .filter(item => {
      const key = item.title.toLocaleLowerCase("es").replace(/\s+-\s+[^-]+$/, "").replace(/\W+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 30);
  return items.length ? {items, sources: fulfilled.length, refreshedAt: new Date().toISOString()} : null;
}

function refreshCategory(category: string) {
  const existing = refreshes.get(category);
  if (existing) return existing;
  const urls = feeds[category];
  const settled: PromiseSettledResult<ReturnType<typeof parseFeed>>[] = [];
  let completeCount = 0, successCount = 0, resolveFirst!: (value: ReturnType<typeof combine>) => void;
  const firstBatch = new Promise<ReturnType<typeof combine>>(resolve => { resolveFirst = resolve; });
  let firstBatchResolved = false;
  const publishFirstBatch = () => {
    if (firstBatchResolved || (successCount < 2 && completeCount < urls.length)) return;
    firstBatchResolved = true;
    resolveFirst(combine(settled));
  };
  const requests = urls.map(url => fetchFeed(url).then(value => {
    settled.push({status:"fulfilled", value}); successCount++;
  }, reason => settled.push({status:"rejected", reason})).finally(() => {
    completeCount++;
    publishFirstBatch();
  }));
  const completion = Promise.all(requests).then(() => {
    const result = combine(settled);
    if (result) newsCache.set(category, {...result, savedAt: Date.now()});
    return result;
  }).finally(() => refreshes.delete(category));
  const runtime = globalThis as typeof globalThis & {EdgeRuntime?: {waitUntil?: (promise: Promise<unknown>) => void}};
  runtime.EdgeRuntime?.waitUntil?.(completion);
  const pending = firstBatch.then(result => {
    if (result && !newsCache.has(category)) newsCache.set(category, {...result, savedAt: Date.now()});
    return result;
  });
  refreshes.set(category, pending);
  return pending;
}

function newsResponse(value: {items: ReturnType<typeof parseFeed>; sources: number; refreshedAt: string}, cached = false) {
  return json({...value, cached}, 200, {"Cache-Control": "private, max-age=30, stale-while-revalidate=90"});
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return new Response("ok", {headers: corsHeaders});
    if (request.method !== "POST") return json({error: "Método no permitido."}, 405);

    let category = "deportes";
    try {
      const body = await request.json();
      category = String(body?.category || category);
    } catch {
      return json({error: "Petición no válida."}, 400);
    }
    if (!feeds[category]) return json({error: "Categoría no válida."}, 400);

    const cached = newsCache.get(category);
    if (cached && Date.now() - cached.savedAt < NEWS_TTL_MS) return newsResponse(cached, true);

    const refresh = refreshCategory(category);
    // Stale headlines are useful immediately while RSS publishers refresh.
    if (cached) {
      const runtime = globalThis as typeof globalThis & {EdgeRuntime?: {waitUntil?: (promise: Promise<unknown>) => void}};
      runtime.EdgeRuntime?.waitUntil?.(refresh);
      return newsResponse(cached, true);
    }

    const result = await refresh;
    if (!result) return json({error: "Las fuentes no devolvieron titulares."}, 502);
    return newsResponse(result);
  },
};

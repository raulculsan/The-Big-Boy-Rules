import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, {
    status,
    headers: {...corsHeaders, "content-type": "application/json; charset=utf-8"},
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

function decodeXml(value = "") {
  const named: Record<string, string> = {amp: "&", quot: "\"", apos: "'", lt: "<", gt: ">", nbsp: " "};
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(x?[0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code.replace(/^x/i, ""), /^x/i.test(code) ? 16 : 10)))
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLowerCase()] ?? entity)
    .replace(/<[^>]+>/g, "")
    .trim();
}

function tag(item: string, name: string) {
  return decodeXml(item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] || "");
}

function parseFeed(xml: string) {
  const channelSource = tag(xml.slice(0, Math.max(0, xml.search(/<item(?:\s|>)/i))), "title");
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(match => {
    const item = match[1];
    const title = tag(item, "title");
    const source = tag(item, "source") || channelSource || title.split(" - ").pop() || "Medio de comunicación";
    return {
      title,
      link: tag(item, "link") || tag(item, "guid"),
      published: tag(item, "pubDate") || tag(item, "published") || tag(item, "updated"),
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
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`RSS ${response.status}`);
  return parseFeed(await response.text());
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

    const results = await Promise.allSettled(feeds[category].map(fetchFeed));
    const fulfilled = results.filter((result): result is PromiseFulfilledResult<ReturnType<typeof parseFeed>> => result.status === "fulfilled");
    const combined = fulfilled.flatMap(result => result.value);
    const seen = new Set<string>();
    const items = combined
      .sort((a, b) => Date.parse(b.published) - Date.parse(a.published))
      .filter(item => {
        const key = item.title.toLocaleLowerCase("es").replace(/\s+-\s+[^-]+$/, "").replace(/\W+/g, " ").trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 40);

    if (!items.length) {
      const errors = results.filter(result => result.status === "rejected").map(result => String(result.reason?.message || result.reason)).slice(0, 5);
      return json({error: "Las fuentes no devolvieron titulares.", errors}, 502);
    }
    return json({items, sources: fulfilled.length, refreshedAt: new Date().toISOString()});
  },
};

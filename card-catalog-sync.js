/* Published card designs are public content. Inventory and pack awards stay on the server. */
(() => {
  const config = globalThis.BIG_BOY_CONFIG || {}, collection = globalThis.CardCollection;
  if (!collection || !config.supabaseUrl || !config.supabasePublishableKey) return;
  const origin = new URL(config.supabaseUrl).origin;
  const cdn = 'https://raulculsan.github.io/The-Big-Boy-Rules/';
  const cacheKey = `bb:published-card-designs:v1:${origin}`;
  const editions = {common:'Común',retro:'Retro',special:'Especial',epic:'Épica',legendary:'Legendaria',full_art:'Full Art',vice_city:'Vice City',halloween:'Halloween'};
  const placeholder = 'icons/cards/card-art-unavailable.svg';
  let pending, lastSuccess = 0;
  function media(value) {
    if (typeof value !== 'string' || value.length > 2048) return '';
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.hash) return '';
      if (url.origin === origin && url.pathname.startsWith('/storage/v1/object/public/card-artwork/')) return url.href;
      if (url.href.startsWith(`${cdn}icons/cards/`)) return url.href;
    } catch {}
    return '';
  }
  function normalize(row) {
    if (!row || !/^[a-z0-9][a-z0-9_-]{0,119}$/.test(row.id || '') || !editions[row.rarity]) return;
    const front = media(row.front_url), back = media(row.back_url), thumbnail = media(row.thumbnail_url) || front;
    const name = String(row.display_name || '').trim(), kind = row.display_kind;
    if (!front || !back || !name || name.length > 120 || !['Miembro','Personaje','Objeto','Ubicación'].includes(kind)) return;
    if (row.score != null && (!Number.isInteger(row.score) || row.score < 0 || row.score > 100)) return;
    if (!Number.isInteger(row.width) || !Number.isInteger(row.height) || row.width < 100 || row.width > 4096 || row.height < 100 || row.height > 4096) return;
    const bundled = collection.bundledCatalog.find(card => card.id === row.id);
    globalThis.CardMedia?.register(front, bundled ? collection.thumbnail(bundled) : thumbnail !== front ? thumbnail : placeholder);
    globalThis.CardMedia?.register(back, bundled?.back || placeholder);
    globalThis.CardMedia?.register(thumbnail, bundled ? collection.thumbnail(bundled) : placeholder);
    return {id:row.id,collection:/^[a-z0-9_-]{1,80}$/.test(row.collection_key || '') ? row.collection_key : 'los-nuestros-01',collectionName:typeof row.collection_name === 'string' && row.collection_name.length <= 100 ? row.collection_name : 'Colección',name,kind,edition:editions[row.rarity],rarity:row.rarity,score:row.score,front,back,thumbnail,width:row.width,height:row.height,folder:kind === 'Objeto' ? 'objetos' : kind === 'Ubicación' ? 'ubicaciones' : 'miembros'};
  }
  function receive(rows) {
    if (!Array.isArray(rows) || rows.length > 5000) return false;
    const designs = rows.map(normalize).filter(Boolean);
    if (!designs.length) return false;
    collection.applyPublished(designs);
    return true;
  }
  async function refresh(force = false) {
    if (pending) return pending;
    if (navigator.onLine === false || (!force && Date.now() - lastSuccess < 60000)) return;
    pending = (async () => {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
      try {
        // Keyset pages keep growth beyond Supabase's default 1,000-row limit safe.
        const rows = []; let after = '';
        do {
          const query = new URLSearchParams({select:'id,collection_key,collection_name,display_name,display_kind,rarity,score,front_url,back_url,thumbnail_url,width,height,updated_at',order:'id.asc',limit:'500'});
          if (after) query.set('id',`gt.${after}`);
          const response = await fetch(`${origin}/rest/v1/published_card_designs?${query}`, {headers:{apikey:config.supabasePublishableKey},signal:controller.signal,cache:'no-store',credentials:'omit'});
          if (!response.ok) throw new Error('Catalog unavailable');
          const page = await response.json();
          if (!Array.isArray(page)) throw new Error('Invalid catalog');
          rows.push(...page); if (rows.length > 5000) throw new Error('Catalog limit');
          after = page.length === 500 ? page.at(-1)?.id : '';
        } while (after);
        if (receive(rows)) {lastSuccess = Date.now(); try {localStorage.setItem(cacheKey, JSON.stringify({savedAt:lastSuccess,rows}));} catch {}}
      } catch { /* Bundled and last valid published catalog stay usable offline. */ }
      finally {clearTimeout(timer);pending = null;}
    })();
    return pending;
  }
  function start() {
    try {const cached = localStorage.getItem(cacheKey);if (cached && cached.length < 4e6) receive(JSON.parse(cached).rows);} catch {}
    void refresh();
  }
  globalThis.CardCatalogSync = Object.freeze({refresh});
  setTimeout(start, 300);
  window.addEventListener('online', () => void refresh(true));
  document.addEventListener('visibilitychange', () => {if (!document.hidden) void refresh();});
  window.addEventListener('hashchange', () => {if (['#sobres','#album','#catalogo'].includes(location.hash)) void refresh();});
})();

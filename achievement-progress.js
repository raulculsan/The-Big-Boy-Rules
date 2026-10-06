/* Shared objective vocabulary. Only server records determine earned progress. */
(() => {
  const metrics = Object.freeze({
    group_messages: Object.freeze({label:'Mensajes en el grupo', unit:'días', hint:'Solo suma el primer mensaje del día, entre todas las categorías del grupo. Los adjuntos cuentan; los privados no. Día según la hora de Madrid.'}),
    group_active_days: Object.freeze({label:'Días de participación', unit:'días', hint:'Suma al entrar en la app con tu cuenta, una vez al día. También cuenta si tu sesión estaba guardada; no necesitas escribir ni volver a identificarte. Hora de Madrid.'}),
    profile_completed: Object.freeze({label:'Completar el perfil', unit:'perfil', hint:'Nombre, foto y biografía. Si el perfil ya está completo al crear el logro, se concede directamente.'}),
    daily_packs_earned: Object.freeze({label:'Sobres diarios conseguidos', unit:'sobres', hint:'Cuenta cada sobre diario acreditado por el servidor después de crear el objetivo. Actualizar el saldo o probar la animación no suma.'}),
    cards_explored: Object.freeze({label:'Cartas distintas exploradas', unit:'cartas', hint:'Abre cartas del catálogo en grande. Cada carta suma una sola vez por objetivo; no significa que la hayas conseguido en un sobre.'}),
    special_cards_explored: Object.freeze({label:'Cartas especiales exploradas', unit:'cartas', hint:'Explora cartas de edición Especial. Cada carta distinta suma una vez por objetivo; las legendarias tienen su propia categoría.'}),
    legendary_cards_explored: Object.freeze({label:'Cartas legendarias exploradas', unit:'cartas', hint:'Explora cartas de edición Legendaria. Reabrir o girar la misma carta no vuelve a sumar.'}),
    locations_explored: Object.freeze({label:'Ubicaciones exploradas', unit:'lugares', hint:'Abre cartas de ubicaciones, de cualquier rareza. Cada lugar suma una vez por objetivo. No requiere visitar el lugar físicamente.'}),
  });
  function validTarget(metric, target) {
    const value = Number(target);
    return Object.hasOwn(metrics, metric) && Number.isInteger(value) && value >= 1 && value <= 100000
      && (metric !== 'profile_completed' || value === 1);
  }
  function objective(rule) {
    if (!rule || !validTarget(rule.metric, rule.target)) return '';
    if (rule.metric === 'profile_completed') return 'Completa tu nombre, foto y biografía';
    const goal = new Intl.NumberFormat('es-ES').format(rule.target);
    const plural = Number(rule.target) !== 1;
    if (rule.metric === 'daily_packs_earned') return `Consigue ${goal} ${plural ? 'sobres diarios' : 'sobre diario'}`;
    if (rule.metric === 'locations_explored') return `Explora ${goal} ${plural ? 'ubicaciones distintas' : 'ubicación'}`;
    if (rule.metric.endsWith('cards_explored')) {
      const edition = rule.metric === 'special_cards_explored' ? (plural ? ' especiales' : ' especial')
        : rule.metric === 'legendary_cards_explored' ? (plural ? ' legendarias' : ' legendaria') : '';
      return `Explora ${goal} ${plural ? 'cartas' : 'carta'}${edition}${plural ? ' distintas' : ''}`;
    }
    const days = Number(rule.target) === 1 ? 'día' : 'días distintos';
    return rule.metric === 'group_messages'
      ? `Escribe en el grupo ${goal} ${days} · máximo 1 al día`
      : `Entra en la app ${goal} ${days}`;
  }
  function progress(rule, record) {
    if (!rule || !validTarget(rule.metric, rule.target)) return null;
    const target = Number(rule.target), raw = Number(record?.value || 0);
    const value = Math.min(target, Math.max(0, Number.isFinite(raw) ? Math.floor(raw) : 0));
    return {value, target, percent:Math.floor(value / target * 100), complete:value === target};
  }
  function pending(definitions, awards, userId) {
    if (!userId) return [];
    const earned = new Set(awards.filter(a=>a.userId === userId).map(a=>String(a.achievementId)));
    return definitions.filter(a=>a.rule && validTarget(a.rule.metric, a.rule.target) && !earned.has(String(a.id)));
  }
  function orderedPending(definitions, awards, records, userId) {
    const values = new Map((records || []).map(item => [String(item.achievementId), item]));
    const tiers = {bronze:0,silver:1,gold:2,platinum:3};
    return pending(definitions, awards, userId).slice().sort((left,right) => {
      const a=progress(left.rule,values.get(String(left.id))), b=progress(right.rule,values.get(String(right.id)));
      return b.percent-a.percent || (a.target-a.value)-(b.target-b.value) || a.target-b.target
        || (tiers[left.tier] ?? 9)-(tiers[right.tier] ?? 9) || String(left.name).localeCompare(String(right.name),'es');
    });
  }
  // This cache only avoids requests; the server is the authority for dates and deduplication.
  function createDailyVisitRecorder({session, visible, rpc, day = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}) {
    let active = null, cachedUser = null, cachedDay = null;
    const reset = () => { active = null; cachedUser = null; cachedDay = null; };
    function record({force = false} = {}) {
      const userId = session();
      if (!userId || !visible()) return Promise.resolve(false);
      if (active?.userId === userId) return active.promise;
      if (!force && cachedUser === userId && cachedDay === day()) return Promise.resolve(false);
      const request = {userId, promise:null};
      active = request;
      request.promise = (async () => {
        try {
          const {data, error} = await rpc();
          if (active !== request || session() !== userId || error || !data) return false;
          cachedUser = userId; cachedDay = data;
          return true;
        } catch { return false; } // Offline visits retry; never manufacture progress locally.
        finally { if (active === request) active = null; }
      })();
      return request.promise;
    }
    return Object.freeze({record, reset});
  }
  globalThis.AchievementProgress = Object.freeze({metrics, validTarget, objective, progress, pending, orderedPending, createDailyVisitRecorder});
})();

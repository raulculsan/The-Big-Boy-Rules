/* Pure club calculations shared by the interface and regression tests. */
(function (root) {
  function achievementOwnership(id, members, awards) {
    const active = new Set(members.filter(member => !member.hidden && member.isActive !== false && member.authId).map(member => member.authId));
    const owners = new Set(awards.filter(award => String(award.achievementId) === String(id) && active.has(award.userId)).map(award => award.userId));
    return {owners: owners.size, total: active.size, percent: active.size ? owners.size / active.size * 100 : 0};
  }

  function nextEventOccurrence(event, now = new Date()) {
    const start = new Date(event.startsAt);
    if (!Number.isFinite(start.getTime())) return null;
    if (event.eventType === "birthday") {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      for (let year = now.getFullYear(); year <= now.getFullYear() + 8; year++) {
        const occurrence = new Date(year, start.getMonth(), start.getDate());
        if (occurrence.getMonth() === start.getMonth() && occurrence >= today) return occurrence;
      }
      return null;
    }
    const end = event.endsAt ? new Date(event.endsAt) : new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999);
    return end >= now ? start : null;
  }

  function upcomingEvents(events, now = new Date(), limit = 3) {
    return events.map(event => ({event, date: nextEventOccurrence(event, now)}))
      .filter(item => item.date).sort((a, b) => a.date - b.date || String(a.event.id).localeCompare(String(b.event.id)))
      .slice(0, limit);
  }

  root.ClubModel = {achievementOwnership, nextEventOccurrence, upcomingEvents};
})(globalThis);

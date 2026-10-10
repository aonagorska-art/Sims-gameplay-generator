/* Pure generation logic, also usable from the Node test runner. */
(function (root) {
  'use strict';
  function generationError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
  }
  function compatible(item, chosen) {
    return chosen.every(other =>
      (!item.id || item.id !== other.id) &&
      (!item.text || item.text !== other.text) &&
      !(item.themes || []).some(theme => (other.themes || []).includes(theme)) &&
      !(item.blocks || []).some(tag => (other.tags || []).includes(tag)) &&
      !(other.blocks || []).some(tag => (item.tags || []).includes(tag))
    );
  }
  function ownsPacks(item, packs) {
    return item.packs.every(id => id === 'base' || packs.includes(id));
  }
  function createEngine(data, random = Math.random) {
    let previous = null;
    function pick(pool, mode, chosen = [], exclude = new Set(), packs = Object.keys(data.packs)) {
      const allowed = pool.filter(item => item.tier <= mode && ownsPacks(item, packs) && compatible(item, chosen));
      let candidates = allowed.filter(item => !exclude.has(item.id));
      if (!candidates.length) candidates = allowed;
      if (!candidates.length) return null;
      const weights = candidates.map(item => item.tier === mode ? 4 : 1);
      let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
      return candidates.find((item, i) => (roll -= weights[i]) < 0) || candidates[candidates.length - 1];
    }
    function generate(mode, options = {}) {
      if (![0, 1, 2].includes(mode)) throw generationError('Unknown chaos level.', 'UNKNOWN_MODE');
      const packs = [...new Set(['base', ...(options.packs ?? Object.keys(data.packs))])];
      const locked = options.locked || {};
      const kept = {};
      for (const [key, item] of Object.entries(locked)) {
        const canonical = data.pools[key]?.find(candidate => candidate.id === item.id);
        if (!data.sections.some(section => section.key === key) || !canonical ||
            canonical.tier > mode || !ownsPacks(canonical, packs) ||
            !compatible(canonical, Object.values(kept))) {
          throw generationError('A kept idea no longer fits your settings. Release it and try again.', 'INVALID_LOCK');
        }
        kept[key] = canonical;
      }
      for (let attempt = 0; attempt < 100; attempt++) {
        const scenario = { mode, packs, items: { ...kept }, disasters: [], event: null };
        // Reserve every kept theme before choosing any new ingredient.
        const chosen = Object.values(kept);
        let complete = true;
        for (const section of data.sections) {
          if (kept[section.key]) continue;
          const oldId = previous?.items[section.key]?.id;
          const item = pick(data.pools[section.key], mode, chosen, new Set([oldId]), packs);
          if (!item) { complete = false; break; }
          scenario.items[section.key] = item;
          chosen.push(item);
        }
        if (!complete) continue;
        if (random() < 0.3) scenario.event = pick(data.pools.event, mode, chosen, new Set([previous?.event?.id]), packs);
        const footers = data.footers.filter(text => text !== previous?.footer);
        scenario.footer = footers[Math.floor(random() * footers.length)];
        previous = scenario;
        return scenario;
      }
      throw generationError('No matching story found. Release a kept idea or select more packs.', 'NO_STORY');
    }
    function addDisaster(scenario) {
      const chosen = [...Object.values(scenario.items), scenario.event,
        ...scenario.disasters.flatMap(item => [item, item.event])].filter(Boolean);
      const item = pick(data.pools.disaster, scenario.mode, chosen, new Set(), scenario.packs);
      if (!item) return null;
      const entry = { ...item };
      if (random() < 0.2) entry.event = pick(data.pools.event, scenario.mode, [...chosen, item], new Set([scenario.event?.id, scenario.disasters.at(-1)?.event?.id]), scenario.packs);
      scenario.disasters.push(entry);
      return entry;
    }
    return { generate, addDisaster };
  }
  function formatChallenge(data, scenario, language = 'en') {
    const view = root.SimsI18n.createView(data, language);
    const describe = item => view.prompt(item) + '\n' + item.packs.map(view.pack).join(' + ');
    const parts = [view.t('pageTitle').toLocaleUpperCase(view.lang), '\n' + view.t('modeLabel') + ': ' + view.mode(scenario.mode)];
    data.sections.forEach(section => parts.push('\n' + section.icon + ' ' + view.section(section.key) + '\n' + describe(scenario.items[section.key])));
    if (scenario.event) parts.push('\n' + view.t('meanwhile') + '\n' + describe(scenario.event));
    scenario.disasters.forEach((item, i) => parts.push('\n' + view.t('newProblem', { number: i + 1 }) + '\n' + describe(item) +
      (item.event ? '\n' + view.t('meanwhile') + ' ' + describe(item.event) : '')));
    parts.push('\n' + view.footer(scenario.footer));
    return parts.join('\n');
  }
  root.SimsGenerator = { createEngine, formatChallenge, compatible, ownsPacks };
})(typeof window !== 'undefined' ? window : globalThis);

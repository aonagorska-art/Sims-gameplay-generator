/* Pure generation logic, also usable from the Node test runner. */
(function (root) {
  'use strict';
  function compatible(item, chosen) {
    return chosen.every(other =>
      (!item.id || item.id !== other.id) &&
      (!item.text || item.text !== other.text) &&
      !(item.themes || []).some(theme => (other.themes || []).includes(theme)) &&
      !(item.blocks || []).some(tag => (other.tags || []).includes(tag)) &&
      !(other.blocks || []).some(tag => (item.tags || []).includes(tag))
    );
  }
  function createEngine(data, random = Math.random) {
    let previous = null;
    function pick(pool, mode, chosen = [], exclude = new Set()) {
      const allowed = pool.filter(item => item.tier <= mode && compatible(item, chosen));
      let candidates = allowed.filter(item => !exclude.has(item.id));
      if (!candidates.length) candidates = allowed;
      if (!candidates.length) return null;
      const weights = candidates.map(item => item.tier === mode ? 4 : 1);
      let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
      return candidates.find((item, i) => (roll -= weights[i]) < 0) || candidates[candidates.length - 1];
    }
    function generate(mode, attempt = 0) {
      if (![0, 1, 2].includes(mode)) throw new Error('Unknown chaos level.');
      const scenario = { mode, items: {}, disasters: [], event: null };
      const chosen = [];
      for (const section of data.sections) {
        const oldId = previous?.items[section.key]?.id;
        const item = pick(data.pools[section.key], mode, chosen, new Set([oldId]));
        if (!item) {
          if (attempt >= 100) throw new Error("Prompt pools need more distinct themes.");
          return generate(mode, attempt + 1);
        }
        scenario.items[section.key] = item;
        chosen.push(item);
      }
      if (random() < 0.3) scenario.event = pick(data.pools.event, mode, chosen, new Set([previous?.event?.id]));
      const footers = data.footers.filter(text => text !== previous?.footer);
      scenario.footer = footers[Math.floor(random() * footers.length)];
      previous = scenario;
      return scenario;
    }
    function addDisaster(scenario) {
      const chosen = [...Object.values(scenario.items), scenario.event,
        ...scenario.disasters.flatMap(item => [item, item.event])].filter(Boolean);
      const item = pick(data.pools.disaster, scenario.mode, chosen);
      if (!item) return null;
      const entry = { ...item };
      if (random() < 0.2) entry.event = pick(data.pools.event, scenario.mode, [...chosen, item], new Set([scenario.event?.id, scenario.disasters.at(-1)?.event?.id]));
      scenario.disasters.push(entry);
      return entry;
    }
    return { generate, addDisaster };
  }
  function formatChallenge(data, scenario) {
    const describe = item => item.text + (item.alternative ? '\n' + item.alternative : '');
    const parts = ['SIMS GAMEPLAY GENERATOR', 'Because playing normally is apparently not an option.', '\nMODE: ' + data.modes[scenario.mode]];
    data.sections.forEach(section => parts.push('\n' + section.icon + ' ' + section.label + '\n' + describe(scenario.items[section.key])));
    if (scenario.event) parts.push('\nMEANWHILE…\n' + describe(scenario.event));
    scenario.disasters.forEach((item, i) => parts.push('\n🚨 NEW PROBLEM UNLOCKED #' + (i + 1) + '\n' + describe(item) + (item.event ? '\nMeanwhile: ' + describe(item.event) : '')));
    parts.push('\n' + scenario.footer);
    return parts.join('\n');
  }
  root.SimsGenerator = { createEngine, formatChallenge, compatible };
})(typeof window !== 'undefined' ? window : globalThis);

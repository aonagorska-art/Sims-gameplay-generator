(function () {
  'use strict';
  const data = window.SIMS_DATA;
  const engine = window.SimsGenerator.createEngine(data);
  const byId = id => document.getElementById(id);
  const labels = ['GIVE ME MORE DRAMA', "THAT WASN'T ENOUGH", 'MAKE IT WORSE', 'I HAVE LEARNED NOTHING', 'DESTROY THIS FAMILY'];
  let mode = 1;
  let scenario = null;
  let count = 0;
  const storageKey = 'sims-gameplay-packs-v1';
  const packIds = Object.keys(data.packs).filter(id => id !== 'base');
  let ownedPacks = new Set(['base']);
  let canStore = true;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved)) ownedPacks = new Set(['base', ...saved.filter(id => packIds.includes(id))]);
  } catch (_) { canStore = false; }
  const locked = new Set();
  let settingsDirty = false;
  let copyTimer;
  let copyVersion = 0;
  function resetCopy() {
    clearTimeout(copyTimer);
    copyVersion++;
    byId('copy').textContent = 'COPY THIS DISASTER';
  }
  function selectMode(value) {
    mode = value;
    document.querySelectorAll('[data-mode]').forEach(button => {
      const selected = Number(button.dataset.mode) === mode;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    settingsChanged();
    byId('status').textContent = data.modes[mode] + ' selected for your next save.';
  }
  function fitsSettings(item) {
    return item.tier <= mode && SimsGenerator.ownsPacks(item, [...ownedPacks]);
  }
  function syncLocks() {
    document.querySelectorAll('[data-keep]').forEach(button => {
      const key = button.dataset.keep;
      const kept = locked.has(key);
      button.textContent = kept ? '✓ KEPT' : '+ KEEP';
      button.setAttribute('aria-pressed', String(kept));
      button.setAttribute('aria-label', 'Keep ' + data.sections.find(s => s.key === key).label.toLowerCase() + ' when rerolling');
      button.disabled = !fitsSettings(scenario.items[key]);
      button.closest('.ingredient').classList.toggle('is-kept', kept);
    });
    const allKept = locked.size === data.sections.length;
    byId('keep-summary').textContent = allKept
      ? 'All 8 cards are kept. Release one to reroll.'
      : locked.size ? locked.size + ' of 8 kept. Reroll the rest; extra drama resets.'
      : 'Keep any card, then reroll the rest. Extra drama resets with each roll.';
    byId('unlock-all').hidden = locked.size === 0;
    byId('again').textContent = locked.size ? 'REROLL UNLOCKED ↻' : 'REROLL MY STORY ↻';
    ['again', 'generate', 'surprise'].forEach(id => { byId(id).disabled = allKept; });
  }
  function settingsChanged() {
    byId('generation-error').hidden = true;
    let released = 0;
    for (const key of locked) {
      if (!fitsSettings(scenario.items[key])) { locked.delete(key); released++; }
    }
    if (scenario) {
      settingsDirty = true;
      byId('settings-note').hidden = false;
      byId('settings-note').textContent = 'Settings changed. Reroll to update your story.' +
        (released ? ' Released ' + released + ' kept ' + (released === 1 ? 'card that no longer fits.' : 'cards that no longer fit.') : ' Matching kept cards will stay.');
      byId('drama').disabled = true;
      byId('drama').textContent = 'REROLL TO ADD MORE DRAMA';
    }
    syncLocks();
  }
  function updatePacks(save = true) {
    document.querySelectorAll('[data-pack]').forEach(input => { input.checked = ownedPacks.has(input.dataset.pack); });
    const count = ownedPacks.size - 1;
    byId('pack-summary').textContent = count === 0 ? 'Base Game only' :
      count === packIds.length ? 'All 53 packs + Base Game' : count + (count === 1 ? ' pack' : ' packs') + ' + Base Game';
    if (save) {
      try { localStorage.setItem(storageKey, JSON.stringify([...ownedPacks])); canStore = true; }
      catch (_) { canStore = false; }
      settingsChanged();
    }
    byId('pack-storage').textContent = canStore ? 'Your selection stays in this browser.' : 'Your selection works for this visit. Browser storage is unavailable.';
  }
  for (const type of ['Expansion Pack', 'Game Pack', 'Stuff Pack']) {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'pack-group';
    const legend = document.createElement('legend');
    legend.textContent = type + 's';
    const grid = document.createElement('div');
    grid.className = 'pack-grid';
    packIds.filter(id => data.packs[id].type === type)
      .sort((a, b) => data.packs[a].name.localeCompare(data.packs[b].name)).forEach(id => {
        const label = document.createElement('label');
        label.className = 'pack-option';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.dataset.pack = id;
        input.addEventListener('change', () => {
          if (input.checked) ownedPacks.add(id); else ownedPacks.delete(id);
          updatePacks();
        });
        const name = document.createElement('span');
        name.textContent = data.packs[id].name;
        label.append(input, name);
        grid.append(label);
      });
    fieldset.append(legend, grid);
    byId('pack-groups').append(fieldset);
  }
  byId('packs-all').addEventListener('click', () => { ownedPacks = new Set(['base', ...packIds]); updatePacks(); });
  byId('packs-base').addEventListener('click', () => { ownedPacks = new Set(['base']); updatePacks(); });
  byId('pack-search').addEventListener('input', event => {
    const query = event.target.value.trim().toLowerCase();
    document.querySelectorAll('.pack-option').forEach(label => { label.hidden = !label.textContent.toLowerCase().includes(query); });
    document.querySelectorAll('.pack-group').forEach(group => { group.hidden = !group.querySelector('.pack-option:not([hidden])'); });
    byId('pack-no-results').hidden = Boolean(document.querySelector('.pack-option:not([hidden])'));
  });
  byId('unlock-all').addEventListener('click', () => {
    locked.clear(); syncLocks(); byId('again').focus();
    byId('status').textContent = 'All cards released. Ready to reroll.';
  });
  updatePacks(false);
  function appendDescription(parent, item) {
    const p = document.createElement('p');
    p.textContent = item.text;
    parent.append(p);
    const packs = document.createElement('div');
    packs.className = 'pack-labels';
    packs.setAttribute('aria-label', 'Required game content');
    item.packs.forEach(id => {
      const pack = data.packs[id];
      const label = document.createElement('span');
      label.className = 'pack-label';
      label.textContent = pack.name + (id === 'base' ? '' : ' · ' + pack.type);
      packs.append(label);
    });
    parent.append(packs);
  }
  byId('start').addEventListener('click', () => {
    byId('welcome').hidden = true;
    byId('setup').hidden = false;
    byId('empty').hidden = false;
    document.body.classList.add('started');
    byId('mode-title').focus({ preventScroll: true });
    byId('setup').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  function generate() {
    if (locked.size === data.sections.length) return;
    try {
      scenario = engine.generate(mode, {
        packs: [...ownedPacks],
        locked: Object.fromEntries([...locked].map(key => [key, scenario.items[key]]))
      });
    } catch (error) {
      byId('generation-error').textContent = error.message;
      byId('generation-error').hidden = false;
      byId('generation-error').scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    settingsDirty = false;
    byId('settings-note').hidden = true;
    byId('generation-error').hidden = true;
    count++;
    resetCopy();
    byId('ingredients').replaceChildren();
    data.sections.forEach(section => {
      const panel = document.createElement('section');
      panel.className = 'ingredient';
      const icon = document.createElement('span');
      icon.className = 'ingredient-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = section.icon;
      const content = document.createElement('div');
      const heading = document.createElement('h3');
      heading.textContent = section.label;
      const top = document.createElement('div');
      top.className = 'ingredient-heading';
      const keep = document.createElement('button');
      keep.className = 'keep-button';
      keep.dataset.keep = section.key;
      keep.addEventListener('click', () => {
        if (locked.has(section.key)) locked.delete(section.key); else locked.add(section.key);
        syncLocks();
        byId('status').textContent = section.label + (locked.has(section.key) ? ' kept for the next roll.' : ' released for the next roll.');
      });
      top.append(heading, keep);
      content.append(top);
      appendDescription(content, scenario.items[section.key]);
      panel.append(icon, content);
      byId('ingredients').append(panel);
    });
    syncLocks();
    byId('mode-badge').textContent = ['🌱 ', '🔥 ', '💀 '][scenario.mode] + data.modes[scenario.mode];
    byId('save-number').textContent = 'SAVE #' + String(count).padStart(3, '0');
    byId('footer-message').textContent = scenario.footer;
    byId('random-event').replaceChildren();
    byId('random-event').hidden = !scenario.event;
    if (scenario.event) {
      const heading = document.createElement('strong');
      heading.textContent = 'MEANWHILE… ';
      byId('random-event').append(heading);
      appendDescription(byId('random-event'), scenario.event);
    }
    byId('disasters').replaceChildren();
    byId('drama').textContent = labels[0];
    byId('drama').disabled = false;
    byId('empty').hidden = true;
    byId('result').hidden = false;
    byId('status').textContent = 'New ' + data.modes[mode] + ' challenge generated. ' + locked.size + ' cards kept. Eight story ingredients are ready.';
    byId('result-title').focus({ preventScroll: true });
    byId('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    const buttonLabels = ['GENERATE MY SAVE', 'GIVE ME BAD DECISIONS', 'MAKE MY SAVE INTERESTING', 'RUIN MY SIM’S LIFE'];
    byId('generate-label').textContent = count % 3 === 0 ? buttonLabels[1 + Math.floor(Math.random() * 3)] : buttonLabels[0];
  }
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => selectMode(Number(button.dataset.mode))));
  ['generate', 'again'].forEach(id => byId(id).addEventListener('click', generate));
  byId('surprise').addEventListener('click', () => {
    const minimum = Math.max(0, ...[...locked].map(key => scenario.items[key].tier));
    selectMode(minimum + Math.floor(Math.random() * (3 - minimum))); generate();
  });
  byId('drama').addEventListener('click', () => {
    if (!scenario) return;
    if (settingsDirty) return;
    const item = engine.addDisaster(scenario);
    if (!item) {
      byId('drama').textContent = 'ALL FRESH DRAMA USED UP';
      byId('drama').disabled = true;
      byId('status').textContent = 'No new distinct disasters remain. Generate another save for more drama.';
      return;
    }
    resetCopy();
    const card = document.createElement('article');
    card.className = 'disaster';
    const heading = document.createElement('h3');
    heading.textContent = '🚨 NEW PROBLEM UNLOCKED #' + scenario.disasters.length;
    card.append(heading);
    appendDescription(card, item);
    if (item.event) {
      const event = document.createElement('div');
      event.className = 'disaster-event';
      const title = document.createElement('strong');
      title.textContent = 'MEANWHILE…';
      event.append(title);
      appendDescription(event, item.event);
      card.append(event);
    }
    byId('disasters').append(card);
    byId('drama').textContent = labels[Math.min(scenario.disasters.length, labels.length - 1)];
  });
  function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('aria-label', 'Challenge text to copy');
    textarea.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0';
    document.body.append(textarea);
    textarea.select();
    let success;
    try { success = document.execCommand('copy'); } finally { textarea.remove(); byId('copy').focus({ preventScroll: true }); }
    if (!success) throw new Error('Clipboard unavailable');
  }
  byId('copy').addEventListener('click', async () => {
    if (!scenario) return;
    const text = window.SimsGenerator.formatChallenge(data, scenario);
    const version = copyVersion;
    try {
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Use local-file fallback');
        await navigator.clipboard.writeText(text);
      } catch (_) { fallbackCopy(text); }
      if (version !== copyVersion) return;
      byId('copy').textContent = 'DISASTER COPIED ✓';
      byId('status').textContent = 'Challenge and all disaster cards copied.';
      copyTimer = setTimeout(resetCopy, 3000);
    } catch (_) {
      byId('status').textContent = 'Copy is unavailable. Select and copy the challenge text below.';
      const dialog = document.createElement('dialog');
      const heading = document.createElement('h2');
      heading.textContent = 'Your clipboard has chosen chaos.';
      const hint = document.createElement('p');
      hint.textContent = 'Select this text and copy it manually.';
      const area = document.createElement('textarea');
      area.setAttribute('aria-label', 'Full challenge');
      area.value = text;
      area.style.cssText = 'width:100%;min-height:260px;font:inherit';
      const close = document.createElement('button');
      close.textContent = 'DONE';
      close.className = 'outline';
      close.addEventListener('click', () => dialog.close());
      dialog.addEventListener('close', () => dialog.remove());
      dialog.style.cssText = 'width:600px;max-width:calc(100% - 32px);border:2px solid #163e42;border-radius:16px;color:#163e42;padding:24px';
      dialog.append(heading, hint, area, close);
      document.body.append(dialog);
      dialog.showModal();
      area.select();
    }
  });
})();

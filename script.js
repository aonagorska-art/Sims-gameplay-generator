(function () {
  'use strict';
  const data = window.SIMS_DATA;
  const engine = window.SimsGenerator.createEngine(data);
  const byId = id => document.getElementById(id);
  const storageKey = 'sims-gameplay-packs-v1';
  const languageKey = 'sims-gameplay-language-v1';
  const packIds = Object.keys(data.packs).filter(id => id !== 'base');
  let language = 'en';
  let ownedPacks = new Set(['base']);
  let canStore = true;
  try {
    if (localStorage.getItem(languageKey) === 'pl') language = 'pl';
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved)) ownedPacks = new Set(['base', ...saved.filter(id => packIds.includes(id))]);
  } catch (_) { canStore = false; }
  let view = SimsI18n.createView(data, language);
  const t = (key, values) => view.t(key, values);
  let mode = 1;
  let scenario = null;
  let count = 0;
  const locked = new Set();
  let settingsDirty = false;
  let releasedCount = 0;
  let exhausted = false;
  let generationError = null;
  let generateVariant = 0;
  let copyTimer;
  let copyVersion = 0;

  function resetCopy() {
    clearTimeout(copyTimer);
    copyVersion++;
    byId('copy').textContent = t('copy');
  }
  function fitsSettings(item) {
    return item.tier <= mode && SimsGenerator.ownsPacks(item, [...ownedPacks]);
  }
  function syncLocks() {
    document.querySelectorAll('[data-keep]').forEach(button => {
      const key = button.dataset.keep;
      const kept = locked.has(key);
      button.textContent = t(kept ? 'kept' : 'keep');
      button.setAttribute('aria-pressed', String(kept));
      button.setAttribute('aria-label', t('keepAria', { section: view.section(key).toLocaleLowerCase(language) }));
      button.disabled = !fitsSettings(scenario.items[key]);
      button.closest('.ingredient').classList.toggle('is-kept', kept);
    });
    const allKept = locked.size === data.sections.length;
    byId('keep-summary').textContent = t(allKept ? 'allKept' : locked.size ? 'someKept' : 'keepHint', { count: locked.size });
    byId('unlock-all').hidden = locked.size === 0;
    byId('again').textContent = t(locked.size ? 'againUnlocked' : 'again');
    ['again', 'generate', 'surprise'].forEach(id => { byId(id).disabled = allKept; });
  }
  function renderNotices() {
    byId('settings-note').hidden = !settingsDirty;
    byId('settings-note').textContent = t('settingsChanged') + ' ' +
      t(releasedCount ? 'settingsReleased' : 'settingsKept', { count: releasedCount });
    byId('generation-error').hidden = !generationError;
    byId('generation-error').textContent = generationError ? view.error(generationError) : '';
    byId('drama').disabled = settingsDirty || exhausted;
    byId('drama').textContent = t(settingsDirty ? 'rerollDrama' : exhausted ? 'noDrama' : 'drama' + Math.min(scenario?.disasters.length || 0, 4));
  }
  function settingsChanged() {
    generationError = null;
    releasedCount = 0;
    for (const key of locked) {
      if (!fitsSettings(scenario.items[key])) { locked.delete(key); releasedCount++; }
    }
    if (scenario) settingsDirty = true;
    renderNotices();
    syncLocks();
  }
  function selectMode(value) {
    mode = value;
    document.querySelectorAll('[data-mode]').forEach(button => {
      const selected = Number(button.dataset.mode) === mode;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    settingsChanged();
    byId('status').textContent = t('selectedMode', { mode: view.mode(mode) });
  }
  function updatePacks(save = true) {
    document.querySelectorAll('[data-pack]').forEach(input => { input.checked = ownedPacks.has(input.dataset.pack); });
    const count = ownedPacks.size - 1;
    byId('pack-summary').textContent = t(count === 0 ? 'baseOnly' : count === packIds.length ? 'allPacks' : 'somePacks', { count });
    if (save) {
      try { localStorage.setItem(storageKey, JSON.stringify([...ownedPacks])); canStore = true; }
      catch (_) { canStore = false; }
      settingsChanged();
    }
    byId('pack-storage').textContent = t(canStore ? 'storageSaved' : 'storageUnavailable');
  }
  const normalize = text => text.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
  function filterPacks() {
    const query = normalize(byId('pack-search').value.trim());
    document.querySelectorAll('.pack-option').forEach(label => { label.hidden = !label.dataset.search.includes(query); });
    document.querySelectorAll('.pack-group').forEach(group => { group.hidden = !group.querySelector('.pack-option:not([hidden])'); });
    byId('pack-no-results').hidden = Boolean(document.querySelector('.pack-option:not([hidden])'));
  }
  function renderPackPicker() {
    byId('pack-groups').replaceChildren();
    for (const type of ['Expansion Pack', 'Game Pack', 'Stuff Pack']) {
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'pack-group';
      const legend = document.createElement('legend');
      legend.textContent = view.group(type);
      const grid = document.createElement('div');
      grid.className = 'pack-grid';
      packIds.filter(id => data.packs[id].type === type)
        .sort((a, b) => view.packName(a).localeCompare(view.packName(b), language)).forEach(id => {
          const label = document.createElement('label');
          label.className = 'pack-option';
          label.dataset.search = normalize(data.packs[id].name + ' ' + SIMS_PL.packs[id]);
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.dataset.pack = id;
          input.addEventListener('change', () => {
            if (input.checked) ownedPacks.add(id); else ownedPacks.delete(id);
            updatePacks();
          });
          const name = document.createElement('span');
          name.textContent = view.packName(id);
          label.append(input, name);
          grid.append(label);
        });
      fieldset.append(legend, grid);
      byId('pack-groups').append(fieldset);
    }
    updatePacks(false);
    filterPacks();
  }
  function appendDescription(parent, item) {
    const p = document.createElement('p');
    p.textContent = view.prompt(item);
    parent.append(p);
    const packs = document.createElement('div');
    packs.className = 'pack-labels';
    packs.setAttribute('aria-label', t('required'));
    item.packs.forEach(id => {
      const label = document.createElement('span');
      label.className = 'pack-label';
      label.textContent = view.pack(id);
      packs.append(label);
    });
    parent.append(packs);
  }
  function renderDisasters() {
    byId('disasters').replaceChildren();
    scenario.disasters.forEach((item, index) => {
      const card = document.createElement('article');
      card.className = 'disaster';
      const heading = document.createElement('h3');
      heading.textContent = t('newProblem', { number: index + 1 });
      card.append(heading);
      appendDescription(card, item);
      if (item.event) {
        const event = document.createElement('div');
        event.className = 'disaster-event';
        const title = document.createElement('strong');
        title.textContent = t('meanwhile');
        event.append(title);
        appendDescription(event, item.event);
        card.append(event);
      }
      byId('disasters').append(card);
    });
    renderNotices();
  }
  function renderStory() {
    byId('ingredients').replaceChildren();
    data.sections.forEach(section => {
      const panel = document.createElement('section');
      panel.className = 'ingredient';
      // Stable IDs make it possible to verify that switching language never rerolls a card.
      panel.dataset.promptId = scenario.items[section.key].id;
      const icon = document.createElement('span');
      icon.className = 'ingredient-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = section.icon;
      const content = document.createElement('div');
      const heading = document.createElement('h3');
      heading.textContent = view.section(section.key);
      const top = document.createElement('div');
      top.className = 'ingredient-heading';
      const keep = document.createElement('button');
      keep.className = 'keep-button';
      keep.dataset.keep = section.key;
      keep.addEventListener('click', () => {
        if (locked.has(section.key)) locked.delete(section.key); else locked.add(section.key);
        syncLocks();
        byId('status').textContent = t(locked.has(section.key) ? 'keptStatus' : 'releasedStatus', { section: view.section(section.key) });
      });
      top.append(heading, keep);
      content.append(top);
      appendDescription(content, scenario.items[section.key]);
      panel.append(icon, content);
      byId('ingredients').append(panel);
    });
    syncLocks();
    byId('mode-badge').textContent = ['🌱 ', '🔥 ', '💀 '][scenario.mode] + view.mode(scenario.mode);
    byId('save-number').textContent = t('save', { number: String(count).padStart(3, '0') });
    byId('footer-message').textContent = view.footer(scenario.footer);
    byId('random-event').replaceChildren();
    byId('random-event').hidden = !scenario.event;
    if (scenario.event) {
      const heading = document.createElement('strong');
      heading.textContent = t('meanwhile');
      byId('random-event').append(heading);
      appendDescription(byId('random-event'), scenario.event);
    }
    renderDisasters();
  }
  function applyLanguage() {
    view = SimsI18n.createView(data, language);
    document.documentElement.lang = language;
    document.title = t('pageTitle');
    document.querySelector('meta[name="description"]').content = t('meta');
    document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
    document.querySelectorAll('[data-mode-name]').forEach(element => { element.textContent = view.mode(Number(element.dataset.modeName)); });
    document.querySelector('.modes').setAttribute('aria-label', t('intensity'));
    document.querySelectorAll('[data-language]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.language === language));
    });
    byId('pack-search').placeholder = t('searchPlaceholder');
    byId('generate-label').textContent = t(generateVariant ? 'generate' + generateVariant : 'generate');
    renderPackPicker();
    resetCopy();
    if (scenario) renderStory();
    else { syncLocks(); renderNotices(); }
  }
  document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => {
    if (language === button.dataset.language) return;
    language = button.dataset.language === 'pl' ? 'pl' : 'en';
    try { localStorage.setItem(languageKey, language); } catch (_) { /* Language still works for this visit. */ }
    applyLanguage();
    byId('status').textContent = t('languageChanged');
  }));
  byId('packs-all').addEventListener('click', () => { ownedPacks = new Set(['base', ...packIds]); updatePacks(); });
  byId('packs-base').addEventListener('click', () => { ownedPacks = new Set(['base']); updatePacks(); });
  byId('pack-search').addEventListener('input', filterPacks);
  byId('unlock-all').addEventListener('click', () => {
    locked.clear(); syncLocks(); byId('again').focus();
    byId('status').textContent = t('releasedAll');
  });
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
      scenario = engine.generate(mode, { packs: [...ownedPacks], locked: Object.fromEntries([...locked].map(key => [key, scenario.items[key]])) });
    } catch (error) {
      generationError = error;
      renderNotices();
      byId('generation-error').scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    settingsDirty = false;
    exhausted = false;
    generationError = null;
    count++;
    resetCopy();
    renderStory();
    byId('empty').hidden = true;
    byId('result').hidden = false;
    byId('status').textContent = t('generated', { count: locked.size });
    byId('result-title').focus({ preventScroll: true });
    byId('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    generateVariant = count % 3 === 0 ? 1 + Math.floor(Math.random() * 3) : 0;
    byId('generate-label').textContent = t(generateVariant ? 'generate' + generateVariant : 'generate');
  }
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => selectMode(Number(button.dataset.mode))));
  ['generate', 'again'].forEach(id => byId(id).addEventListener('click', generate));
  byId('surprise').addEventListener('click', () => {
    const minimum = Math.max(0, ...[...locked].map(key => scenario.items[key].tier));
    selectMode(minimum + Math.floor(Math.random() * (3 - minimum))); generate();
  });
  byId('drama').addEventListener('click', () => {
    if (!scenario || settingsDirty) return;
    const item = engine.addDisaster(scenario);
    if (!item) {
      exhausted = true;
      renderNotices();
      byId('status').textContent = t('noDramaHint');
      return;
    }
    resetCopy();
    renderDisasters();
  });
  function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('aria-label', t('copyText'));
    textarea.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0';
    document.body.append(textarea);
    textarea.select();
    let success;
    try { success = document.execCommand('copy'); } finally { textarea.remove(); byId('copy').focus({ preventScroll: true }); }
    if (!success) throw new Error('Clipboard unavailable');
  }
  byId('copy').addEventListener('click', async () => {
    if (!scenario) return;
    const text = SimsGenerator.formatChallenge(data, scenario, language);
    const version = copyVersion;
    try {
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Use local-file fallback');
        await navigator.clipboard.writeText(text);
      } catch (_) { if (version !== copyVersion) return; fallbackCopy(text); }
      if (version !== copyVersion) return;
      byId('copy').textContent = t('copied');
      byId('status').textContent = t('copiedStatus');
      copyTimer = setTimeout(resetCopy, 3000);
    } catch (_) {
      if (version !== copyVersion) return;
      byId('status').textContent = t('copyFailed');
      const dialog = document.createElement('dialog');
      const heading = document.createElement('h2');
      heading.textContent = t('copyTitle');
      const hint = document.createElement('p');
      hint.textContent = t('copyHint');
      const area = document.createElement('textarea');
      area.setAttribute('aria-label', t('fullChallenge'));
      area.value = text;
      area.style.cssText = 'width:100%;min-height:260px;font:inherit';
      const close = document.createElement('button');
      close.textContent = t('done');
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
  applyLanguage();
})();

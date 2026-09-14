(function () {
  'use strict';
  const data = window.SIMS_DATA;
  const engine = window.SimsGenerator.createEngine(data);
  const byId = id => document.getElementById(id);
  const labels = ['GIVE ME MORE DRAMA', "THAT WASN'T ENOUGH", 'MAKE IT WORSE', 'I HAVE LEARNED NOTHING', 'DESTROY THIS FAMILY'];
  let mode = 1;
  let scenario = null;
  let count = 0;
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
    byId('status').textContent = data.modes[mode] + ' selected for your next save.';
  }
  function appendDescription(parent, item) {
    const p = document.createElement('p');
    p.textContent = item.text;
    parent.append(p);
    if (item.alternative) {
      const small = document.createElement('small');
      small.textContent = item.alternative;
      parent.append(small);
    }
  }
  function generate() {
    scenario = engine.generate(mode);
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
      content.append(heading);
      appendDescription(content, scenario.items[section.key]);
      panel.append(icon, content);
      byId('ingredients').append(panel);
    });
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
    byId('status').textContent = 'New ' + data.modes[mode] + ' challenge generated. Eight story ingredients are ready.';
    byId('result-title').focus({ preventScroll: true });
    byId('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    const buttonLabels = ['GENERATE MY SAVE', 'GIVE ME BAD DECISIONS', 'MAKE MY SAVE INTERESTING', 'RUIN MY SIM’S LIFE'];
    byId('generate-label').textContent = count % 3 === 0 ? buttonLabels[1 + Math.floor(Math.random() * 3)] : buttonLabels[0];
  }
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => selectMode(Number(button.dataset.mode))));
  ['generate', 'again'].forEach(id => byId(id).addEventListener('click', generate));
  byId('surprise').addEventListener('click', () => { selectMode(Math.floor(Math.random() * 3)); generate(); });
  byId('drama').addEventListener('click', () => {
    if (!scenario) return;
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
      const event = document.createElement('small');
      event.textContent = 'Meanwhile: ' + item.event.text + (item.event.alternative ? ' ' + item.event.alternative : '');
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

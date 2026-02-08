/* Guided review module - Review Generator */
(function () {
  'use strict';

  // ============================================
  // CONFIGURATION & DATA
  // ============================================
  const DATA = window.GUIDED_DATA;
  const DEFAULTS = DATA.defaults || {};
  const SUPPORTED = new Set(DATA.supportedLangs || ['it', 'en']);

  // Block order patterns for anti-pattern diversity
  const BLOCK_ORDERS = [
    ["overall", "highlights", "staff", "moment", "closer"],
    ["highlights", "overall", "staff", "moment", "closer"],
    ["staff", "overall", "highlights", "moment", "closer"],
    ["overall", "moment", "highlights", "staff", "closer"],
    ["highlights", "staff", "overall", "moment", "closer"]
  ];

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  function qsa(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function detectLang() {
    const url = new URL(window.location.href);
    const lp = (url.searchParams.get('lang') || '').toLowerCase().trim();
    if (SUPPORTED.has(lp)) return lp;

    // Detect from browser preferences (check all generic languages)
    const navLangs = navigator.languages || [navigator.language || 'en'];
    for (const lang of navLangs) {
      const code = lang.slice(0, 2).toLowerCase();
      if (SUPPORTED.has(code)) return code;
    }

    return 'en'; // Default fallback to English (International)
  }

  function getParam(name, fallback = '') {
    const url = new URL(window.location.href);
    return (url.searchParams.get(name) || fallback).trim();
  }

  function getTone() {
    return getParam('tone', 'mixed').toLowerCase();
  }

  function pickSnippet(source, tone) {
    if (!source) return '';
    // Backward compatibility: if array, pick random
    if (Array.isArray(source)) {
      return pick(source);
    }
    // Tone support: source is object { neutral: [], ... }
    if (typeof source === 'object') {
      if (tone === 'mixed') {
        const keys = Object.keys(source);
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        return pick(source[randomKey]);
      }
      return pick(source[tone] || source['neutral'] || source[Object.keys(source)[0]]);
    }
    return String(source);
  }

  function t(lang, key) {
    return (DATA.i18n[lang] && DATA.i18n[lang][key]) ||
      (DATA.i18n.en && DATA.i18n.en[key]) || key;
  }

  function format(lang, key, vars) {
    let s = t(lang, key);
    Object.entries(vars || {}).forEach(([k, v]) => {
      s = s.replaceAll('{' + k + '}', String(v));
    });
    return s;
  }

  function pick(arr) {
    return (arr && arr.length) ? arr[Math.floor(Math.random() * arr.length)] : '';
  }

  function listJoin(lang, items) {
    const clean = items.filter(Boolean);
    if (clean.length === 0) return '';
    if (clean.length === 1) return clean[0];
    const conj = (lang === 'it') ? 'e' :
      (lang === 'es') ? 'y' :
        (lang === 'fr') ? 'et' :
          (lang === 'de') ? 'und' : 'and';
    if (clean.length === 2) return clean[0] + ' ' + conj + ' ' + clean[1];
    return clean.slice(0, -1).join(', ') + ' ' + conj + ' ' + clean[clean.length - 1];
  }

  function normalize(s) {
    return (s || '').replace(/\s+/g, ' ').trim();
  }

  // ============================================
  // LABEL BUILDING (snippet selection)
  // ============================================

  function buildLabels(lang, qKey) {
    const opts = (((DATA.questions || {})[qKey] || {}).options || {})[lang] || [];
    const map = {};
    const tone = getTone(); // Detect tone from URL
    opts.forEach(o => {
      if (o.snippets) {
        map[o.id] = pickSnippet(o.snippets, tone);
      } else {
        map[o.id] = o.label.toLowerCase();
      }
    });
    return map;
  }

  // ============================================
  // REVIEW GENERATION
  // ============================================

  function buildReview(lang, staff, answers, noteText) {
    const templates = DATA.templates[lang] || DATA.templates.en;
    const overallId = (answers.overall && answers.overall[0]) || 'excellent';
    const overall = (templates.overallMap && templates.overallMap[overallId]) || overallId;
    const tone = getTone();

    // Build labels from selections
    const highlightLabels = (answers.highlights || [])
      .map(id => answers._labels.highlights[id])
      .filter(Boolean);
    const staffHelpLabels = (answers.staffHelp || [])
      .map(id => answers._labels.staffHelp[id])
      .filter(Boolean);
    const momentLabel = (answers.moment && answers.moment[0])
      ? answers._labels.moment[answers.moment[0]] : '';
    const recommendLabel = (answers.recommendTo && answers.recommendTo[0])
      ? answers._labels.recommendTo[answers.recommendTo[0]] : '';

    // Build opener
    const opener = pickSnippet(templates.openers, tone).replaceAll('{overall}', overall);

    // Build highlights block
    let highlights = '';
    if (highlightLabels.length) {
      const hl = listJoin(lang, highlightLabels.slice(0, 3));
      highlights = pickSnippet(templates.highlightIntro, tone).replaceAll('{highlights}', hl);
    }

    // Build staff block
    const staffBase = pickSnippet(templates.staffLines, tone).replaceAll('{staff}', staff);
    let staffLine = staffBase;
    if (staffHelpLabels.length) {
      const sh = listJoin(lang, staffHelpLabels.slice(0, 2));
      const detail = pickSnippet(templates.staffDetailIntro, tone).replaceAll('{staffHelp}', sh);
      staffLine = normalize(staffBase + ' ' + detail);
    }

    // Build moment block
    let momentLine = '';
    if (momentLabel) {
      momentLine = pickSnippet(templates.momentLines, tone).replaceAll('{moment}', momentLabel.toLowerCase());
    }

    // Build note block
    let noteLine = '';
    const note = normalize(noteText);
    if (note.length >= 3) {
      noteLine = pick(templates.noteLines).replaceAll('{note}', note);
    }

    // Build closer block
    let closer = '';
    if (recommendLabel) {
      closer = pickSnippet(templates.closers, tone).replaceAll('{recommendTo}', recommendLabel.toLowerCase());
    }

    // Block map for permutation
    const blockMap = {
      overall: opener,
      highlights: highlights,
      staff: staffLine,
      moment: momentLine,
      closer: closer
    };

    // Random block order selection
    const order = BLOCK_ORDERS[Math.floor(Math.random() * BLOCK_ORDERS.length)];

    // Build parts following chosen order
    let parts = order
      .map(k => blockMap[k])
      .map(normalize)
      .filter(Boolean);

    // Insert noteLine before closer if present
    if (noteLine) {
      const noteNorm = normalize(noteLine);
      if (noteNorm) {
        const idxCloser = parts.findIndex(p => p === normalize(closer));
        if (idxCloser >= 0) {
          parts.splice(idxCloser, 0, noteNorm);
        } else {
          parts.push(noteNorm);
        }
      }
    }

    let text = parts.join('\n');

    // Ensure minimum length for TripAdvisor
    const min = DEFAULTS.minCharsTripadvisor || 100;
    if (text.length < min) {
      const extras = {
        it: "Nel complesso, un soggiorno che consiglio volentieri.",
        en: "Overall, a stay I would happily recommend.",
        es: "En general, una estancia que recomendaría con gusto.",
        fr: "Globalement, un séjour que je recommande volontiers.",
        de: "Insgesamt ein Aufenthalt, den ich gerne empfehle."
      };
      text += '\n' + (extras[lang] || extras.en);
    }

    return text.trim();
  }

  // ============================================
  // UI RENDERING
  // ============================================

  function renderChoices(lang) {
    // Update header text
    qs('[data-i18n="title"]').textContent = t(lang, 'title');
    qs('[data-i18n="subtitle"]').textContent = t(lang, 'subtitle');

    // Update staff display
    const staff = getParam('staff', '');
    qs('#staff-label').textContent = t(lang, 'staffLabel');
    qs('#staff-value').textContent = staff || '—';

    // Question blocks configuration
    const blocks = [
      { key: 'overall', titleKey: 'step1', max: 1 },
      { key: 'highlights', titleKey: 'step2', max: DATA.questions.highlights.max || 3 },
      { key: 'staffHelp', titleKey: 'step3', max: DATA.questions.staffHelp.max || 2 },
      { key: 'moment', titleKey: 'step4', max: 1 },
      { key: 'recommendTo', titleKey: 'step5', max: 1 },
    ];

    // Render each question block
    blocks.forEach(b => {
      const wrap = qs('#q-' + b.key);
      qs('h2', wrap).textContent = t(lang, b.titleKey);
      qs('.hint', wrap).textContent = format(lang, 'maxPick', { n: b.max });

      const list = qs('.choices', wrap);
      list.innerHTML = '';

      const opts = (DATA.questions[b.key].options[lang] || DATA.questions[b.key].options.en || []);
      opts.forEach(opt => {
        const item = document.createElement('label');
        item.className = 'choice';

        const input = document.createElement('input');
        input.type = (b.max === 1) ? 'radio' : 'checkbox';
        input.name = b.key;
        input.value = opt.id;

        const span = document.createElement('span');
        span.textContent = opt.label;

        item.appendChild(input);
        item.appendChild(span);
        list.appendChild(item);
      });
    });

    // Update other UI elements
    qs('#notes-label').textContent = t(lang, 'notesLabel');
    qs('#notes').placeholder = t(lang, 'notesPlaceholder');
    qs('#btn-generate').textContent = t(lang, 'generate');
    qs('#btn-back').textContent = t(lang, 'back');
    qs('#btn-copy').textContent = t(lang, 'copy');
    qs('#btn-google').textContent = t(lang, 'copyOpenGoogle');
    qs('#btn-trip').textContent = t(lang, 'copyOpenTrip');
    qs('#btn-restart').textContent = t(lang, 'restart');
    qs('#overlay-title').textContent = t(lang, 'pasteHintTitle');
    qs('#overlay-body').textContent = t(lang, 'pasteHintBody');
    qs('#overlay-open').textContent = t(lang, 'openNow');
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  function enforceMaxPicks(container, max) {
    container.addEventListener('change', () => {
      const inputs = qsa('input[type="checkbox"]', container);
      const checked = inputs.filter(i => i.checked);
      if (checked.length <= max) return;
      checked.slice(max).forEach(i => i.checked = false);
    });
  }

  async function tryCopy(text) {
    const s = (text || '').trim();
    if (!s) return false;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(s);
        return true;
      }
    } catch (_) { }

    // Fallback for older browsers & iOS specific handling
    try {
      const ta = document.createElement('textarea');
      ta.value = s;

      // iOS needs contentEditable = true to select text without keyboard popping up if readonly is set wrong
      // But actually, 'readonly' prevents selection on some iOS versions.
      // Best practice for iOS:
      ta.contentEditable = true;
      ta.readOnly = false;

      ta.style.position = 'fixed'; // Prevent scrolling to bottom
      ta.style.left = '-9999px';
      ta.style.top = '0';

      document.body.appendChild(ta);

      // iOS selection magic
      const range = document.createRange();
      range.selectNodeContents(ta);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      ta.setSelectionRange(0, 999999); // Big number for all text

      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    } catch (_) { }

    return false;
  }

  function showToast(msg) {
    const el = qs('#toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2000);
  }

  function collectAnswers(lang) {
    const answers = {
      overall: [],
      highlights: [],
      staffHelp: [],
      moment: [],
      recommendTo: [],
      _labels: {
        highlights: buildLabels(lang, 'highlights'),
        staffHelp: buildLabels(lang, 'staffHelp'),
        moment: buildLabels(lang, 'moment'),
        recommendTo: buildLabels(lang, 'recommendTo'),
      }
    };

    // Collect radio button selections
    ['overall', 'moment', 'recommendTo'].forEach(k => {
      const sel = qs(`input[name="${k}"]:checked`);
      if (sel) answers[k] = [sel.value];
    });

    // Collect checkbox selections
    ['highlights', 'staffHelp'].forEach(k => {
      qsa(`input[name="${k}"]:checked`).forEach(i => answers[k].push(i.value));
    });

    return answers;
  }

  function showOverlay(url) {
    const overlay = qs('#overlay');
    overlay.dataset.url = url;
    overlay.classList.add('open');
  }

  function hideOverlay() {
    const overlay = qs('#overlay');
    overlay.classList.remove('open');
    overlay.dataset.url = '';
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  function init() {
    const lang = detectLang();
    const staff = getParam('staff', '').trim();
    const googleUrl = getParam('google', DEFAULTS.googleReviewUrl || '');
    const tripUrl = getParam('trip', DEFAULTS.tripReviewUrl || '');

    // Render UI
    renderChoices(lang);

    // Set up max pick enforcement
    enforceMaxPicks(qs('#q-highlights'), DATA.questions.highlights.max || 3);
    enforceMaxPicks(qs('#q-staffHelp'), DATA.questions.staffHelp.max || 2);

    const resultBox = qs('#result');
    const charBox = qs('#char-count');

    function updateChar() {
      charBox.textContent = format(lang, 'charCount', { n: (resultBox.value || '').length });
    }

    function generate() {
      if (!staff) {
        showToast(t(lang, 'staffMissing'));
        return;
      }
      const answers = collectAnswers(lang);
      const note = qs('#notes').value || '';
      const review = buildReview(lang, staff, answers, note);
      resultBox.value = review;
      updateChar();
      qs('#result-card').classList.add('show');
      qs('#result-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Event listeners
    qs('#btn-generate').addEventListener('click', generate);

    qs('#btn-copy').addEventListener('click', async () => {
      const ok = await tryCopy(resultBox.value || '');
      showToast(ok ? t(lang, 'copied') : 'Copy failed');
    });

    qs('#btn-google').addEventListener('click', async () => {
      if (!resultBox.value.trim()) generate();
      const ok = await tryCopy(resultBox.value || '');
      showToast(ok ? t(lang, 'copied') : 'Copy failed');
      if (googleUrl) showOverlay(googleUrl);
    });

    qs('#btn-trip').addEventListener('click', async () => {
      if (!resultBox.value.trim()) generate();
      const ok = await tryCopy(resultBox.value || '');
      showToast(ok ? t(lang, 'copied') : 'Copy failed');
      if (tripUrl) showOverlay(tripUrl);
    });

    qs('#btn-restart').addEventListener('click', () => {
      qsa('input').forEach(i => i.checked = false);
      qs('#notes').value = '';
      resultBox.value = '';
      updateChar();
      qs('#result-card').classList.remove('show');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    qs('#btn-back').addEventListener('click', () => {
      window.location.href = '../';
    });

    qs('#overlay-close').addEventListener('click', hideOverlay);

    qs('#overlay-open').addEventListener('click', () => {
      const url = qs('#overlay').dataset.url;
      hideOverlay();
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    });

    updateChar();
  }

  // Start when DOM is ready
  document.addEventListener('DOMContentLoaded', init);
})();

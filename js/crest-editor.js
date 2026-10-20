import { t } from './i18n.js';
import {
  CREST_PALETTE,
  CREST_PATTERNS,
  CREST_SYMBOLS,
  DEFAULT_PLAYER_CREST,
  renderCustomCrestDataUrl
} from './crest-custom.js';

function wrapPaletteIndex(index) {
  const n = CREST_PALETTE.length;
  return ((index % n) + n) % n;
}

function paletteIndex(color) {
  const i = CREST_PALETTE.indexOf(color);
  return i === -1 ? 0 : i;
}

function colorField(id, label, value) {
  const index = paletteIndex(value);
  const prev = CREST_PALETTE[wrapPaletteIndex(index - 1)];
  const cur = CREST_PALETTE[index];
  const next = CREST_PALETTE[wrapPaletteIndex(index + 1)];

  return `
    <div class="crest-field crest-color-field">
      <span class="crest-field-label">${label}</span>
      <div class="crest-color-picker" data-crest-color-picker data-crest-field="${id}" data-crest-color-index="${index}">
        <button type="button" class="crest-color-nav" data-crest-color-prev aria-label="${t('crestColorPrev')}">‹</button>
        <div class="crest-color-strip" role="group" aria-label="${label}">
          <button type="button" class="crest-color-swatch crest-color-side" data-side="prev"
            style="--swatch:${prev}" aria-label="${prev}"></button>
          <button type="button" class="crest-color-swatch crest-color-center active"
            style="--swatch:${cur}" aria-label="${cur}" aria-current="true"></button>
          <button type="button" class="crest-color-swatch crest-color-side" data-side="next"
            style="--swatch:${next}" aria-label="${next}"></button>
        </div>
        <button type="button" class="crest-color-nav" data-crest-color-next aria-label="${t('crestColorNext')}">›</button>
      </div>
    </div>`;
}

function renderColorPicker(picker, index) {
  const prev = CREST_PALETTE[wrapPaletteIndex(index - 1)];
  const cur = CREST_PALETTE[index];
  const next = CREST_PALETTE[wrapPaletteIndex(index + 1)];

  picker.dataset.crestColorIndex = String(index);
  picker.querySelector('[data-side="prev"]').style.setProperty('--swatch', prev);
  picker.querySelector('[data-side="prev"]').setAttribute('aria-label', prev);
  picker.querySelector('.crest-color-center').style.setProperty('--swatch', cur);
  picker.querySelector('.crest-color-center').setAttribute('aria-label', cur);
  picker.querySelector('[data-side="next"]').style.setProperty('--swatch', next);
  picker.querySelector('[data-side="next"]').setAttribute('aria-label', next);
  return cur;
}

export function buildCrestEditorHtml(config, clubName) {
  const previewUrl = renderCustomCrestDataUrl(config, clubName);

  const patterns = CREST_PATTERNS.map(p => `
    <button type="button" class="crest-pattern-btn${config.pattern === p.id ? ' active' : ''}"
      data-crest-pattern="${p.id}">${t(p.labelKey)}</button>`).join('');

  const symbols = CREST_SYMBOLS.map(s => `
    <button type="button" class="crest-symbol-btn${config.symbol === s.id ? ' active' : ''}"
      data-crest-symbol="${s.id}">${t(s.labelKey)}</button>`).join('');

  return `
    <div class="crest-editor" data-crest-editor>
      <h3 class="crest-editor-title">${t('crestEditorTitle')}</h3>
      <p class="crest-editor-hint">${t('crestEditorHint')}</p>
      <div class="crest-editor-layout">
        <div class="crest-editor-preview-col">
          <p class="crest-editor-preview-label">${t('crestPreview')}</p>
          <div class="crest-editor-preview-wrap">
            <img src="${previewUrl}" alt="" class="crest-editor-preview" data-crest-preview width="140" height="158"/>
          </div>
        </div>
        <div class="crest-editor-controls">
          <div class="crest-field crest-field-patterns">
            <span class="crest-field-label">${t('crestPattern')}</span>
            <div class="crest-pattern-grid">${patterns}</div>
          </div>
          <div class="crest-color-fields">
            ${colorField('primary', t('crestPrimary'), config.primary)}
            ${colorField('secondary', t('crestSecondary'), config.secondary)}
            ${colorField('accent', t('crestAccent'), config.accent)}
            ${colorField('symbolColor', t('crestSymbolColor'), config.symbolColor)}
          </div>
          <div class="crest-field crest-field-symbols">
            <span class="crest-field-label">${t('crestSymbol')}</span>
            <div class="crest-symbol-grid">${symbols}</div>
          </div>
        </div>
      </div>
      <div class="crest-editor-actions">
        <button type="button" class="btn btn-secondary" data-crest-cancel>${t('crestCancel')}</button>
        <button type="button" class="btn btn-primary" data-crest-save>${t('crestSave')}</button>
      </div>
    </div>`;
}

export function bindCrestEditor(root, { clubName, initialConfig, onChange, onSave, onCancel }) {
  let draft = { ...DEFAULT_PLAYER_CREST, ...initialConfig };

  function refreshPreview() {
    const img = root.querySelector('[data-crest-preview]');
    if (img) img.src = renderCustomCrestDataUrl(draft, clubName);
    onChange?.(draft);
  }

  function setDraftField(field, value) {
    draft = { ...draft, [field]: value };
    const img = root.querySelector('[data-crest-preview]');
    if (img) img.src = renderCustomCrestDataUrl(draft, clubName);
    onChange?.(draft);
  }

  root.querySelectorAll('[data-crest-pattern]').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('[data-crest-pattern]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setDraftField('pattern', btn.dataset.crestPattern);
    });
  });

  root.querySelectorAll('[data-crest-symbol]').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('[data-crest-symbol]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setDraftField('symbol', btn.dataset.crestSymbol);
    });
  });

  root.querySelectorAll('[data-crest-color-picker]').forEach(picker => {
    const field = picker.dataset.crestField;
    let index = Number(picker.dataset.crestColorIndex) || paletteIndex(draft[field]);

    const shift = delta => {
      index = wrapPaletteIndex(index + delta);
      const color = renderColorPicker(picker, index);
      setDraftField(field, color);
    };

    picker.querySelector('[data-crest-color-prev]')?.addEventListener('click', () => shift(-1));
    picker.querySelector('[data-crest-color-next]')?.addEventListener('click', () => shift(1));
    picker.querySelector('[data-side="prev"]')?.addEventListener('click', () => shift(-1));
    picker.querySelector('[data-side="next"]')?.addEventListener('click', () => shift(1));
  });

  root.querySelector('[data-crest-save]')?.addEventListener('click', () => onSave?.(draft));
  root.querySelector('[data-crest-cancel]')?.addEventListener('click', () => onCancel?.());

  refreshPreview();
  return () => draft;
}

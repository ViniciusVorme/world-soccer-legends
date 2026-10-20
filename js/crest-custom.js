import { teamInitials } from './match-ui.js';

const SHIELD_D = 'M32 2 L58 10 L58 42 C58 58 46 68 32 70 C18 68 6 58 6 42 L6 10 Z';
const W = 64;
const H = 72;
const SCALE = 2;

export const DEFAULT_PLAYER_CREST = {
  pattern: 'solid',
  primary: '#e8a830',
  secondary: '#1a1613',
  accent: '#ffffff',
  symbol: 'initials',
  symbolColor: '#1a1613'
};

export const CREST_PATTERNS = [
  { id: 'solid', labelKey: 'crestPatternSolid' },
  { id: 'stripes-v', labelKey: 'crestPatternStripesV' },
  { id: 'stripes-h', labelKey: 'crestPatternStripesH' },
  { id: 'diagonal', labelKey: 'crestPatternDiagonal' },
  { id: 'split-v', labelKey: 'crestPatternSplitV' },
  { id: 'split-h', labelKey: 'crestPatternSplitH' },
  { id: 'quarters', labelKey: 'crestPatternQuarters' },
  { id: 'hoops', labelKey: 'crestPatternHoops' },
  { id: 'pinstripes', labelKey: 'crestPatternPinstripes' },
  { id: 'sash', labelKey: 'crestPatternSash' },
  { id: 'chevron', labelKey: 'crestPatternChevron' },
  { id: 'border', labelKey: 'crestPatternBorder' }
];

export const CREST_SYMBOLS = [
  { id: 'initials', labelKey: 'crestSymbolInitials' },
  { id: 'star', labelKey: 'crestSymbolStar' },
  { id: 'cross', labelKey: 'crestSymbolCross' },
  { id: 'circle', labelKey: 'crestSymbolCircle' },
  { id: 'ring', labelKey: 'crestSymbolRing' },
  { id: 'diamond', labelKey: 'crestSymbolDiamond' },
  { id: 'triangle', labelKey: 'crestSymbolTriangle' },
  { id: 'shield', labelKey: 'crestSymbolShield' },
  { id: 'bolt', labelKey: 'crestSymbolBolt' },
  { id: 'ball', labelKey: 'crestSymbolBall' },
  { id: 'none', labelKey: 'crestSymbolNone' }
];

export const CREST_PALETTE = [
  '#e8a830', '#f0c040', '#f5e050', '#ff6f00', '#d35400',
  '#c8102e', '#e23b54', '#7b1e3a', '#7a1531', '#e91e63',
  '#006b3f', '#2d8a3e', '#4caf82', '#9e9d24', '#00897b',
  '#003da5', '#0099d8', '#10243e', '#1e5aa8', '#9c7bff',
  '#6a1b9a', '#5c3a1e', '#8d6e63', '#d08070', '#455a64',
  '#1a1a1a', '#3a3a3a', '#808080', '#cfcfcf', '#ffffff'
];

let playerCrestConfig = { ...DEFAULT_PLAYER_CREST };
const dataUrlCache = new Map();

function normalizeConfig(config) {
  return {
    pattern: config?.pattern || DEFAULT_PLAYER_CREST.pattern,
    primary: config?.primary || DEFAULT_PLAYER_CREST.primary,
    secondary: config?.secondary || DEFAULT_PLAYER_CREST.secondary,
    accent: config?.accent || DEFAULT_PLAYER_CREST.accent,
    symbol: config?.symbol || DEFAULT_PLAYER_CREST.symbol,
    symbolColor: config?.symbolColor || DEFAULT_PLAYER_CREST.symbolColor
  };
}

function star(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawText(ctx, str, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.font = `800 ${size}px "Bebas Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

function drawPattern(ctx, config) {
  const { pattern, primary, secondary, accent } = config;

  if (pattern === 'solid') {
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, W, H);
    return;
  }

  if (pattern === 'stripes-v') {
    [primary, secondary, accent || secondary].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect((W / 3) * i, 0, W / 3 + 0.6, H);
    });
    return;
  }

  if (pattern === 'stripes-h') {
    [primary, secondary, accent || secondary].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(0, (H / 3) * i, W, H / 3 + 0.6);
    });
    return;
  }

  if (pattern === 'diagonal') {
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = secondary;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (pattern === 'split-v') {
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, W / 2, H);
    ctx.fillStyle = secondary;
    ctx.fillRect(W / 2, 0, W / 2, H);
    return;
  }

  if (pattern === 'split-h') {
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, W, H / 2);
    ctx.fillStyle = secondary;
    ctx.fillRect(0, H / 2, W, H / 2);
    return;
  }

  if (pattern === 'quarters') {
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, W / 2, H / 2);
    ctx.fillRect(W / 2, H / 2, W / 2, H / 2);
    ctx.fillStyle = secondary;
    ctx.fillRect(W / 2, 0, W / 2, H / 2);
    ctx.fillRect(0, H / 2, W / 2, H / 2);
    return;
  }

  if (pattern === 'hoops') {
    const n = 6;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 === 0 ? primary : secondary;
      ctx.fillRect(0, (H / n) * i, W, H / n + 0.6);
    }
    return;
  }

  if (pattern === 'pinstripes') {
    const n = 8;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 === 0 ? primary : secondary;
      ctx.fillRect((W / n) * i, 0, W / n + 0.6, H);
    }
    return;
  }

  if (pattern === 'sash') {
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = accent || secondary;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(24, 0);
    ctx.lineTo(W, H - 24);
    ctx.lineTo(W, H);
    ctx.lineTo(W - 24, H);
    ctx.lineTo(0, 24);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (pattern === 'chevron') {
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = secondary;
    ctx.beginPath();
    ctx.moveTo(0, 24);
    ctx.lineTo(W / 2, 46);
    ctx.lineTo(W, 24);
    ctx.lineTo(W, 40);
    ctx.lineTo(W / 2, 62);
    ctx.lineTo(0, 40);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (pattern === 'border') {
    ctx.fillStyle = secondary;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    const cx = W / 2;
    const cy = H / 2;
    const s = 0.72;
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = primary;
    ctx.fill(new Path2D(SHIELD_D));
    ctx.restore();
    return;
  }

  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, W, H);
}

function drawSymbol(ctx, config, clubName) {
  const color = config.symbolColor;
  const cx = 32;
  const cy = 40;

  if (config.symbol === 'none') return;

  if (config.symbol === 'initials') {
    drawText(ctx, teamInitials(clubName), cx, 42, 15, color);
    return;
  }

  if (config.symbol === 'star') {
    star(ctx, cx, cy, 13, color);
    return;
  }

  if (config.symbol === 'cross') {
    ctx.fillStyle = color;
    ctx.fillRect(29, 24, 6, 32);
    ctx.fillRect(20, 33, 24, 6);
    return;
  }

  if (config.symbol === 'circle') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (config.symbol === 'ring') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  if (config.symbol === 'diamond') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 14);
    ctx.lineTo(cx + 11, cy);
    ctx.lineTo(cx, cy + 14);
    ctx.lineTo(cx - 11, cy);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (config.symbol === 'triangle') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 13);
    ctx.lineTo(cx + 13, cy + 11);
    ctx.lineTo(cx - 13, cy + 11);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (config.symbol === 'shield') {
    ctx.save();
    const s = 0.4;
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.translate(-W / 2, -H / 2 - 2);
    ctx.fillStyle = color;
    ctx.fill(new Path2D(SHIELD_D));
    ctx.restore();
    return;
  }

  if (config.symbol === 'bolt') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx + 6, cy - 15);
    ctx.lineTo(cx - 9, cy + 3);
    ctx.lineTo(cx - 1, cy + 3);
    ctx.lineTo(cx - 6, cy + 15);
    ctx.lineTo(cx + 9, cy - 3);
    ctx.lineTo(cx + 1, cy - 3);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (config.symbol === 'ball') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const x = cx + 5.5 * Math.cos(a);
      const y = cy + 5.5 * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
}

export function renderCustomCrestDataUrl(config, clubName) {
  config = normalizeConfig(config);
  const key = `${JSON.stringify(config)}:${clubName}`;
  if (dataUrlCache.has(key)) return dataUrlCache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  ctx.save();
  ctx.clip(new Path2D(SHIELD_D));
  drawPattern(ctx, config);
  drawSymbol(ctx, config, clubName);
  ctx.restore();

  ctx.strokeStyle = '#1a1613';
  ctx.lineWidth = 1.4;
  ctx.stroke(new Path2D(SHIELD_D));

  const url = canvas.toDataURL('image/png');
  dataUrlCache.set(key, url);
  return url;
}

export function getPlayerCrestConfig() {
  return { ...playerCrestConfig };
}

export function setPlayerCrestConfig(config) {
  playerCrestConfig = normalizeConfig(config);
  dataUrlCache.clear();
}

export function resetPlayerCrest() {
  setPlayerCrestConfig(DEFAULT_PLAYER_CREST);
}

export function loadPlayerCrestFromStorage() {
  return resetPlayerCrest();
}

export function savePlayerCrestToStorage(config) {
  setPlayerCrestConfig(config);
}

export function getPlayerCrestDataUrl(clubName) {
  return renderCustomCrestDataUrl(playerCrestConfig, clubName || 'Meu Clube FC');
}

export function invalidateCrestCache() {
  dataUrlCache.clear();
}

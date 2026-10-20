/** Escudos desenhados em canvas para recorte confiável em qualquer navegador. */

import { registerCrestAliases, resolveCrestKey } from './club-names.js';

const SHIELD_D = 'M32 2 L58 10 L58 42 C58 58 46 68 32 70 C18 68 6 58 6 42 L6 10 Z';
const W = 64;
const H = 72;
const SCALE = 2;

const CREST_VERSION = 3;
const crestCache = new Map();

function stripesV(ctx, colors) {
  const step = W / colors.length;
  colors.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i * step, 0, step + 0.6, H);
  });
}

function stripesH(ctx, colors) {
  const step = H / colors.length;
  colors.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(0, i * step, W, step + 0.6);
  });
}

function fillShield(ctx, color) {
  const p = new Path2D(SHIELD_D);
  ctx.fillStyle = color;
  ctx.fill(p);
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

function text(ctx, str, x, y, size, color, weight = '800', family = 'Arial, sans-serif') {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

function strokeShield(ctx, color, width = 2.2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke(new Path2D(SHIELD_D));
}

/** Monograma CR do Remo. */
function drawRemoMonogram(ctx, cx, cy) {
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 21px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('C', cx - 5, cy);
  ctx.fillText('R', cx + 6, cy);
}

/** Emblema circular tricolor do Bahia. */
function drawBahiaEmblem(ctx) {
  const cx = 32;
  const cy = 40;
  const r = 21;

  ctx.fillStyle = '#003da5';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
  ctx.fill();

  const inner = r - 7;
  const rows = 6;
  const rowH = (inner * 2) / rows;
  for (let i = 0; i < rows; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#d62d3a' : '#fff';
    ctx.fillRect(cx - inner, cy - inner + i * rowH, inner * 2, rowH + 0.5);
  }

  ctx.fillStyle = '#003da5';
  ctx.fillRect(cx - inner, cy - inner, inner * 0.95, inner * 0.9);
  star(ctx, cx - inner * 0.48, cy - inner * 0.52, 3.2, '#fff');

  star(ctx, 22, 15, 2.8, '#f0c040');
  star(ctx, 42, 15, 2.8, '#f0c040');
}

/** Desenha o conteúdo DENTRO do escudo (ctx já clipado). */
const DRAWERS = {
  Palmeiras(ctx) {
    fillShield(ctx, '#006437');
    ctx.fillStyle = '#b8d62e';
    ctx.beginPath();
    ctx.moveTo(32, 14);
    ctx.bezierCurveTo(26, 22, 24, 30, 26, 38);
    ctx.bezierCurveTo(28, 32, 30, 26, 32, 22);
    ctx.bezierCurveTo(34, 26, 36, 32, 38, 38);
    ctx.bezierCurveTo(40, 30, 38, 22, 32, 14);
    ctx.fill();
    text(ctx, 'P', 32, 52, 18, '#fff');
  },

  Flamengo: (ctx) => stripesH(ctx, ['#c8102e', '#1a1a1a', '#c8102e', '#1a1a1a', '#c8102e']),
  Fluminense: (ctx) => stripesV(ctx, ['#7a1531', '#fff', '#006b3f']),
  Coritiba: (ctx) => stripesV(ctx, ['#006b3f', '#fff', '#006b3f', '#fff', '#006b3f']),
  Santos: (ctx) => stripesH(ctx, ['#fff', '#1a1a1a', '#fff', '#1a1a1a', '#fff']),
  'Grêmio': (ctx) => stripesV(ctx, ['#0099d8', '#1a1a1a', '#fff']),
  'Vila Nova': (ctx) => stripesV(ctx, ['#c8102e', '#fff', '#c8102e']),
  Criciúma: (ctx) => stripesV(ctx, ['#f0c040', '#006b3f', '#1a1a1a']),
  'Operário-PR': (ctx) => stripesV(ctx, ['#1a1a1a', '#fff', '#1a1a1a']),
  Athletic: (ctx) => stripesV(ctx, ['#1a1a1a', '#fff', '#1a1a1a']),
  Juventude: (ctx) => stripesV(ctx, ['#006b3f', '#fff', '#006b3f']),
  Ceará: (ctx) => stripesV(ctx, ['#1a1a1a', '#fff', '#1a1a1a']),
  Avaí: (ctx) => stripesV(ctx, ['#0099d8', '#fff', '#0099d8']),
  Londrina: (ctx) => stripesH(ctx, ['#c8102e', '#fff', '#003da5']),
  'Ponte Preta': (ctx) => stripesV(ctx, ['#1a1a1a', '#fff', '#1a1a1a', '#fff', '#1a1a1a']),

  'Athletico Paranaense'(ctx) {
    fillShield(ctx, '#c8102e');
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(32, 12);
    ctx.lineTo(54, 68);
    ctx.lineTo(10, 68);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c8102e';
    ctx.beginPath();
    ctx.moveTo(32, 12);
    ctx.lineTo(54, 68);
    ctx.lineTo(32, 68);
    ctx.closePath();
    ctx.fill();
  },

  'Red Bull Bragantino'(ctx) {
    fillShield(ctx, '#c8102e');
    ctx.fillStyle = '#fff';
    ctx.fillRect(10, 38, 44, 8);
    ctx.beginPath();
    ctx.arc(22, 34, 4, 0, Math.PI * 2);
    ctx.arc(42, 34, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(32, 27, 10, Math.PI, 0);
    ctx.stroke();
  },

  Bahia(ctx) {
    fillShield(ctx, '#003da5');
    drawBahiaEmblem(ctx);
  },

  'São Paulo'(ctx) {
    stripesH(ctx, ['#c8102e', '#fff', '#1a1a1a']);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(32, 18);
    ctx.lineTo(48, 58);
    ctx.lineTo(16, 58);
    ctx.closePath();
    ctx.fill();
  },

  'Atlético Mineiro'(ctx) {
    stripesH(ctx, ['#1a1a1a', '#fff', '#1a1a1a', '#fff', '#1a1a1a']);
    star(ctx, 32, 34, 12, '#f0c040');
  },

  Corinthians(ctx) {
    fillShield(ctx, '#fff');
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(14, 22, 4, 34);
    ctx.fillRect(46, 22, 4, 34);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(32, 40, 10, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
  },

  Cruzeiro(ctx) {
    fillShield(ctx, '#003da5');
    ctx.fillStyle = '#fff';
    [[26, 28], [38, 28], [32, 36], [26, 44], [38, 44]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillRect(30, 48, 4, 12);
  },

  Botafogo(ctx) {
    fillShield(ctx, '#000');
    strokeShield(ctx, '#fff', 3);
    star(ctx, 32, 40, 13, '#fff');
  },

  Vitória(ctx) {
    fillShield(ctx, '#c8102e');
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(64, 72);
    ctx.lineTo(0, 72);
    ctx.closePath();
    ctx.fill();
    text(ctx, 'V', 32, 48, 22, '#fff');
  },

  Internacional(ctx) {
    fillShield(ctx, '#c8102e');
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(32, 40, 16, 0, Math.PI * 2);
    ctx.stroke();
    text(ctx, 'C', 32, 42, 16, '#fff');
  },

  'Vasco da Gama'(ctx) {
    fillShield(ctx, '#1a1a1a');
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(64, 72);
    ctx.lineTo(0, 72);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c8102e';
    ctx.beginPath();
    ctx.arc(32, 40, 8, 0, Math.PI * 2);
    ctx.fill();
  },

  Remo(ctx) {
    fillShield(ctx, '#0c2340');
    strokeShield(ctx, '#fff', 2.5);
    drawRemoMonogram(ctx, 32, 40);
  },

  Mirassol(ctx) {
    fillShield(ctx, '#006b3f');
    ctx.fillStyle = '#f0c040';
    ctx.beginPath();
    ctx.arc(32, 34, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#006b3f';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(32, 23);
    ctx.lineTo(32, 45);
    ctx.moveTo(23, 34);
    ctx.lineTo(41, 34);
    ctx.stroke();
  },

  Chapecoense(ctx) {
    fillShield(ctx, '#006b3f');
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(20, 50);
    ctx.lineTo(32, 22);
    ctx.lineTo(44, 50);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#f0c040';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(24, 48);
    ctx.quadraticCurveTo(28, 38, 32, 38);
    ctx.quadraticCurveTo(36, 38, 40, 48);
    ctx.stroke();
  },

  'São Bernardo'(ctx) {
    stripesH(ctx, ['#f0c040', '#003da5', '#003da5']);
    text(ctx, 'SB', 32, 50, 14, '#fff');
  },

  'Sport Recife'(ctx) {
    fillShield(ctx, '#c8102e');
    ctx.fillStyle = '#f0c040';
    ctx.beginPath();
    ctx.arc(32, 38, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c8102e';
    ctx.beginPath();
    ctx.ellipse(32, 34, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(32, 44, 8, 0.2, Math.PI - 0.2);
    ctx.stroke();
  },

  Náutico(ctx) {
    stripesH(ctx, ['#c8102e', '#fff', '#c8102e', '#fff', '#c8102e']);
    ctx.fillStyle = '#003da5';
    ctx.beginPath();
    ctx.arc(32, 40, 8, 0, Math.PI * 2);
    ctx.fill();
  },

  Fortaleza(ctx) {
    stripesH(ctx, ['#003da5', '#c8102e', '#fff']);
    text(ctx, 'F', 32, 40, 16, '#fff');
  },

  'Goiás'(ctx) {
    fillShield(ctx, '#006b3f');
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(32, 38, 15, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, 'G', 32, 40, 18, '#006b3f');
  },

  Novorizontino(ctx) {
    fillShield(ctx, '#006b3f');
    ctx.fillStyle = '#f0c040';
    ctx.beginPath();
    ctx.moveTo(32, 18);
    ctx.lineTo(44, 56);
    ctx.lineTo(20, 56);
    ctx.closePath();
    ctx.fill();
  },

  'Atlético Goianiense'(ctx) {
    fillShield(ctx, '#c8102e');
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(32, 12);
    ctx.lineTo(54, 68);
    ctx.lineTo(10, 68);
    ctx.closePath();
    ctx.fill();
    text(ctx, 'AG', 32, 48, 14, '#fff');
  },

  CRB(ctx) {
    fillShield(ctx, '#003da5');
    star(ctx, 32, 32, 14, '#fff');
    ctx.fillStyle = '#fff';
    ctx.fillRect(30, 48, 4, 10);
  },

  Cuiabá(ctx) {
    fillShield(ctx, '#006b3f');
    ctx.fillStyle = '#f0c040';
    ctx.beginPath();
    ctx.arc(32, 36, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(20, 50);
    ctx.quadraticCurveTo(32, 42, 44, 50);
    ctx.lineTo(44, 54);
    ctx.lineTo(20, 54);
    ctx.closePath();
    ctx.fill();
  },

  'Botafogo-SP'(ctx) {
    fillShield(ctx, '#c8102e');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 26, W, 10);
    ctx.fillStyle = 'rgba(26,26,26,0.85)';
    ctx.beginPath();
    ctx.moveTo(32, 16);
    ctx.lineTo(48, 54);
    ctx.lineTo(16, 54);
    ctx.closePath();
    ctx.fill();
  },

  'América Mineiro'(ctx) {
    fillShield(ctx, '#006b3f');
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(32, 38, 16, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, 'A', 32, 40, 16, '#fff');
  },

  // ─── Série C ───

  Anápolis(ctx) {
    stripesV(ctx, ['#c8102e', '#1a1a1a', '#fff']);
    text(ctx, 'A', 32, 42, 18, '#f0c040', '900');
  },

  Figueirense(ctx) {
    fillShield(ctx, '#1a1a1a');
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 5;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(8 + i * 10, 0);
      ctx.lineTo(56 + i * 10, H);
      ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(32, 38, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d8a3e';
    ctx.beginPath();
    ctx.moveTo(32, 30);
    ctx.lineTo(36, 38);
    ctx.lineTo(34, 46);
    ctx.lineTo(30, 46);
    ctx.lineTo(28, 38);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5c3a1e';
    ctx.fillRect(31, 44, 2, 5);
  },

  'Botafogo-PB'(ctx) {
    stripesH(ctx, ['#1a1a1a', '#fff', '#1a1a1a']);
    star(ctx, 32, 40, 10, '#c8102e');
  },

  Confiança(ctx) {
    stripesV(ctx, ['#003da5', '#fff', '#003da5']);
    text(ctx, 'C', 32, 42, 18, '#003da5');
  },

  Brusque(ctx) {
    fillShield(ctx, '#f0c040');
    ctx.fillStyle = '#c8102e';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(64, 0);
    ctx.lineTo(64, 36);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#006b3f';
    ctx.beginPath();
    ctx.moveTo(0, 36);
    ctx.lineTo(64, 36);
    ctx.lineTo(64, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    text(ctx, 'B', 32, 44, 16, '#fff');
  },

  Floresta(ctx) {
    fillShield(ctx, '#006b3f');
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(32, 36, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d8a3e';
    ctx.beginPath();
    ctx.moveTo(32, 26);
    ctx.lineTo(38, 36);
    ctx.lineTo(36, 44);
    ctx.lineTo(28, 44);
    ctx.lineTo(26, 36);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5c3a1e';
    ctx.fillRect(31, 42, 2, 6);
    star(ctx, 32, 54, 3, '#fff');
  },

  Caxias(ctx) {
    fillShield(ctx, '#7b1e3a');
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(32, 38, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7b1e3a';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      const r = i % 2 === 0 ? 11 : 7;
      const x = 32 + r * Math.cos(a);
      const y = 38 + r * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    text(ctx, 'C', 32, 40, 12, '#fff', '900');
  },

  Ferroviária(ctx) {
    fillShield(ctx, '#7b1e3a');
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(32, 42, 18, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, 'AFE', 32, 44, 11, '#7b1e3a', '900');
    star(ctx, 22, 18, 3, '#7b1e3a');
    star(ctx, 32, 14, 3.5, '#7b1e3a');
    star(ctx, 42, 18, 3, '#7b1e3a');
  },

  Paysandu(ctx) {
    stripesV(ctx, ['#0099d8', '#fff', '#0099d8']);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(32, 40, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0099d8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(26, 40);
    ctx.lineTo(38, 40);
    ctx.moveTo(38, 40);
    ctx.lineTo(44, 34);
    ctx.moveTo(38, 40);
    ctx.lineTo(44, 46);
    ctx.stroke();
    text(ctx, 'P', 32, 41, 8, '#0099d8', '900');
    star(ctx, 32, 16, 3, '#f0c040');
  },

  Barra(ctx) {
    stripesV(ctx, ['#003da5', '#fff', '#003da5']);
    star(ctx, 32, 22, 4, '#f0c040');
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(24, 50);
    ctx.quadraticCurveTo(32, 42, 40, 50);
    ctx.stroke();
  },

  Itabaiana(ctx) {
    fillShield(ctx, '#c8102e');
    ctx.fillStyle = '#006b3f';
    ctx.beginPath();
    ctx.moveTo(0, 40);
    ctx.lineTo(64, 40);
    ctx.lineTo(64, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    text(ctx, 'I', 32, 52, 14, '#fff');
  },

  Ypiranga(ctx) {
    fillShield(ctx, '#006b3f');
    ctx.fillStyle = '#fff';
    ctx.fillRect(8, 14, 48, 18);
    text(ctx, 'YFC', 32, 24, 10, '#006b3f', '900');
    const cols = 5;
    for (let i = 0; i < cols; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#f0c040' : '#006b3f';
      ctx.fillRect(8 + i * (48 / cols), 36, 48 / cols + 0.5, 28);
    }
  },

  Maringá(ctx) {
    stripesH(ctx, ['#f0c040', '#006b3f', '#f0c040']);
    text(ctx, 'M', 32, 42, 16, '#1a1a1a', '900');
  },

  Guarani(ctx) {
    fillShield(ctx, '#006b3f');
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(32, 38, 17, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(32, 38, 13, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, 'G', 32, 40, 16, '#006b3f', '900');
    star(ctx, 24, 18, 2.5, '#f0c040');
    star(ctx, 40, 18, 2.5, '#f0c040');
  },

  'Volta Redonda'(ctx) {
    fillShield(ctx, '#f0c040');
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(64, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    star(ctx, 24, 20, 3, '#f0c040');
    star(ctx, 40, 20, 3, '#f0c040');
    text(ctx, 'VR', 32, 50, 11, '#fff', '900');
  },

  Maranhão(ctx) {
    fillShield(ctx, '#c8102e');
    ctx.fillStyle = '#006b3f';
    ctx.beginPath();
    ctx.moveTo(32, 16);
    ctx.lineTo(54, 56);
    ctx.lineTo(10, 56);
    ctx.closePath();
    ctx.fill();
    text(ctx, 'M', 32, 48, 12, '#fff');
  },

  Limeira(ctx) {
    stripesV(ctx, ['#003da5', '#fff', '#003da5']);
    text(ctx, 'L', 32, 42, 18, '#003da5', '900');
  },

  Ituano(ctx) {
    fillShield(ctx, '#1a1a1a');
    ctx.fillStyle = '#c8102e';
    ctx.fillRect(18, 20, 6, 40);
    ctx.fillRect(29, 20, 6, 40);
    ctx.fillRect(40, 20, 6, 40);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(10, 22);
    ctx.lineTo(54, 34);
    ctx.lineTo(54, 42);
    ctx.lineTo(10, 30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(16, 26, 3, 0, Math.PI * 2);
    ctx.fill();
  },

  'Santa Cruz'(ctx) {
    fillShield(ctx, '#c8102e');
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(32, 14);
    ctx.lineTo(58, 58);
    ctx.lineTo(6, 58);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(32, 24);
    ctx.lineTo(32, 50);
    ctx.moveTo(24, 32);
    ctx.lineTo(40, 32);
    ctx.arc(32, 32, 8, Math.PI, 0);
    ctx.stroke();
    text(ctx, 'SC', 32, 54, 9, '#fff', '900');
  }
};

registerCrestAliases(DRAWERS);

function renderCrestToDataUrl(teamName) {
  const drawer = DRAWERS[resolveCrestKey(teamName)];
  if (!drawer) return null;

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  ctx.save();
  const shield = new Path2D(SHIELD_D);
  ctx.clip(shield);
  drawer(ctx);
  ctx.restore();

  ctx.strokeStyle = '#1a1613';
  ctx.lineWidth = 1.2;
  ctx.stroke(new Path2D(SHIELD_D));

  return canvas.toDataURL('image/png');
}

export function getCrestDataUrl(teamName) {
  const key = `${CREST_VERSION}:${teamName}`;
  if (crestCache.has(key)) return crestCache.get(key);
  const url = renderCrestToDataUrl(teamName);
  if (url) crestCache.set(key, url);
  return url;
}

export function hasParodyCrest(teamName) {
  return Boolean(DRAWERS[resolveCrestKey(teamName)]);
}

/** @deprecated use getCrestDataUrl — mantido para compatibilidade */
export function getCrestSvg(teamName) {
  return null;
}

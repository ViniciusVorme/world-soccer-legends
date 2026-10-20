/**
 * Áudio procedural — música ambiente e efeitos sem arquivos externos.
 * Requer unlock() após gesto do usuário (clique).
 */

/* ─── Notas e harmonia (C maior) ─── */
const N = {
  A2: 110, A3: 220, B3: 246.94,
  C3: 130.81, C4: 261.63, C5: 523.25,
  D3: 146.83, D4: 293.66, D5: 587.33,
  E3: 164.81, E4: 329.63, E5: 659.25,
  F3: 174.61, F4: 349.23,
  G3: 196, G4: 392, B4: 493.88, A4: 440
};

const CHORDS = {
  C:  { bass: N.C3, pad: [N.C3, N.E3, N.G3, N.C4], arp: [N.C4, N.E4, N.G4, N.C5] },
  Am: { bass: N.A2, pad: [N.A2, N.E3, N.A3, N.C4], arp: [N.A3, N.C4, N.E4, N.A3] },
  F:  { bass: N.F3, pad: [N.F3, N.A3, N.C4, N.F4], arp: [N.F4, N.A4, N.C5, N.F4] },
  G:  { bass: N.G3, pad: [N.G3, N.B3, N.D4, N.G4], arp: [N.G4, N.B4, N.D5, N.G4] },
  Dm: { bass: N.D3, pad: [N.D3, N.F3, N.A3, N.D4], arp: [N.D4, N.F4, N.A4, N.D4] }
};

const MENU_PROG = ['C', 'C', 'Am', 'Am', 'F', 'F', 'G', 'G'];
const LOBBY_PROG = ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G'];

/** Melodia principal do menu — 8 compassos, estilo tema de manager */
const MENU_MELODY = [
  { bar: 0, beat: 0, f: N.E4, len: 0.5 }, { bar: 0, beat: 0.5, f: N.G4, len: 0.5 },
  { bar: 0, beat: 1, f: N.C5, len: 1 }, { bar: 0, beat: 2, f: N.G4, len: 0.5 },
  { bar: 0, beat: 2.5, f: N.E4, len: 0.5 }, { bar: 0, beat: 3, f: N.C4, len: 1 },
  { bar: 1, beat: 0, f: N.D4, len: 0.5 }, { bar: 1, beat: 0.5, f: N.E4, len: 0.5 },
  { bar: 1, beat: 1, f: N.G4, len: 1.5 },
  { bar: 2, beat: 0, f: N.A4, len: 0.5 }, { bar: 2, beat: 0.5, f: N.C5, len: 0.5 },
  { bar: 2, beat: 1, f: N.E5, len: 0.75 }, { bar: 2, beat: 1.75, f: N.C5, len: 0.25 },
  { bar: 2, beat: 2, f: N.A4, len: 1 },
  { bar: 3, beat: 0, f: N.G4, len: 0.5 }, { bar: 3, beat: 0.5, f: N.E4, len: 0.5 },
  { bar: 3, beat: 1, f: N.C4, len: 2 },
  { bar: 4, beat: 0, f: N.F4, len: 0.5 }, { bar: 4, beat: 0.5, f: N.A4, len: 0.5 },
  { bar: 4, beat: 1, f: N.C5, len: 1 }, { bar: 4, beat: 2, f: N.A4, len: 0.5 },
  { bar: 4, beat: 2.5, f: N.F4, len: 0.5 }, { bar: 4, beat: 3, f: N.D4, len: 1 },
  { bar: 5, beat: 0, f: N.E4, len: 0.5 }, { bar: 5, beat: 0.5, f: N.F4, len: 0.5 },
  { bar: 5, beat: 1, f: N.G4, len: 1.5 },
  { bar: 6, beat: 0, f: N.G4, len: 0.5 }, { bar: 6, beat: 0.5, f: N.B4, len: 0.5 },
  { bar: 6, beat: 1, f: N.D5, len: 1 }, { bar: 6, beat: 2, f: N.B4, len: 0.5 },
  { bar: 6, beat: 2.5, f: N.G4, len: 0.5 }, { bar: 6, beat: 3, f: N.E4, len: 1 },
  { bar: 7, beat: 0, f: N.F4, len: 0.5 }, { bar: 7, beat: 0.5, f: N.E4, len: 0.5 },
  { bar: 7, beat: 1, f: N.C4, len: 2 }
];

/** Andante pastoral — mesma pulsação no menu e na gestão */
const THEME_BPM = 100;

/** Resposta melódica suave — toca na gestão, complementa o tema principal */
const LOBBY_COUNTER = [
  { bar: 0, beat: 0, f: N.C4, len: 1 }, { bar: 0, beat: 2, f: N.E4, len: 1 },
  { bar: 1, beat: 0, f: N.G4, len: 1.5 },
  { bar: 2, beat: 0, f: N.A4, len: 0.5 }, { bar: 2, beat: 0.5, f: N.G4, len: 0.5 },
  { bar: 2, beat: 1, f: N.E4, len: 1.5 },
  { bar: 3, beat: 0, f: N.D4, len: 0.5 }, { bar: 3, beat: 0.5, f: N.C4, len: 2.5 },
  { bar: 4, beat: 0, f: N.A3, len: 1 }, { bar: 4, beat: 2, f: N.C4, len: 1 },
  { bar: 5, beat: 0, f: N.E4, len: 1.5 },
  { bar: 6, beat: 0, f: N.D4, len: 0.5 }, { bar: 6, beat: 0.5, f: N.E4, len: 0.5 },
  { bar: 6, beat: 1, f: N.G4, len: 1.5 },
  { bar: 7, beat: 0, f: N.E4, len: 0.5 }, { bar: 7, beat: 0.5, f: N.D4, len: 0.5 },
  { bar: 7, beat: 1, f: N.C4, len: 2 }
];

const MASTER_GAIN = 0.82;

const engine = {
  ctx: null,
  unlocked: false,
  master: null,
  musicGain: null,
  musicDry: null,
  musicWet: null,
  sfxGain: null,
  crowdGain: null,
  musicEnabled: true,
  sfxEnabled: true,
  platformMuted: false,
  musicMode: 'off',
  lastMusicMode: 'menu',
  crowd: null,
  musicSched: null,
  musicSchedTimer: null,
  musicSchedGen: 0,
  musicReverbIn: null,
  matchAmbienceActive: false
};

function now() {
  return engine.ctx?.currentTime ?? 0;
}

function syncPlatformMuteOutput() {
  if (engine.master) {
    const t = now();
    engine.master.gain.cancelScheduledValues(t);
    engine.master.gain.setValueAtTime(engine.platformMuted ? 0 : MASTER_GAIN, t);
  }
  for (const clip of Object.values(resultClips)) {
    clip.muted = engine.platformMuted;
  }
  if (engine.platformMuted) stopResultSound();
}

/** Silêncio externo — não altera as preferências de música e efeitos do jogador. */
export function setPlatformMuted(muted) {
  engine.platformMuted = !!muted;
  syncPlatformMuteOutput();
}

export function isPlatformMuted() {
  return engine.platformMuted;
}

function ensureCtx() {
  if (!engine.ctx) return false;
  if (engine.ctx.state === 'suspended') engine.ctx.resume();
  return engine.unlocked;
}

export async function unlockAudio() {
  if (engine.unlocked) {
    await engine.ctx?.resume();
    return;
  }

  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;

  engine.ctx = new Ctx();
  await engine.ctx.resume();

  engine.master = engine.ctx.createGain();
  engine.master.gain.value = engine.platformMuted ? 0 : MASTER_GAIN;
  engine.master.connect(engine.ctx.destination);

  engine.musicGain = engine.ctx.createGain();
  engine.musicDry = engine.ctx.createGain();
  engine.musicWet = engine.ctx.createGain();
  engine.sfxGain = engine.ctx.createGain();
  engine.crowdGain = engine.ctx.createGain();
  engine.musicGain.gain.value = 0.14;
  engine.musicDry.gain.value = 0.72;
  engine.musicWet.gain.value = 0.28;
  engine.sfxGain.gain.value = 0.62;
  engine.crowdGain.gain.value = 0;

  engine.musicGain.connect(engine.master);
  engine.sfxGain.connect(engine.master);
  engine.crowdGain.connect(engine.master);

  setupMusicReverb();
  preloadResultSounds();

  engine.unlocked = true;
  syncPlatformMuteOutput();
}

function createNoiseLoop(filterFreq, q = 0.35) {
  const bufferSize = engine.ctx.sampleRate * 4;
  const buffer = engine.ctx.createBuffer(1, bufferSize, engine.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < bufferSize; i++) {
    brown = (brown + (Math.random() * 2 - 1) * 0.08) * 0.992;
    data[i] = brown;
  }
  const source = engine.ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const filter = engine.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  filter.Q.value = q;
  source.connect(filter);
  return { source, filter };
}

/* ─── Motor de música procedural ─── */

function setupMusicReverb() {
  const d1 = engine.ctx.createDelay(0.6);
  d1.delayTime.value = 0.11;
  const d2 = engine.ctx.createDelay(0.8);
  d2.delayTime.value = 0.237;
  const fb = engine.ctx.createGain();
  fb.gain.value = 0.28;
  const damp = engine.ctx.createBiquadFilter();
  damp.type = 'lowpass';
  damp.frequency.value = 2200;

  engine.musicReverbIn = d1;
  d1.connect(damp);
  damp.connect(d2);
  d2.connect(fb);
  fb.connect(d1);
  d2.connect(engine.musicGain);
  wireMusicBus();
}

/** Descarta vozes já agendadas no Web Audio (evita trilha duplicada após partida). */
function resetMusicBus() {
  if (!engine.ctx || !engine.musicReverbIn) return;
  try { engine.musicDry.disconnect(); } catch (_) { /* noop */ }
  try { engine.musicWet.disconnect(); } catch (_) { /* noop */ }
  engine.musicDry = engine.ctx.createGain();
  engine.musicWet = engine.ctx.createGain();
  engine.musicDry.gain.value = 0.72;
  engine.musicWet.gain.value = 0.28;
  wireMusicBus();
}

function wireMusicBus() {
  engine.musicDry.connect(engine.musicGain);
  engine.musicWet.connect(engine.musicReverbIn);
}

function beatSec(bpm) {
  return 60 / bpm;
}

function connectMusicOut(node, wet = 0.35) {
  const dry = engine.ctx.createGain();
  dry.gain.value = 1 - wet;
  const wetG = engine.ctx.createGain();
  wetG.gain.value = wet;
  node.connect(dry);
  node.connect(wetG);
  dry.connect(engine.musicDry);
  wetG.connect(engine.musicWet);
}

function schedOsc(t0, freq, dur, peak, type = 'sine', attack = 0.04) {
  const osc = engine.ctx.createOscillator();
  const g = engine.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.setValueAtTime(peak * 0.82, t0 + dur * 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  connectMusicOut(g, type === 'sine' ? 0.45 : 0.3);
  osc.start(t0);
  osc.stop(t0 + dur + 0.06);
}

function schedPad(t0, dur, freqs, peak = 0.055) {
  const bus = engine.ctx.createGain();
  bus.gain.setValueAtTime(0.0001, t0);
  bus.gain.linearRampToValueAtTime(peak, t0 + 0.65);
  bus.gain.setValueAtTime(peak * 0.92, t0 + dur - 0.45);
  bus.gain.linearRampToValueAtTime(0.0001, t0 + dur);
  const lp = engine.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1400;
  bus.connect(lp);
  connectMusicOut(lp, 0.5);

  for (const f of freqs) {
    const osc = engine.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const g = engine.ctx.createGain();
    g.gain.value = 0.28;
    osc.connect(g);
    g.connect(bus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.08);
  }
}

function schedBass(t0, freq, dur, peak = 0.09) {
  schedOsc(t0, freq, dur, peak, 'sine', 0.02);
}

function schedPluck(t0, freq, dur, peak = 0.05) {
  const osc = engine.ctx.createOscillator();
  const g = engine.ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  const lp = engine.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2800;
  osc.connect(g);
  g.connect(lp);
  connectMusicOut(lp, 0.25);
  osc.start(t0);
  osc.stop(t0 + dur + 0.04);
}

function schedHat(t0, peak = 0.018) {
  const dur = 0.04;
  const buf = engine.ctx.createBuffer(1, Math.floor(engine.ctx.sampleRate * dur), engine.ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = engine.ctx.createBufferSource();
  src.buffer = buf;
  const hp = engine.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  const g = engine.ctx.createGain();
  g.gain.value = peak;
  src.connect(hp);
  hp.connect(g);
  connectMusicOut(g, 0.1);
  src.start(t0);
  src.stop(t0 + dur);
}

function schedKick(t0, peak = 0.07) {
  const osc = engine.ctx.createOscillator();
  const g = engine.ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, t0);
  osc.frequency.exponentialRampToValueAtTime(48, t0 + 0.12);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
  osc.connect(g);
  connectMusicOut(g, 0.08);
  osc.start(t0);
  osc.stop(t0 + 0.16);
}

function schedWood(t0, peak = 0.022) {
  schedOsc(t0, 340, 0.07, peak, 'sine', 0.004);
}

function scheduleMelodyEvents(t0, beat, bar, events, peak, harmPeak) {
  for (const ev of events) {
    if (ev.bar !== bar) continue;
    const noteT = t0 + ev.beat * beat;
    const noteDur = ev.len * beat * 0.92;
    schedOsc(noteT, ev.f, noteDur, peak, 'triangle', 0.03);
    if (ev.len >= 0.75 && harmPeak > 0) {
      schedOsc(noteT + 0.02, ev.f * 1.5, noteDur * 0.88, harmPeak, 'sine', 0.09);
    }
  }
}

/** Tema unificado — menu com mais corpo; gestão mantém melodia e arpejo (vibe Stardew) */
function scheduleThemeBar(t0, barIdx, bpm, mode) {
  const isMenu = mode === 'menu';
  const beat = beatSec(bpm);
  const barDur = beat * 4;
  const cycle = Math.floor(barIdx / 8);
  const bar = barIdx % 8;
  const prog = isMenu ? MENU_PROG : LOBBY_PROG;
  const chordKey = prog[bar];
  const chord = CHORDS[chordKey];

  schedPad(t0, barDur, chord.pad, isMenu ? 0.056 : 0.05);
  schedPad(t0, barDur, chord.pad.map(f => f * 2), isMenu ? 0.017 : 0.022);

  schedBass(t0, chord.bass, beat * (isMenu ? 0.85 : 1.1), isMenu ? 0.08 : 0.062);
  if (isMenu || bar % 2 === 0) {
    schedBass(t0 + beat * 2, chord.bass, beat * 0.85, isMenu ? 0.072 : 0.055);
  }

  for (let i = 0; i < 8; i++) {
    const arpF = chord.arp[i % chord.arp.length];
    const arpT = t0 + i * (beat / 2);
    schedPluck(arpT, arpF, beat * (isMenu ? 0.42 : 0.48), isMenu ? 0.036 : 0.03);
  }

  if (isMenu) {
    schedKick(t0, 0.06);
    schedKick(t0 + beat * 2, 0.046);
    schedHat(t0 + beat * 1, 0.012);
    schedHat(t0 + beat * 3, 0.012);
    schedHat(t0 + beat * 1.5, 0.008);
    schedHat(t0 + beat * 2.5, 0.008);
    schedHat(t0 + beat * 3.5, 0.008);
  } else {
    schedWood(t0 + beat * 1, 0.018);
    schedWood(t0 + beat * 3, 0.015);
  }

  const melPeak = isMenu ? 0.07 : 0.056;
  const harmPeak = isMenu ? 0.024 : 0.02;
  scheduleMelodyEvents(t0, beat, bar, MENU_MELODY, melPeak, harmPeak);

  if (!isMenu && cycle % 2 === 1) {
    scheduleMelodyEvents(t0, beat, bar, LOBBY_COUNTER, 0.038, 0);
  }
}

function musicSchedulerTick() {
  const gen = engine.musicSchedGen;
  const mode = engine.musicMode;
  if (!ensureCtx() || !engine.musicEnabled || (mode !== 'menu' && mode !== 'lobby') || !engine.musicSched) {
    engine.musicSchedTimer = null;
    return;
  }

  const bpm = THEME_BPM;
  const barDur = beatSec(bpm) * 4;
  const t = now();
  const lookahead = 0.6;

  while (engine.musicSched.nextBar < t + lookahead + barDur * 5) {
    scheduleThemeBar(engine.musicSched.nextBar, engine.musicSched.barIdx, bpm, mode);
    engine.musicSched.nextBar += barDur;
    engine.musicSched.barIdx++;
  }

  engine.musicSchedTimer = setTimeout(() => {
    if (gen !== engine.musicSchedGen) return;
    musicSchedulerTick();
  }, 25);
}

function stopAllMusicLayers() {
  engine.musicSchedGen++;
  if (engine.musicSchedTimer) {
    clearTimeout(engine.musicSchedTimer);
    engine.musicSchedTimer = null;
  }
  engine.musicSched = null;
  resetMusicBus();
}

function fadeMusicGain(target, seconds = 0.6) {
  if (!ensureCtx()) return;
  const t = now();
  engine.musicGain.gain.cancelScheduledValues(t);
  engine.musicGain.gain.setValueAtTime(engine.musicGain.gain.value, t);
  engine.musicGain.gain.linearRampToValueAtTime(target, t + seconds);
}

function silenceMusicGain(immediate = true) {
  if (!ensureCtx()) return;
  const t = now();
  engine.musicGain.gain.cancelScheduledValues(t);
  if (immediate) {
    engine.musicGain.gain.setValueAtTime(0, t);
  } else {
    engine.musicGain.gain.setValueAtTime(engine.musicGain.gain.value, t);
    engine.musicGain.gain.linearRampToValueAtTime(0, t + 0.25);
  }
}

function silenceCrowd(immediate = true) {
  if (!ensureCtx()) return;
  const t = now();
  engine.crowdGain.gain.cancelScheduledValues(t);
  if (immediate) {
    engine.crowdGain.gain.setValueAtTime(0, t);
    stopCrowdBed();
    return;
  }
  engine.crowdGain.gain.setValueAtTime(engine.crowdGain.gain.value, t);
  engine.crowdGain.gain.linearRampToValueAtTime(0, t + 0.5);
  setTimeout(() => stopCrowdBed(), 520);
}

function ensureMusicScheduler() {
  if (!engine.musicSched) {
    engine.musicSched = { barIdx: 0, nextBar: now() + 0.1 };
  }
  if (!engine.musicSchedTimer) musicSchedulerTick();
}

function startMenuTheme() {
  if (!ensureCtx() || !engine.musicEnabled) return;
  stopAllMusicLayers();
  engine.musicMode = 'menu';
  engine.lastMusicMode = 'menu';
  fadeMusicGain(0.2, 0.5);
  engine.musicSched = { barIdx: 0, nextBar: now() + 0.1 };
  musicSchedulerTick();
}

function startLobbyTheme() {
  if (!ensureCtx() || !engine.musicEnabled) return;
  stopAllMusicLayers();
  engine.musicMode = 'lobby';
  engine.lastMusicMode = 'lobby';
  fadeMusicGain(0.19, 0.8);
  engine.musicSched = { barIdx: 0, nextBar: now() + 0.1 };
  musicSchedulerTick();
}

/** Menu → gestão sem reiniciar o tema */
function transitionToLobbyTheme() {
  if (!ensureCtx() || !engine.musicEnabled) return;
  engine.musicMode = 'lobby';
  engine.lastMusicMode = 'lobby';
  fadeMusicGain(0.19, 1.4);
  ensureMusicScheduler();
}

function startCrowdBed() {
  if (!ensureCtx() || engine.crowd) return;

  const low = createNoiseLoop(360, 0.35);
  const mid = createNoiseLoop(680, 0.48);
  const air = createNoiseLoop(1280, 0.6);

  const lowG = engine.ctx.createGain();
  lowG.gain.value = 0.52;
  const midG = engine.ctx.createGain();
  midG.gain.value = 0.4;
  const airG = engine.ctx.createGain();
  airG.gain.value = 0.14;

  low.filter.connect(lowG);
  mid.filter.connect(midG);
  air.filter.connect(airG);
  lowG.connect(engine.crowdGain);
  midG.connect(engine.crowdGain);
  airG.connect(engine.crowdGain);

  low.source.start();
  mid.source.start();
  air.source.start();

  engine.crowd = { sources: [low.source, mid.source, air.source] };
}

function stopCrowdBed() {
  if (!engine.crowd) return;
  const t = now();
  try {
    engine.crowdGain.gain.cancelScheduledValues(t);
    engine.crowdGain.gain.setValueAtTime(engine.crowdGain.gain.value, t);
    engine.crowdGain.gain.linearRampToValueAtTime(0, t + 0.8);
    const stopAt = t + 0.85;
    for (const src of engine.crowd.sources ?? []) {
      src.stop(stopAt);
    }
  } catch (_) { /* noop */ }
  engine.crowd = null;
}

export function startMenuAmbience() {
  if (!ensureCtx()) return;
  stopGameMusic();
  startMenuTheme();
}

export function startGameMusic() {
  if (!ensureCtx()) return;
  if (engine.musicMode === 'menu' && engine.musicSched) {
    transitionToLobbyTheme();
    return;
  }
  if (engine.musicMode === 'lobby' && engine.musicSched) return;
  stopAllMusicLayers();
  startLobbyTheme();
}

export function stopGameMusic() {
  stopAllMusicLayers();
  engine.musicMode = 'off';
}

export function startMatchAmbience() {
  if (!ensureCtx()) return;
  engine.matchAmbienceActive = true;
  stopAllMusicLayers();
  engine.musicMode = 'match';
  silenceMusicGain(true);
  if (!engine.musicEnabled) {
    silenceCrowd(true);
    return;
  }
  startCrowdBed();
  const t = now();
  engine.crowdGain.gain.cancelScheduledValues(t);
  engine.crowdGain.gain.setValueAtTime(0, t);
  engine.crowdGain.gain.linearRampToValueAtTime(0.38, t + 1.4);
}

export function stopMatchAmbience(immediate = false) {
  if (!ensureCtx()) return;
  engine.matchAmbienceActive = false;
  silenceCrowd(immediate);
}

/** Retoma a trilha de gestão após fechar o resultado da partida */
export function resumeAfterMatch() {
  if (!ensureCtx() || !engine.musicEnabled) return;
  engine.musicMode = 'lobby';
  engine.lastMusicMode = 'lobby';
  fadeMusicGain(0.19, 1.0);
  if (!engine.musicSched) {
    engine.musicSched = { barIdx: 0, nextBar: now() + 0.1 };
  }
  ensureMusicScheduler();
}

/* ─── Utilitários de síntese ─── */

function tone(freq, duration, type = 'sine', gain = 0.2, dest = null) {
  toneAt(now(), freq, duration, type, gain, dest);
}

function toneAt(t0, freq, duration, type = 'sine', gain = 0.2, dest = null) {
  if (!ensureCtx() || !engine.sfxEnabled) return;
  const osc = engine.ctx.createOscillator();
  const g = engine.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(dest || engine.sfxGain);
  osc.start(t0);
  osc.stop(t0 + duration + 0.06);
}

function createNoiseBuffer(seconds, kind = 'brown') {
  const bufferSize = Math.floor(engine.ctx.sampleRate * seconds);
  const buffer = engine.ctx.createBuffer(1, bufferSize, engine.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < bufferSize; i++) {
    if (kind === 'white') {
      data[i] = Math.random() * 2 - 1;
    } else {
      brown = (brown + (Math.random() * 2 - 1) * 0.16) * 0.982;
      data[i] = brown;
    }
  }
  return buffer;
}

function noiseBurst(duration, gain = 0.15, options = {}) {
  noiseBurstAt(now(), duration, gain, options);
}

function noiseBurstAt(t0, duration, gain = 0.15, options = {}) {
  if (!ensureCtx() || !engine.sfxEnabled) return;
  const bufferSize = Math.floor(engine.ctx.sampleRate * duration);
  const buffer = engine.ctx.createBuffer(1, bufferSize, engine.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const env = 1 - i / bufferSize;
    data[i] = (Math.random() * 2 - 1) * env * env;
  }
  const source = engine.ctx.createBufferSource();
  source.buffer = buffer;
  const filter = engine.ctx.createBiquadFilter();
  filter.type = options.filterType || 'bandpass';
  filter.frequency.value = options.filter ?? 900;
  filter.Q.value = options.q ?? 0.45;
  const g = engine.ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  source.connect(filter);
  filter.connect(g);
  g.connect(options.dest || engine.sfxGain);
  source.start(t0);
  source.stop(t0 + duration + 0.02);
}

/* ─── Sons de resultado (MP3) ─── */

const RESULT_FILES = {
  win: 'vitoria som do estadio.mp3',
  loss: 'derrota som do estadio.mp3',
  draw: 'empate som.mp3'
};

const resultClips = {};
let activeResultClip = null;

function resultAudioPath(file) {
  return `audio/${encodeURIComponent(file)}`;
}

function preloadResultSounds() {
  for (const [key, file] of Object.entries(RESULT_FILES)) {
    if (resultClips[key]) continue;
    const audio = new Audio(resultAudioPath(file));
    audio.preload = 'auto';
    audio.muted = engine.platformMuted;
    resultClips[key] = audio;
  }
}

function stopResultSound() {
  if (!activeResultClip) return;
  activeResultClip.pause();
  activeResultClip.currentTime = 0;
  activeResultClip = null;
}

/** Para sons de resultado e ambiente antes de nova partida ao vivo. */
export function resetMatchAudio() {
  stopResultSound();
  if (!ensureCtx()) return;
  engine.matchAmbienceActive = false;
  silenceCrowd(true);
}

function playResultClip(key) {
  if (!engine.sfxEnabled || engine.platformMuted) return;
  if (!resultClips[key]) preloadResultSounds();
  const clip = resultClips[key];
  if (!clip) return;
  stopResultSound();
  clip.volume = 0.58;
  clip.currentTime = 0;
  activeResultClip = clip;
  clip.play().catch(() => {});
}

export function playUiClick() {
  tone(880, 0.05, 'triangle', 0.08);
  tone(1320, 0.04, 'sine', 0.04);
}

function playShortWhistle(t0) {
  [2100, 1800].forEach((f, i) => {
    toneAt(t0 + i * 0.1, f, 0.13, 'sine', 0.11);
  });
}

export function playWhistle(kind = 'start') {
  if (!ensureCtx() || !engine.sfxEnabled) return;
  const t = now() + 0.02;
  if (kind === 'end') {
    playShortWhistle(t);
    return;
  }
  [1800, 2200, 2600].forEach((f, i) => {
    toneAt(t + i * 0.09, f, 0.11, 'sine', 0.12);
  });
  noiseBurst(0.08, 0.06);
}

export function playHalftime() {
  playShortWhistle(now() + 0.02);
  tone(392, 0.25, 'triangle', 0.06);
}

export function playGoal() {
  if (!ensureCtx() || !engine.sfxEnabled) return;
  const t = now();
  tone(523.25, 0.12, 'square', 0.1);
  setTimeout(() => tone(659.25, 0.14, 'square', 0.11), 80);
  setTimeout(() => tone(783.99, 0.22, 'square', 0.12), 160);
  noiseBurst(0.45, 0.22);
  if (engine.musicEnabled && engine.crowd) {
    engine.crowdGain.gain.cancelScheduledValues(t);
    engine.crowdGain.gain.setValueAtTime(engine.crowdGain.gain.value, t);
    engine.crowdGain.gain.linearRampToValueAtTime(0.62, t + 0.15);
    engine.crowdGain.gain.linearRampToValueAtTime(0.38, t + 1.8);
  }
}

export function playMatchResult(outcome) {
  const key = outcome === true ? 'win' : outcome === false ? 'loss' : 'draw';
  playResultClip(key);
}

export function setMusicEnabled(on) {
  engine.musicEnabled = on;
  if (!ensureCtx()) return;
  if (!on) {
    stopAllMusicLayers();
    silenceMusicGain(true);
    silenceCrowd(true);
    engine.musicMode = 'off';
    return;
  }
  if (engine.matchAmbienceActive) {
    engine.musicMode = 'match';
    silenceMusicGain(true);
    if (!engine.crowd) startCrowdBed();
    const t = now();
    engine.crowdGain.gain.cancelScheduledValues(t);
    engine.crowdGain.gain.setValueAtTime(0, t);
    engine.crowdGain.gain.linearRampToValueAtTime(0.38, t + 0.8);
    return;
  }
  if (engine.lastMusicMode === 'menu') startMenuTheme();
  else startLobbyTheme();
}

export function setSfxEnabled(on) {
  engine.sfxEnabled = on;
  if (!on) {
    stopResultSound();
    if (ensureCtx()) {
      engine.sfxGain.gain.cancelScheduledValues(now());
      engine.sfxGain.gain.setValueAtTime(0, now());
    }
  } else {
    if (ensureCtx()) {
      const t = now();
      engine.sfxGain.gain.cancelScheduledValues(t);
      engine.sfxGain.gain.setValueAtTime(0.62, t);
    }
    if (!Object.keys(resultClips).length) preloadResultSounds();
  }
}

export function isMusicEnabled() {
  return engine.musicEnabled;
}

export function isSfxEnabled() {
  return engine.sfxEnabled;
}

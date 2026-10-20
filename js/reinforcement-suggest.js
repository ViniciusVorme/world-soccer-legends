export const REINF_MAX_SEASON = 4;
export const REINF_MAX_PER_SECTOR = 2;
export const REINF_COOLDOWN_ROUNDS = 4;
export const REINF_LOSS_STREAK = 3;
export const REINF_MIN_MARGIN = 2;

const SECTOR_SLOTS = {
  gk: ['GOL'],
  def: ['LD', 'ZAG', 'LE'],
  mid: ['VOL', 'MC', 'MEI', 'MD', 'ME'],
  att: ['PD', 'PE', 'CA']
};

const SECTOR_ORDER = ['gk', 'def', 'mid', 'att'];
const NAME_VARIANTS = 3;
const GENERIC_VARIANTS = 3;
const SUBTITLE_KEYS = [
  'reinfListSubtitle0',
  'reinfListSubtitle1',
  'reinfListSubtitle2',
  'reinfListSubtitle4'
];

export function createReinforcementState() {
  return {
    lossStreak: 0,
    lossHistory: [],
    seasonShown: 0,
    seasonBySector: { gk: 0, def: 0, mid: 0, att: 0 },
    lastShownRound: 0,
    lastScapegoatId: null,
    limitSilenceFeedShown: false,
    usedTextKeys: [],
    pending: null
  };
}

export function ensureReinforcementFields(reinf) {
  if (!reinf) return createReinforcementState();
  if (!reinf.seasonBySector) reinf.seasonBySector = { gk: 0, def: 0, mid: 0, att: 0 };
  if (!reinf.lossHistory) reinf.lossHistory = [];
  if (!reinf.usedTextKeys) reinf.usedTextKeys = [];
  if (reinf.lossStreak == null) reinf.lossStreak = 0;
  if (reinf.seasonShown == null) reinf.seasonShown = 0;
  if (reinf.lastShownRound == null) reinf.lastShownRound = 0;
  if (reinf.limitSilenceFeedShown == null) reinf.limitSilenceFeedShown = false;
  return reinf;
}

export function resetReinforcementSeason(reinf) {
  ensureReinforcementFields(reinf);
  reinf.seasonShown = 0;
  reinf.seasonBySector = { gk: 0, def: 0, mid: 0, att: 0 };
  reinf.lastShownRound = 0;
  reinf.limitSilenceFeedShown = false;
  reinf.usedTextKeys = [];
  reinf.pending = null;
  reinf.lossStreak = 0;
  reinf.lossHistory = [];
}

function cloneLineup(lineup) {
  return (lineup || []).map(s => ({
    slotPos: s.slotPos,
    player: s.player ? { ...s.player } : null
  }));
}

export function computeSectorForces(lineup) {
  const sums = { gk: 0, def: 0, mid: 0, att: 0 };
  const counts = { gk: 0, def: 0, mid: 0, att: 0 };

  for (const { slotPos, player } of lineup || []) {
    if (!player) continue;
    for (const [sector, slots] of Object.entries(SECTOR_SLOTS)) {
      if (!slots.includes(slotPos)) continue;
      if (sector === 'gk') {
        sums.gk = player.force;
        counts.gk = 1;
      } else {
        sums[sector] += player.force;
        counts[sector] += 1;
      }
    }
  }

  return {
    gk: counts.gk ? sums.gk : 0,
    def: counts.def ? Math.round(sums.def / counts.def) : 0,
    mid: counts.mid ? Math.round(sums.mid / counts.mid) : 0,
    att: counts.att ? Math.round(sums.att / counts.att) : 0
  };
}

function lineupPlayers(lineup) {
  return (lineup || []).filter(s => s.player).map(s => ({ slotPos: s.slotPos, player: s.player }));
}

function bottomNPlayers(lineup, n) {
  return lineupPlayers(lineup)
    .sort((a, b) => a.player.force - b.player.force)
    .slice(0, n)
    .map(s => s.player);
}

function playerInSectorSlot(lineup, playerId, sector) {
  const slots = SECTOR_SLOTS[sector];
  return lineupPlayers(lineup).some(s => s.player.playerId === playerId && slots.includes(s.slotPos));
}

function getGkPlayer(lineup) {
  const slot = lineupPlayers(lineup).find(s => s.slotPos === 'GOL');
  return slot?.player ?? null;
}

function scorerIds(events, playerSide) {
  return new Set(
    (events || [])
      .filter(e => e.type === 'goal' && e.team === playerSide && e.playerId)
      .map(e => e.playerId)
  );
}

function minSectorKey(forces) {
  let key = 'def';
  let val = Infinity;
  for (const s of SECTOR_ORDER) {
    if (forces[s] > 0 && forces[s] < val) {
      val = forces[s];
      key = s;
    }
  }
  return key;
}

function scoreSectors(current, history) {
  const margin = current.opponentGoals - current.playerGoals;
  const scores = { gk: 0, def: 0, mid: 0, att: 0 };

  if (current.opponentGoals >= 3) scores.gk += 3;
  if (history.length >= REINF_LOSS_STREAK
    && history.every(h => h.opponentGoals - h.playerGoals >= REINF_MIN_MARGIN)) {
    scores.gk += 4;
  }

  const gk = getGkPlayer(current.lineup);
  if (gk && current.forces.def > 0 && gk.force <= current.forces.def) scores.gk += 2;
  const bottom2 = bottomNPlayers(current.lineup, 2);
  if (gk && bottom2.some(p => p.playerId === gk.playerId)) scores.gk += 2;

  if (margin >= REINF_MIN_MARGIN && current.forces.def < current.opponentStrength - 3) scores.def += 3;
  if (current.opponentGoals >= 2 && minSectorKey(current.forces) === 'def') scores.def += 3;

  let defBottomHits = 0;
  for (const h of history) {
    const b2 = bottomNPlayers(h.lineup, 2);
    if (b2.some(p => playerInSectorSlot(h.lineup, p.playerId, 'def'))) defBottomHits += 1;
  }
  if (defBottomHits >= 2) scores.def += 2;

  if (history.length >= REINF_LOSS_STREAK) {
    const avgDef = history.reduce((s, h) => s + h.forces.def, 0) / history.length;
    if (current.forces.def < avgDef) scores.def += 1;
  }

  const totalGoals = history.reduce((s, h) => s + h.playerGoals, 0) + current.playerGoals;
  if (history.length >= 2
    && history.every(h => h.playerGoals === 0)
    && current.playerGoals === 0
    && current.forces.mid < current.forces.att) {
    scores.mid += 3;
  }
  if (current.forces.mid < current.opponentStrength - 5) scores.mid += 2;

  let midBottomHits = 0;
  for (const h of history) {
    const b2 = bottomNPlayers(h.lineup, 2);
    if (b2.some(p => playerInSectorSlot(h.lineup, p.playerId, 'mid'))) midBottomHits += 1;
  }
  if (midBottomHits >= 2) scores.mid += 2;

  if (history.length >= 2
    && history.every(h => h.playerGoals === 0)
    && current.playerGoals === 0) {
    scores.att += 4;
  }
  if (history.length >= REINF_LOSS_STREAK - 1 && totalGoals <= 1) scores.att += 2;
  if (current.forces.att > 0 && current.forces.def > 0 && current.forces.att < current.forces.def) {
    scores.att += 2;
  }
  const attBottom = bottomNPlayers(current.lineup, 2);
  if (attBottom.some(p => playerInSectorSlot(current.lineup, p.playerId, 'att'))) scores.att += 2;

  return scores;
}

function pickWinningSector(scores) {
  let best = SECTOR_ORDER[0];
  let bestPts = scores[best];
  for (const s of SECTOR_ORDER) {
    if (scores[s] > bestPts) {
      best = s;
      bestPts = scores[s];
    }
  }
  if (bestPts <= 0) {
    if (scores.gk > 0) return 'gk';
    return 'def';
  }
  return best;
}

function pickScapegoat(sector, current, history) {
  if (sector === 'gk') return getGkPlayer(current.lineup);

  const allScorers = new Set();
  for (const h of history) {
    for (const id of h.scorerIds) allScorers.add(id);
  }
  for (const id of current.scorerIds) allScorers.add(id);

  const slots = SECTOR_SLOTS[sector];
  const tallies = new Map();

  for (const h of [...history, current]) {
    for (const { slotPos, player } of lineupPlayers(h.lineup)) {
      if (!slots.includes(slotPos)) continue;
      if (sector === 'att' && allScorers.has(player.playerId)) continue;
      const t = tallies.get(player.playerId) || { player, count: 0, minForce: player.force };
      t.count += 1;
      t.minForce = Math.min(t.minForce, player.force);
      tallies.set(player.playerId, t);
    }
  }

  let best = null;
  const candidates = [...tallies.values()];
  const repeated = candidates.filter(t => t.count >= 2);
  const pool = repeated.length ? repeated : candidates;
  pool.sort((a, b) => a.minForce - b.minForce || b.count - a.count);
  if (pool[0]) return pool[0].player;

  const last = lineupPlayers(current.lineup)
    .filter(s => slots.includes(s.slotPos))
    .filter(s => sector !== 'att' || !allScorers.has(s.player.playerId))
    .sort((a, b) => a.player.force - b.player.force)[0];
  return last?.player ?? null;
}

function pickTextKey(reinf, sector, hasName) {
  const prefix = hasName ? `reinf${cap(sector)}Name` : `reinf${cap(sector)}Generic`;
  const pool = [];
  const max = hasName ? NAME_VARIANTS : GENERIC_VARIANTS;
  for (let i = 0; i < max; i++) pool.push(`${prefix}${i}`);
  const available = pool.filter(k => !reinf.usedTextKeys.includes(k));
  const pick = available.length
    ? available[Math.floor(Math.random() * available.length)]
    : pool[Math.floor(Math.random() * pool.length)];
  reinf.usedTextKeys.push(pick);
  return pick;
}

function pickSubtitleKey() {
  return SUBTITLE_KEYS[Math.floor(Math.random() * SUBTITLE_KEYS.length)];
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function canShowByLimits(reinf, sector, round) {
  if (reinf.seasonShown >= REINF_MAX_SEASON) return false;
  if ((reinf.seasonBySector[sector] || 0) >= REINF_MAX_PER_SECTOR) return false;
  if (reinf.lastShownRound > 0 && round - reinf.lastShownRound < REINF_COOLDOWN_ROUNDS) return false;
  return true;
}

/**
 * @param {object} reinf
 * @param {object} match — { isWin, isDraw, playerGoals, opponentGoals, lineup, opponentStrength, round, events, playerSide }
 */
export function evaluateMatchForReinforcement(reinf, match) {
  reinf = ensureReinforcementFields(reinf);

  if (match.isWin || match.isDraw) {
    reinf.lossStreak = 0;
    reinf.lossHistory = [];
    return { reinf, trigger: null, silenceFeed: false };
  }

  const margin = match.opponentGoals - match.playerGoals;
  if (margin < REINF_MIN_MARGIN) {
    reinf.lossStreak = 0;
    reinf.lossHistory = [];
    return { reinf, trigger: null, silenceFeed: false };
  }

  const forces = computeSectorForces(match.lineup);
  const entry = {
    playerGoals: match.playerGoals,
    opponentGoals: match.opponentGoals,
    forces,
    lineup: cloneLineup(match.lineup),
    scorerIds: scorerIds(match.events, match.playerSide)
  };

  reinf.lossHistory.push(entry);
  reinf.lossStreak += 1;
  if (reinf.lossHistory.length > REINF_LOSS_STREAK) {
    reinf.lossHistory = reinf.lossHistory.slice(-REINF_LOSS_STREAK);
  }

  if (reinf.lossStreak < REINF_LOSS_STREAK) {
    return { reinf, trigger: null, silenceFeed: false };
  }

  const current = {
    ...entry,
    opponentStrength: match.opponentStrength,
    scorerIds: entry.scorerIds
  };
  const history = reinf.lossHistory.slice(0, -1);
  const scores = scoreSectors(current, history);
  const sector = pickWinningSector(scores);
  const scapegoat = pickScapegoat(sector, current, history);

  if (!canShowByLimits(reinf, sector, match.round)) {
    let silenceFeed = false;
    if (!reinf.limitSilenceFeedShown) {
      reinf.limitSilenceFeedShown = true;
      silenceFeed = true;
    }
    reinf.lossStreak = 0;
    reinf.lossHistory = [];
    return { reinf, trigger: null, silenceFeed };
  }

  const hasName = !!scapegoat?.name;
  const textKey = pickTextKey(reinf, sector, hasName);
  const subtitleKey = pickSubtitleKey();

  reinf.lossStreak = 0;
  reinf.lossHistory = [];

  return {
    reinf,
    silenceFeed: false,
    trigger: {
      sector,
      scapegoat,
      textKey,
      subtitleKey,
      round: match.round,
      squadFull: match.squadFull === true
    }
  };
}

export function pickMarketSuggestions(allPlayers, signedIds, canNegotiateFn, calcPriceFn, limit = 3) {
  return allPlayers
    .filter(p => !signedIds.has(p.playerId) && canNegotiateFn(p))
    .sort((a, b) => b.force - a.force || calcPriceFn(a) - calcPriceFn(b))
    .slice(0, limit);
}

export function consumePendingForDisplay(reinf) {
  ensureReinforcementFields(reinf);
  if (!reinf.pending) return null;
  const p = { ...reinf.pending };
  reinf.seasonShown += 1;
  reinf.seasonBySector[p.sector] = (reinf.seasonBySector[p.sector] || 0) + 1;
  reinf.lastShownRound = p.round;
  reinf.lastScapegoatId = p.scapegoatId ?? null;
  reinf.pending = null;
  return p;
}

/** Mercado rotativo por faixas (tiers) conforme nível do olheiro. */

export const MARKET_POOL_SIZE = 300;
export const MARKET_ROTATION_INTERVAL = 4;
export const MARKET_CARRYOVER_RATIO = 0.5;
export const SCOUT_MIN_LEVEL = 1;
export const SCOUT_MAX_LEVEL = 5;

export const TIER_ORDER = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const SCOUT_DISTRIBUTION = {
  1: { T1: 1 },
  2: { T1: 0.70, T2: 0.30 },
  3: { T1: 0.45, T2: 0.35, T3: 0.20 },
  4: { T1: 0.35, T2: 0.30, T3: 0.22, T4: 0.10, T5: 0.03 },
  5: { T1: 0.28, T2: 0.25, T3: 0.20, T4: 0.12, T5: 0.08, T6: 0.05, T7: 0.02 }
};

/** Custo em milhões para subir ao nível indicado (2–5). */
export const SCOUT_UPGRADE_COSTS = { 2: 3, 3: 8, 4: 18, 5: 35 };

const TIER_INDEX = Object.fromEntries(TIER_ORDER.map((t, i) => [t, i]));

export function clampScoutLevel(level) {
  return Math.max(SCOUT_MIN_LEVEL, Math.min(SCOUT_MAX_LEVEL, level || SCOUT_MIN_LEVEL));
}

export function getPlayerTier(player) {
  const force = player?.force ?? 0;
  const legend = !!player?.legend;
  if (legend && force >= 88) return 'T7';
  if (legend && force < 88) return 'T6';
  if (force >= 88) return 'T5';
  if (force >= 84) return 'T4';
  if (force >= 80) return 'T3';
  if (force >= 76) return 'T2';
  return 'T1';
}

export function getScoutDistribution(scoutLevel) {
  return SCOUT_DISTRIBUTION[clampScoutLevel(scoutLevel)] || SCOUT_DISTRIBUTION[1];
}

export function getScoutUpgradeCost(nextLevel) {
  return SCOUT_UPGRADE_COSTS[nextLevel] ?? null;
}

export function canUpgradeScout(scoutLevel, budget) {
  const current = clampScoutLevel(scoutLevel);
  if (current >= SCOUT_MAX_LEVEL) {
    return { ok: false, reason: 'max', current };
  }
  const next = current + 1;
  const cost = getScoutUpgradeCost(next);
  if (cost == null) return { ok: false, reason: 'max', current };
  if (budget < cost) return { ok: false, reason: 'budget', current, next, cost };
  return { ok: true, current, next, cost };
}

export function getScoutDistributionRows(scoutLevel) {
  const dist = getScoutDistribution(scoutLevel);
  return TIER_ORDER
    .filter(tier => dist[tier] > 0)
    .map(tier => ({ tier, pct: Math.round(dist[tier] * 100) }));
}

/** Maior tier que o olheiro pode revelar no mercado. */
export function getMaxTierForScoutLevel(scoutLevel) {
  const dist = getScoutDistribution(scoutLevel);
  return TIER_ORDER.filter(t => dist[t] > 0).pop() || 'T1';
}

export function isTierVisibleToScout(tier, scoutLevel) {
  const dist = getScoutDistribution(scoutLevel);
  return (dist[tier] ?? 0) > 0;
}

export function parseTierFilter(value) {
  if (!value || value === 'all') return null;
  const range = String(value).match(/^T(\d)-T(\d)$/i);
  if (range) {
    const min = clampTierNum(parseInt(range[1], 10));
    const max = clampTierNum(parseInt(range[2], 10));
    return { min: Math.min(min, max), max: Math.max(min, max) };
  }
  const single = String(value).match(/^T(\d)$/i);
  if (single) {
    const n = clampTierNum(parseInt(single[1], 10));
    return { min: n, max: n };
  }
  return null;
}

function clampTierNum(n) {
  return Math.max(1, Math.min(7, n));
}

export function playerMatchesTierFilter(player, filterValue) {
  const range = parseTierFilter(filterValue);
  if (!range) return true;
  const idx = TIER_INDEX[getPlayerTier(player)];
  const min = range.min - 1;
  const max = range.max - 1;
  return idx >= min && idx <= max;
}

export function getTierFilterOptions(scoutLevel) {
  const maxTier = getMaxTierForScoutLevel(scoutLevel);
  const maxIdx = TIER_INDEX[maxTier];
  const options = [{ value: 'all', labelKey: 'marketTierAll' }];
  for (let i = 0; i <= maxIdx; i++) {
    const t = TIER_ORDER[i];
    options.push({ value: t, labelKey: `marketTier${t}` });
  }
  if (maxIdx >= 1) options.push({ value: 'T1-T2', labelKey: 'marketTierT1T2' });
  if (maxIdx >= 2) options.push({ value: 'T2-T3', labelKey: 'marketTierT2T3' });
  if (maxIdx >= 3) options.push({ value: 'T3-T4', labelKey: 'marketTierT3T4' });
  if (maxIdx >= 4) options.push({ value: 'T4-T5', labelKey: 'marketTierT4T5' });
  if (maxIdx >= 5) options.push({ value: 'T5-T6', labelKey: 'marketTierT5T6' });
  if (maxIdx >= 6) options.push({ value: 'T6-T7', labelKey: 'marketTierT6T7' });
  if (maxIdx >= 2) options.push({ value: 'T3-T7', labelKey: 'marketTierT3Plus' });
  if (maxIdx >= 4) options.push({ value: 'T5-T7', labelKey: 'marketTierT5Plus' });
  return options;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickFromPool(pool, count, selectedSet, rng) {
  const available = pool.filter(p => !selectedSet.has(p.playerId));
  shuffleInPlace(available, rng);
  return available.slice(0, count);
}

function poolSeed(season, rotationIndex, scoutLevel) {
  return ((season * 997) + (rotationIndex * 131) + (scoutLevel * 17)) >>> 0;
}

function allocateTierCounts(dist, total) {
  const tiers = TIER_ORDER.filter(t => dist[t] > 0);
  const counts = {};
  let used = 0;
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    let count = i === tiers.length - 1
      ? total - used
      : Math.round(total * dist[tier]);
    counts[tier] = Math.max(0, count);
    used += counts[tier];
  }
  const diff = total - used;
  if (diff !== 0) counts[tiers[tiers.length - 1]] += diff;
  return counts;
}

export function buildTierPools(allPlayers, signedIds) {
  const pools = Object.fromEntries(TIER_ORDER.map(t => [t, []]));
  for (const player of allPlayers) {
    if (signedIds.has(player.playerId)) continue;
    pools[getPlayerTier(player)].push(player);
  }
  return pools;
}

export function generateMarketPool({
  allPlayers,
  signedIds,
  scoutLevel,
  carryoverIds = [],
  season = 1,
  rotationIndex = 0
}) {
  const level = clampScoutLevel(scoutLevel);
  const dist = getScoutDistribution(level);
  const pools = buildTierPools(allPlayers, signedIds);
  const rng = mulberry32(poolSeed(season, rotationIndex, level));
  const selected = [];
  const selectedSet = new Set();

  const maxCarry = Math.floor(MARKET_POOL_SIZE * MARKET_CARRYOVER_RATIO);
  for (const id of carryoverIds) {
    if (selected.length >= maxCarry) break;
    if (signedIds.has(id) || selectedSet.has(id)) continue;
    const player = allPlayers.find(p => p.playerId === id);
    if (!player) continue;
    const tier = getPlayerTier(player);
    if (!dist[tier]) continue;
    selected.push(id);
    selectedSet.add(id);
  }

  const remaining = MARKET_POOL_SIZE - selected.length;
  const counts = allocateTierCounts(dist, remaining);

  for (const tier of TIER_ORDER) {
    if (!counts[tier]) continue;
    const picked = pickFromPool(pools[tier], counts[tier], selectedSet, rng);
    for (const p of picked) {
      selected.push(p.playerId);
      selectedSet.add(p.playerId);
    }
  }

  if (selected.length < MARKET_POOL_SIZE) {
    const backfillTiers = [...TIER_ORDER].filter(t => dist[t] > 0);
    for (const tier of backfillTiers) {
      if (selected.length >= MARKET_POOL_SIZE) break;
      const need = MARKET_POOL_SIZE - selected.length;
      const picked = pickFromPool(pools[tier], need, selectedSet, rng);
      for (const p of picked) {
        selected.push(p.playerId);
        selectedSet.add(p.playerId);
      }
    }
  }

  return selected.slice(0, MARKET_POOL_SIZE);
}

export function createEmptyMarketPool() {
  return {
    playerIds: [],
    rotationIndex: 0,
    season: 1,
    scoutLevel: SCOUT_MIN_LEVEL
  };
}

export function getMarketRotationIndex(round) {
  return Math.floor((round || 0) / MARKET_ROTATION_INTERVAL);
}

export function shouldRotateMarket(round, pool) {
  if (!pool?.playerIds?.length) return true;
  return getMarketRotationIndex(round) !== (pool.rotationIndex ?? 0);
}

export function rotateMarketPool(state, { force = false } = {}) {
  const round = activeLeagueRound(state);
  const scoutLevel = getScoutLevelFromState(state);
  const rotationIndex = getMarketRotationIndex(round);

  if (!force && !shouldRotateMarket(round, state.marketPool)) {
    return false;
  }

  const signedIds = new Set(state.squad.map(p => p.playerId));
  const carryover = force ? [] : (state.marketPool?.playerIds || []);
  const playerIds = generateMarketPool({
    allPlayers: state.allPlayers,
    signedIds,
    scoutLevel,
    carryoverIds: carryover,
    season: state.season,
    rotationIndex
  });

  state.marketPool = {
    playerIds,
    rotationIndex,
    season: state.season,
    scoutLevel,
    generatedAtRound: round
  };
  return true;
}

function activeLeagueRound(state) {
  const div = state.playerDivision || 2;
  const league = div === 1 ? state.serieA : div === 3 ? state.serieC : state.serieB;
  return league?.currentRound ?? 0;
}

export function getScoutLevelFromState(state) {
  return clampScoutLevel(state?.clubProfile?.scoutLevel ?? SCOUT_MIN_LEVEL);
}

/** Jogadores que o olheiro consegue monitorar (banco completo, por tier). */
export function getScoutReachPlayers(allPlayers, signedIds, scoutLevel) {
  const level = clampScoutLevel(scoutLevel);
  return allPlayers.filter(p => {
    if (signedIds.has(p.playerId)) return false;
    return isTierVisibleToScout(getPlayerTier(p), level);
  });
}

export function getMarketPoolPlayers(allPlayers, marketPool) {
  if (!marketPool?.playerIds?.length) return [];
  const idSet = new Set(marketPool.playerIds);
  return allPlayers.filter(p => idSet.has(p.playerId));
}

export function roundsUntilMarketRefresh(round) {
  const r = round || 0;
  const rem = MARKET_ROTATION_INTERVAL - (r % MARKET_ROTATION_INTERVAL);
  return rem === MARKET_ROTATION_INTERVAL ? MARKET_ROTATION_INTERVAL : rem;
}

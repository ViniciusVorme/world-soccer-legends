import { roundMoney } from './data.js';

const OFFER_STEP = 0.1;
const MIN_RATIO = 0.6;
const MAX_RATIO = 1.25;
export const MAX_NEGOTIATION_ATTEMPTS = 3;
export const REP_OVERALL_MIN = 79;

const MIN_POP = { rising: 15, solid: 30, star: 45, elite: 55 };
const LEGEND_POP_BONUS = 10;

const INFLATION_CAP = { rising: 0.08, solid: 0.18, star: 0.28, elite: 0.35 };
const INFLATION_FREE_POP = { rising: 40, solid: 60, star: 80, elite: 80 };

const REP_FACTOR = {
  rising: { unknown: 0.70, regional: 0.82, national: 0.92, big: 1.00, icon: 1.05 },
  solid: { unknown: 0.55, regional: 0.68, national: 0.80, big: 0.90, icon: 1.00 },
  star: { unknown: 0.40, regional: 0.52, national: 0.65, big: 0.78, icon: 0.92 },
  elite: { unknown: 0.40, regional: 0.52, national: 0.65, big: 0.78, icon: 0.92 }
};

export function getNegotiationAttempts(attemptsMap, playerId) {
  return attemptsMap?.[playerId] ?? 0;
}

export function getNegotiationAttemptsLeft(attemptsMap, playerId) {
  return Math.max(0, MAX_NEGOTIATION_ATTEMPTS - getNegotiationAttempts(attemptsMap, playerId));
}

export function canSubmitNegotiation(attemptsMap, playerId) {
  return getNegotiationAttemptsLeft(attemptsMap, playerId) > 0;
}

function getForceBand(force) {
  if (force >= 90) return 'elite';
  if (force >= 87) return 'star';
  if (force >= 83) return 'solid';
  if (force >= REP_OVERALL_MIN) return 'rising';
  return null;
}

function getPopTier(popularity) {
  if (popularity >= 80) return 'icon';
  if (popularity >= 60) return 'big';
  if (popularity >= 40) return 'national';
  if (popularity >= 20) return 'regional';
  return 'unknown';
}

export function isReputationSensitive(player) {
  return (player?.force ?? 0) >= REP_OVERALL_MIN;
}

/** Portão B — popularidade mínima para negociar (79+). */
export function getMinPopularity(player) {
  if (!isReputationSensitive(player)) return 0;
  const band = getForceBand(player.force);
  let min = MIN_POP[band];
  if (player.legend) min += LEGEND_POP_BONUS;
  return min;
}

export function canNegotiateByReputation(player, popularity) {
  if (!isReputationSensitive(player)) return true;
  return popularity >= getMinPopularity(player);
}

/** Inflação C — taxa 0–1 sobre o valor de mercado. */
export function getInflationRate(player, popularity) {
  if (!isReputationSensitive(player)) return 0;
  const band = getForceBand(player.force);
  if (popularity >= INFLATION_FREE_POP[band]) return 0;
  return INFLATION_CAP[band] * Math.max(0, 1 - popularity / 100);
}

export function getEffectiveAsking(marketPrice, player, popularity) {
  if (!isReputationSensitive(player) || marketPrice <= 0) return marketPrice;
  return roundMoney(marketPrice * (1 + getInflationRate(player, popularity)));
}

/** Multiplicador A na chance de aceite. */
export function getReputationFactor(player, popularity) {
  if (!isReputationSensitive(player)) return 1;
  const band = getForceBand(player.force);
  return REP_FACTOR[band][getPopTier(popularity)];
}

export function getMarketRepStatus(player, popularity) {
  if (!isReputationSensitive(player)) return 'none';
  if (!canNegotiateByReputation(player, popularity)) return 'blocked';
  const inflation = getInflationRate(player, popularity);
  const factor = getReputationFactor(player, popularity);
  if (factor >= 0.95 && inflation <= 0.02) return 'interested';
  return 'demanding';
}

export function getNegotiationPricing(player, marketPrice, popularity) {
  const effectiveAsking = getEffectiveAsking(marketPrice, player, popularity);
  return {
    marketPrice,
    effectiveAsking,
    inflationPct: Math.round(getInflationRate(player, popularity) * 100),
    repFactor: getReputationFactor(player, popularity),
    minPop: getMinPopularity(player),
    canNegotiate: canNegotiateByReputation(player, popularity),
    repStatus: getMarketRepStatus(player, popularity)
  };
}

export function getMinOffer(askingPrice) {
  return Math.max(0.5, roundMoney(askingPrice * MIN_RATIO));
}

export function getMaxOffer(askingPrice, budget) {
  return roundMoney(Math.min(budget, askingPrice * MAX_RATIO));
}

function calcBaseAcceptChance(player, offer, askingPrice) {
  if (askingPrice <= 0) return 0;
  const ratio = offer / askingPrice;

  let chance;
  if (ratio >= 1.05) chance = 0.97;
  else if (ratio >= 1) chance = 0.85 + (ratio - 1) * 2.4;
  else if (ratio >= 0.92) chance = 0.58 + (ratio - 0.92) * 3.375;
  else if (ratio >= 0.8) chance = 0.22 + (ratio - 0.8) * 3;
  else if (ratio >= MIN_RATIO) chance = 0.06 + (ratio - MIN_RATIO) * 1.33;
  else chance = 0.03;

  if (player?.legend) chance *= 0.82;
  return chance;
}

/** Chance de aceite (0–1): oferta vs expectativa + multiplicador de reputação. */
export function calcAcceptChance(player, offer, askingPrice, popularity = 100) {
  const base = calcBaseAcceptChance(player, offer, askingPrice);
  const final = base * getReputationFactor(player, popularity);
  return Math.min(0.97, Math.max(0.03, final));
}

export function calcAcceptChanceBreakdown(player, offer, askingPrice, popularity = 100) {
  const base = calcBaseAcceptChance(player, offer, askingPrice);
  const repFactor = getReputationFactor(player, popularity);
  return {
    base,
    repFactor,
    final: Math.min(0.97, Math.max(0.03, base * repFactor))
  };
}

/** Largura da barrinha: valor pedido = 50%; mínimo ≈ 0%; máximo ≈ 100%. */
export function calcOfferBarFill(offer, askingPrice, budget) {
  if (askingPrice <= 0) return 0;
  const ratio = offer / askingPrice;
  const maxRatio = Math.min(MAX_RATIO, budget / askingPrice);

  if (ratio <= MIN_RATIO) return 0;
  if (ratio <= 1) {
    return ((ratio - MIN_RATIO) / (1 - MIN_RATIO)) * 50;
  }
  if (maxRatio <= 1) return 50;
  if (ratio >= maxRatio) return 100;
  return 50 + ((ratio - 1) / (maxRatio - 1)) * 50;
}

export function clampOffer(offer, askingPrice, budget) {
  const min = getMinOffer(askingPrice);
  const max = getMaxOffer(askingPrice, budget);
  return roundMoney(Math.max(min, Math.min(max, offer)));
}

export function stepOffer(offer, delta, askingPrice, budget) {
  return clampOffer(roundMoney(offer + delta * OFFER_STEP), askingPrice, budget);
}

export { OFFER_STEP };

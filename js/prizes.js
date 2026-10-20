import { roundMoney } from './data.js';

/** Premiação por vitória/empate em rodada do campeonato */
export const WIN_PRIZE = 1;
export const DRAW_PRIZE = 0.3;

/** Patrocínio ao iniciar nova temporada (divisão em que o clube disputará a temporada) */
export const SPONSORSHIP_BY_DIVISION = {
  1: 20,
  2: 14,
  3: 8
};

/** @deprecated Use getSeasonSponsorship */
export const NEW_SEASON_SPONSORSHIP = SPONSORSHIP_BY_DIVISION[1];

export function getSeasonSponsorship(division) {
  return SPONSORSHIP_BY_DIVISION[division] ?? SPONSORSHIP_BY_DIVISION[3];
}

/**
 * Copa do Brasil — premiação única pela melhor fase alcançada na campanha (não acumula).
 * Máximo: título (R$ 25M).
 */
export const COPA_REACH_PRIZE = {
  round32: 5,
  round16: 5,
  quarter: 7,
  semi: 10,
  final: 10,
  champion: 25
};

/** Marco atingido ao vencer cada fase (ou folga na 1ª fase). */
export const COPA_MILESTONE_AFTER_PHASE = {
  phase1: 'round32',
  round32: 'round16',
  round16: 'quarter',
  quarter: 'semi',
  semi: 'final'
};

/** @deprecated Use getCopaReachPrize */
export const COPA_CHAMPION_PRIZE = COPA_REACH_PRIZE.champion;

/** Título do campeonato por divisão em que a temporada foi disputada */
export const CHAMPION_PRIZE_BY_DIVISION = {
  1: 35,
  2: 18,
  3: 12
};

/** Piso de premiação para 9º–20º */
const LOWER_TABLE_PRIZE_BY_DIVISION = {
  1: 5,
  2: 4,
  3: 3
};

/** Escala da fórmula (11 − pos) × 3 para 2º–8º */
const MID_TABLE_SCALE_BY_DIVISION = {
  1: 1,
  2: 0.65,
  3: 0.4
};

/**
 * Premiação de fim de campeonato (proposta 3).
 * Campeão por divisão; 2º–8º: fórmula base × escala; 9º–20º: piso por divisão.
 */
export function calcLeagueSeasonPrize(division, position, isChampion) {
  if (isChampion) {
    return CHAMPION_PRIZE_BY_DIVISION[division] ?? LOWER_TABLE_PRIZE_BY_DIVISION[3];
  }
  if (position >= 9) {
    return LOWER_TABLE_PRIZE_BY_DIVISION[division] ?? 3;
  }
  const base = Math.max(5, (11 - position) * 3);
  const scale = MID_TABLE_SCALE_BY_DIVISION[division] ?? 0.4;
  return roundMoney(base * scale);
}

export function nonChampionPrizeForPosition(division, position) {
  return calcLeagueSeasonPrize(division, position, false);
}

export function championPrizeForDivision(division) {
  return CHAMPION_PRIZE_BY_DIVISION[division] ?? LOWER_TABLE_PRIZE_BY_DIVISION[3];
}

export function getCopaReachPrize(reach) {
  if (!reach) return 0;
  return COPA_REACH_PRIZE[reach] ?? 0;
}

export function copaMilestoneAfterPhase(phaseBefore) {
  return COPA_MILESTONE_AFTER_PHASE[phaseBefore] ?? null;
}

export function maxCopaPrizeMoney() {
  return COPA_REACH_PRIZE.champion;
}

export function formatPrizeDelta(millions) {
  return roundMoney(millions);
}

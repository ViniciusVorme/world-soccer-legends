import { autoLineup } from './data.js';
import { calcTeamForces } from './forces.js';

function getGkForce(team) {
  const lineup = autoLineup(team.squad, team.formation || '433');
  const gkSlot = lineup.find(s => s.slotPos === 'GOL' && s.player);
  return gkSlot?.player?.force ?? team.strength ?? 50;
}

function getFieldForce(team) {
  const lineup = autoLineup(team.squad, team.formation || '433');
  const forces = calcTeamForces(lineup);
  return forces.overall || team.strength || 50;
}

function penaltyKickChance(kickerForce, gkForce) {
  const base = 0.72;
  const diff = (kickerForce - gkForce) * 0.004;
  return Math.max(0.45, Math.min(0.92, base + diff));
}

/**
 * Simula disputa de pênaltis (5 cobranças + morte súbita se necessário).
 */
export function simulatePenaltyShootout(homeTeam, awayTeam) {
  const homeGk = getGkForce(homeTeam);
  const awayGk = getGkForce(awayTeam);
  const homeKick = getFieldForce(homeTeam);
  const awayKick = getFieldForce(awayTeam);

  let homePen = 0;
  let awayPen = 0;

  for (let i = 0; i < 5; i++) {
    if (Math.random() < penaltyKickChance(homeKick, awayGk)) homePen++;
    if (Math.random() < penaltyKickChance(awayKick, homeGk)) awayPen++;
  }

  while (homePen === awayPen) {
    const hScored = Math.random() < penaltyKickChance(homeKick, awayGk);
    const aScored = Math.random() < penaltyKickChance(awayKick, homeGk);
    if (hScored) homePen++;
    if (aScored) awayPen++;
    if (hScored !== aScored) break;
  }

  return {
    home: homePen,
    away: awayPen,
    winnerId: homePen > awayPen ? homeTeam.id : awayTeam.id
  };
}

/**
 * Soma gols do confronto (ida + volta) em relação ao mandante da ida (tie.home).
 * legs[0] = ida (tie.home manda); legs[1] = volta (tie.away manda).
 * Os gols de cada perna são salvos do ponto de vista do mandante daquela perna.
 */
export function getAggregate(tie) {
  const leg1 = tie.legs[0];
  const leg2 = tie.legs[1];
  let homeAgg = 0;
  let awayAgg = 0;

  if (leg1?.played) {
    homeAgg += leg1.homeGoals ?? 0;
    awayAgg += leg1.awayGoals ?? 0;
  }
  if (leg2?.played) {
    homeAgg += leg2.awayGoals ?? 0;
    awayAgg += leg2.homeGoals ?? 0;
  }

  return { home: homeAgg, away: awayAgg };
}

/**
 * Resolve vencedor de confronto eliminatório.
 * @param {object} tie - confronto com legs jogadas
 * @param {object} homeTeam - time mandante da ida (tie.home)
 * @param {object} awayTeam - time visitante da ida (tie.away)
 * @param {boolean} singleLeg - jogo único (final)
 */
export function resolveKnockoutTie(tie, homeTeam, awayTeam, singleLeg = false) {
  const agg = getAggregate(tie);

  if (agg.home > agg.away) {
    return { winnerId: tie.home, decidedBy: 'aggregate', penalties: null };
  }
  if (agg.away > agg.home) {
    return { winnerId: tie.away, decidedBy: 'aggregate', penalties: null };
  }

  const pens = simulatePenaltyShootout(homeTeam, awayTeam);
  return {
    winnerId: pens.winnerId,
    decidedBy: singleLeg ? 'penalties' : 'penalties',
    penalties: { home: pens.home, away: pens.away }
  };
}

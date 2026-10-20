import { autoLineup } from './data.js';
import { calcTeamForces } from './forces.js';

const MODEL = {
  baseLambda: 1.4,
  slope: 0.08,
  minLambda: 0.15,
  maxLambda: 5
};

const PESO_ARTILHARIA = {
  GK: 0.01, DEF: 0.12, VOL: 0.22, MID: 0.45, MEI: 0.70, ATT: 1.0
};

const MAPA_POSICAO = {
  GOL: 'GK', LD: 'DEF', ZAG: 'DEF', LE: 'DEF',
  MD: 'MID', ME: 'MID', VOL: 'VOL', MC: 'MID', MEI: 'MEI',
  PD: 'ATT', CA: 'ATT', PE: 'ATT'
};

const ASSIST_WEIGHT = {
  GOL: 0.05, LD: 0.35, ZAG: 0.25, LE: 0.35,
  VOL: 0.65, MC: 0.85, MEI: 1.0, MD: 0.9, ME: 0.9,
  PD: 0.95, PE: 0.95, CA: 0.55
};

const ASSIST_CHANCE = 0.74;

function assistSlotWeight(player, slotPos) {
  const positions = [...(player?.positions || []), slotPos].filter(Boolean);
  return Math.max(...positions.map(pos => ASSIST_WEIGHT[pos] ?? 0.2));
}

function pickWeightedSlot(slots) {
  const total = slots.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const item of slots) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return slots[slots.length - 1];
}

/** Escolhe assistente no momento do gol — mesma lógica usada nas estatísticas da temporada. */
export function attachAssistToGoal(goalEvent, lineup) {
  if (Math.random() > ASSIST_CHANCE) return goalEvent;
  const scorerId = goalEvent.playerId;
  const pool = (lineup || [])
    .filter(slot => slot.player && slot.player.playerId !== scorerId && slot.slotPos !== 'GOL')
    .map(slot => ({
      slot,
      weight: assistSlotWeight(slot.player, slot.slotPos)
    }))
    .filter(item => item.weight > 0);

  const picked = pickWeightedSlot(pool);
  if (!picked) return goalEvent;

  goalEvent.assistPlayer = picked.slot.player.name;
  goalEvent.assistPlayerId = picked.slot.player.playerId;
  return goalEvent;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** λ = clamp(base + (forçaA − forçaB) × slope) */
function calcLambda(forcaTime, forcaAdversario) {
  const { baseLambda, slope, minLambda, maxLambda } = MODEL;
  return clamp(baseLambda + (forcaTime - forcaAdversario) * slope, minLambda, maxLambda);
}

/** Poisson (Knuth) */
function poisson(rng, lambda) {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

function canScore(slot) {
  if (!slot?.player) return false;
  if (slot.slotPos === 'GOL') return false;
  const pos = slot.player.positions;
  if (pos.length === 1 && pos[0] === 'GOL') return false;
  return true;
}

function pesoGol(jogador, slotPos) {
  const posicoes = [...jogador.positions, slotPos];
  const maxPesoPos = Math.max(
    ...posicoes.map(pos => PESO_ARTILHARIA[MAPA_POSICAO[pos]] ?? 0.1)
  );
  return maxPesoPos * jogador.force;
}

/** Distribui artilheiros após o placar — peso × force, decay 0.45 por gol */
function distribuirArtilheiros(lineup, numGols, teamName, teamSide) {
  if (numGols <= 0) return [];

  const pool = lineup
    .filter(canScore)
    .map(slot => ({ slot, w: pesoGol(slot.player, slot.slotPos) }))
    .filter(x => x.w > 0);

  if (!pool.length) return [];

  const events = [];
  const mins = Array.from({ length: numGols }, () => rand(1, 90)).sort((a, b) => a - b);

  for (let g = 0; g < numGols; g++) {
    const total = pool.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total;
    let picked = pool[0];
    for (const item of pool) {
      r -= item.w;
      if (r <= 0) {
        picked = item;
        break;
      }
    }
    const goalEvent = attachAssistToGoal({
      min: mins[g],
      type: 'goal',
      team: teamSide,
      player: picked.slot.player.name,
      playerId: picked.slot.player.playerId,
      teamName
    }, lineup);
    events.push(goalEvent);
    picked.w *= 0.45;
  }

  return events;
}

/**
 * Simula partida entre dois times:
 * - attack/defense ponderados por posição
 * - λ por lado e sorteio Poisson independente
 * - artilheiros sorteados depois do placar
 */
export function simulateMatch(homeTeam, awayTeam, homeLineup = null, awayLineup = null) {
  const homeForm = homeTeam.formation || '433';
  const awayForm = awayTeam.formation || '433';

  const hLineup = homeLineup || autoLineup(homeTeam.squad, homeForm);
  const aLineup = awayLineup || autoLineup(awayTeam.squad, awayForm);

  const hForces = calcTeamForces(hLineup);
  const aForces = calcTeamForces(aLineup);

  const rng = () => Math.random();

  // Ataque de cada lado vs overall adversário
  const lambdaHome = calcLambda(hForces.attack, aForces.overall);
  const lambdaAway = calcLambda(aForces.attack, hForces.overall);

  const homeGoals = poisson(rng, lambdaHome);
  const awayGoals = poisson(rng, lambdaAway);

  const events = [
    ...distribuirArtilheiros(hLineup, homeGoals, homeTeam.name, 'home'),
    ...distribuirArtilheiros(aLineup, awayGoals, awayTeam.name, 'away')
  ].sort((a, b) => a.min - b.min);

  return {
    homeGoals,
    awayGoals,
    events,
    hLineup,
    aLineup,
    hStr: hForces.overall,
    aStr: aForces.overall,
    hAttack: hForces.attack,
    aAttack: aForces.attack,
    hDefense: hForces.defense,
    aDefense: aForces.defense,
    lambdaHome: Math.round(lambdaHome * 100) / 100,
    lambdaAway: Math.round(lambdaAway * 100) / 100
  };
}

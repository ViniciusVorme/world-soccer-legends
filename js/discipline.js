import { autoLineup, playerFitsPosition, FORMATIONS } from './data.js';

export const FOUL_WEIGHT = {
  GOL: 0.12, LD: 0.95, ZAG: 1.0, LE: 0.95,
  VOL: 0.9, MC: 0.55, MEI: 0.45, MD: 0.5, ME: 0.5,
  PD: 0.4, PE: 0.4, CA: 0.35
};

export const YELLOW_ACCUMULATION_LIMIT = 3;
export const INJURY_BASE = 0.03;
export const INJURY_CAP = 0.12;
export const CARD_CHANCE_PER_FOUL = 0.12;
export const RED_DIRECT_RATE = 0.05;
/** Segundo amarelo na mesma partida — falta precisa ser mais grave */
export const SECOND_YELLOW_CARD_MULT = 0.45;

const INJURY_POS_FACTOR = {
  GOL: 0.6, ZAG: 1.15, LD: 1.15, LE: 1.15,
  VOL: 1.1, MC: 1.1, MEI: 1.0, MD: 1.0, ME: 1.0,
  PD: 1.2, PE: 1.2, CA: 1.2
};

const INJURY_KINDS = {
  light: ['muscular', 'contusion', 'ankle'],
  medium: ['thigh', 'knee'],
  severe: ['rupture', 'fracture']
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeighted(candidates) {
  const total = candidates.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const item of candidates) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return candidates[candidates.length - 1];
}

function slotWeight(player, slotPos, map) {
  const positions = [...(player?.positions || []), slotPos].filter(Boolean);
  return Math.max(...positions.map(pos => map[pos] ?? 0.2));
}

function resolveSquadPlayer(team, lineup, playerId, name) {
  if (playerId) {
    const fromSquad = team.squad.find(p => p.playerId === playerId);
    if (fromSquad) return fromSquad;
    const fromLineup = lineup?.find(s => s.player?.playerId === playerId)?.player;
    if (fromLineup) return fromLineup;
  }
  const byName = team.squad.find(p => p.name === name)
    || lineup?.find(s => s.player?.name === name)?.player;
  return byName || null;
}

export function ensurePlayerDiscipline(player) {
  if (!player) return;
  if (!player.discipline) {
    player.discipline = {
      yellowCards: 0,
      gamesOut: 0,
      outType: null,
      injuryKind: null,
      sentOffLastMatch: false,
      injuredLastMatch: false,
      disciplineStamp: null,
      suspensionReason: null
    };
    return;
  }
  const d = player.discipline;
  if (d.sentOffLastMatch === undefined) d.sentOffLastMatch = false;
  if (d.injuredLastMatch === undefined) d.injuredLastMatch = false;
  if (d.suspensionReason === undefined) d.suspensionReason = null;
  if (d.disciplineStamp === undefined) {
    if (d.sentOffLastMatch) d.disciplineStamp = 'sentOff';
    else if (d.injuredLastMatch || (d.gamesOut > 0 && d.outType === 'injured')) d.disciplineStamp = 'injured';
    else d.disciplineStamp = null;
  }
}

/** Mantém flags e selo visual alinhados ao estado atual. */
export function syncDisciplineStampFlags(d) {
  if (!d) return;
  if (d.gamesOut <= 0) {
    d.disciplineStamp = null;
    d.suspensionReason = null;
  } else if (d.outType === 'injured') {
    d.disciplineStamp = 'injured';
  } else if (d.outType === 'suspended') {
    if (d.suspensionReason === 'red' || d.suspensionReason === 'secondYellow') {
      d.disciplineStamp = 'sentOff';
    } else {
      d.disciplineStamp = null;
    }
  }
  d.sentOffLastMatch = d.disciplineStamp === 'sentOff';
  d.injuredLastMatch = d.disciplineStamp === 'injured';
}

export function shouldShowSentOffStamp(d) {
  if (!d || (d.gamesOut || 0) <= 0) return false;
  return d.disciplineStamp === 'sentOff'
    || d.suspensionReason === 'red'
    || d.suspensionReason === 'secondYellow';
}

export function getDisciplineStampState(player) {
  if (!player) return { sentOff: false, injured: false, injuryKind: null };
  ensurePlayerDiscipline(player);
  const d = player.discipline;
  syncDisciplineStampFlags(d);
  return {
    sentOff: shouldShowSentOffStamp(d),
    injured: d.disciplineStamp === 'injured',
    injuryKind: d.injuryKind,
    suspensionReason: d.suspensionReason
  };
}

export function ensureSquadDiscipline(squad) {
  for (const p of squad || []) ensurePlayerDiscipline(p);
}

export function isPlayerAvailable(player) {
  if (!player) return false;
  ensurePlayerDiscipline(player);
  return (player.discipline.gamesOut || 0) <= 0;
}

export function resetSquadDiscipline(squad) {
  for (const p of squad || []) {
    p.discipline = {
      yellowCards: 0,
      gamesOut: 0,
      outType: null,
      injuryKind: null,
      sentOffLastMatch: false,
      injuredLastMatch: false,
      disciplineStamp: null,
      suspensionReason: null
    };
  }
}

export function tickClubAvailability(team) {
  if (!team?.squad) return;
  ensureSquadDiscipline(team.squad);
  for (const p of team.squad) {
    const d = p.discipline;
    if (d.gamesOut > 0) {
      d.gamesOut--;
      if (d.gamesOut <= 0) {
        d.gamesOut = 0;
        d.outType = null;
        d.injuryKind = null;
        d.disciplineStamp = null;
        d.suspensionReason = null;
        d.sentOffLastMatch = false;
        d.injuredLastMatch = false;
      } else {
        syncDisciplineStampFlags(d);
      }
    }
  }
}

export function prepareTeamLineup(team, formation, preferredLineup = null, { keepUnavailable = false } = {}) {
  if (!team?.squad?.length) return [];
  ensureSquadDiscipline(team.squad);
  const form = formation || team.formation || '433';
  const slots = FORMATIONS[form]?.slots || FORMATIONS['433'].slots;
  const eligible = (p) => isPlayerAvailable(p);

  if (!preferredLineup?.length) {
    return autoLineup(team.squad, form, { isEligible: eligible });
  }

  const used = new Set();
  const lineup = slots.map((slotPos, i) => {
    const pref = preferredLineup[i];
    const prefId = pref?.player?.playerId;
    if (prefId) {
      const player = team.squad.find(p => p.playerId === prefId);
      if (player && !used.has(player.playerId) && (eligible(player) || keepUnavailable)) {
        used.add(player.playerId);
        return { slotPos, player };
      }
    }
    return { slotPos, player: null };
  });

  for (let i = 0; i < lineup.length; i++) {
    if (lineup[i].player) continue;
    const slotPos = lineup[i].slotPos;
    let best = null;
    let bestScore = -1;
    for (const p of team.squad) {
      if (used.has(p.playerId) || !eligible(p)) continue;
      if (!playerFitsPosition(p, slotPos)) continue;
      const bonus = p.positions.includes(slotPos) ? 5 : 0;
      const score = p.force + bonus;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (!best) {
      for (const p of team.squad) {
        if (used.has(p.playerId) || !eligible(p)) continue;
        if (p.force > bestScore) {
          bestScore = p.force;
          best = p;
        }
      }
    }
    if (best) {
      used.add(best.playerId);
      lineup[i].player = best;
    }
  }

  return lineup;
}

function pickFoulMinute() {
  return randInt(3, 88);
}

function injuryPosFactor(slotPos) {
  return INJURY_POS_FACTOR[slotPos] ?? 1;
}

function matchIntensityFactor(result, teamSide, teamFouls) {
  const homeGoals = result.homeGoals ?? 0;
  const awayGoals = result.awayGoals ?? 0;
  const diff = Math.abs(homeGoals - awayGoals);
  let factor = diff <= 1 ? 1 : 0.85;
  if (diff <= 1 && teamFouls >= 14) factor *= 1.25;
  return factor;
}

function rollInjuryGames() {
  const roll = Math.random();
  if (roll < 0.7) return 1;
  if (roll < 0.95) return randInt(2, 3);
  return randInt(4, 6);
}

function pickInjuryKind(severity) {
  const pool = INJURY_KINDS[severity] || INJURY_KINDS.light;
  return pool[randInt(0, pool.length - 1)];
}

function applySuspension(player, games = 1) {
  ensurePlayerDiscipline(player);
  const d = player.discipline;
  d.gamesOut = (d.gamesOut || 0) + games;
  d.outType = 'suspended';
}

function applyInjury(player, games, kind) {
  ensurePlayerDiscipline(player);
  const d = player.discipline;
  d.gamesOut = (d.gamesOut || 0) + games;
  d.outType = 'injured';
  d.injuryKind = kind;
  d.disciplineStamp = 'injured';
  syncDisciplineStampFlags(d);
}

function applyYellowCard(player, matchYellows, events, ctx) {
  ensurePlayerDiscipline(player);
  const d = player.discipline;

  if (matchYellows.has(player.playerId)) {
    matchYellows.delete(player.playerId);
    applyRedCard(player, events, ctx, true);
    return;
  }

  matchYellows.add(player.playerId);
  d.yellowCards = (d.yellowCards || 0) + 1;
  ctx.statsEntry.yellowCards = (ctx.statsEntry.yellowCards || 0) + 1;

  events.push({
    min: pickFoulMinute(),
    type: 'yellow',
    team: ctx.teamSide,
    player: player.name,
    playerId: player.playerId,
    teamName: ctx.team.name
  });

  if (d.yellowCards >= YELLOW_ACCUMULATION_LIMIT) {
    d.yellowCards = 0;
    applySuspension(player, 1);
    d.suspensionReason = 'accumulation';
    syncDisciplineStampFlags(d);
    ctx.suspensions.push({ player, reason: 'accumulation' });
  }
}

function applyRedCard(player, events, ctx, secondYellow = false) {
  ensurePlayerDiscipline(player);
  applySuspension(player, 1);
  player.discipline.suspensionReason = secondYellow ? 'secondYellow' : 'red';
  syncDisciplineStampFlags(player.discipline);
  ctx.statsEntry.redCards = (ctx.statsEntry.redCards || 0) + 1;

  events.push({
    min: pickFoulMinute(),
    type: 'red',
    team: ctx.teamSide,
    player: player.name,
    playerId: player.playerId,
    teamName: ctx.team.name,
    secondYellow
  });

  ctx.suspensions.push({ player, reason: secondYellow ? 'secondYellow' : 'red' });
}

function maybeCardFromFoul(player, matchYellows, events, ctx) {
  const chance = matchYellows.has(player.playerId)
    ? CARD_CHANCE_PER_FOUL * SECOND_YELLOW_CARD_MULT
    : CARD_CHANCE_PER_FOUL;
  if (Math.random() >= chance) return;
  if (Math.random() < RED_DIRECT_RATE && !matchYellows.has(player.playerId)) {
    applyRedCard(player, events, ctx, false);
    return;
  }
  applyYellowCard(player, matchYellows, events, ctx);
}

function rollInjuriesForTeam(team, lineup, teamSide, result, teamFouls, isCopa, events, injuries) {
  const intensity = matchIntensityFactor(result, teamSide, teamFouls) * (isCopa ? 1.15 : 1);

  for (const slot of lineup || []) {
    if (!slot.player) continue;
    const player = resolveSquadPlayer(team, lineup, slot.player.playerId, slot.player.name);
    if (!player) continue;

    let chance = INJURY_BASE * injuryPosFactor(slot.slotPos) * intensity;
    chance = Math.min(INJURY_CAP, chance);
    if (Math.random() >= chance) continue;

    const games = rollInjuryGames();
    const severity = games === 1 ? 'light' : games <= 3 ? 'medium' : 'severe';
    const kind = pickInjuryKind(severity);
    applyInjury(player, games, kind);

    events.push({
      min: pickFoulMinute(),
      type: 'injury',
      team: teamSide,
      player: player.name,
      playerId: player.playerId,
      teamName: team.name,
      gamesOut: games,
      injuryKind: kind
    });
    injuries.push({ player, games, kind });
  }
}

function processTeamDiscipline(team, lineup, teamSide, result, seasonStore, division, options) {
  const events = [];
  const suspensions = [];
  const injuries = [];
  const matchYellows = new Set();
  const slots = (lineup || []).filter(s => s.player);
  if (!slots.length) return { events, suspensions, injuries, teamFouls: 0 };

  const teamFouls = randInt(10, 18);

  for (let i = 0; i < teamFouls; i++) {
    const candidates = slots.map(slot => {
      const player = resolveSquadPlayer(team, lineup, slot.player.playerId, slot.player.name);
      return player ? {
        player,
        weight: slotWeight(player, slot.slotPos, FOUL_WEIGHT)
      } : null;
    }).filter(Boolean);

    const picked = pickWeighted(candidates);
    if (!picked) continue;

    const statsEntry = ensureStatsEntry(seasonStore, division, picked.player, team);
    statsEntry.fouls = (statsEntry.fouls || 0) + 1;

    const ctx = {
      team,
      teamSide,
      statsEntry,
      suspensions
    };
    maybeCardFromFoul(picked.player, matchYellows, events, ctx);
  }

  rollInjuriesForTeam(
    team, lineup, teamSide, result, teamFouls,
    options.isCopa, events, injuries
  );

  return { events, suspensions, injuries, teamFouls };
}

function ensureStatsEntry(store, division, player, team) {
  if (!store) return { fouls: 0, yellowCards: 0, redCards: 0 };
  if (!store[division]) store[division] = {};
  const key = player.playerId;
  if (!store[division][key]) {
    store[division][key] = {
      playerId: key,
      name: player.name,
      teamId: team.id,
      teamName: team.name,
      goals: 0,
      assists: 0,
      fouls: 0,
      yellowCards: 0,
      redCards: 0
    };
  }
  const entry = store[division][key];
  entry.name = player.name;
  entry.teamId = team.id;
  entry.teamName = team.name;
  return entry;
}

/**
 * Após simular: cumpre suspensões/lesões da rodada anterior e aplica cartões/lesões novos.
 */
export function finalizeMatch(homeTeam, awayTeam, result, options = {}) {
  const {
    seasonStats = null,
    division = null,
    isCopa = false,
    playerTeamId = null
  } = options;

  tickClubAvailability(homeTeam);
  tickClubAvailability(awayTeam);

  const homeLineup = result.hLineup || [];
  const awayLineup = result.aLineup || [];

  const homeDisc = processTeamDiscipline(
    homeTeam, homeLineup, 'home', result, seasonStats, division, { isCopa }
  );
  const awayDisc = processTeamDiscipline(
    awayTeam, awayLineup, 'away', result, seasonStats, division, { isCopa }
  );

  const disciplineEvents = [...homeDisc.events, ...awayDisc.events]
    .sort((a, b) => a.min - b.min);

  result.teamFouls = {
    home: homeDisc.teamFouls,
    away: awayDisc.teamFouls
  };
  result.disciplineSummary = {
    home: { suspensions: homeDisc.suspensions, injuries: homeDisc.injuries },
    away: { suspensions: awayDisc.suspensions, injuries: awayDisc.injuries }
  };

  const goalEvents = (result.events || []).filter(e => e.type === 'goal');
  result.events = [...goalEvents, ...disciplineEvents].sort((a, b) => a.min - b.min);

  const playerNews = [];
  if (playerTeamId) {
    const isHomePlayer = homeTeam.id === playerTeamId;
    const isAwayPlayer = awayTeam.id === playerTeamId;
    if (isHomePlayer || isAwayPlayer) {
      const side = isHomePlayer ? homeDisc : awayDisc;
      for (const s of side.suspensions) {
        playerNews.push({ type: 'suspension', player: s.player, reason: s.reason });
      }
      for (const inj of side.injuries) {
        playerNews.push({ type: 'injury', player: inj.player, games: inj.games, kind: inj.kind });
      }
    }
  }

  return { disciplineEvents, playerNews };
}

export function getUnavailableCount(squad) {
  ensureSquadDiscipline(squad);
  return squad.filter(p => !isPlayerAvailable(p)).length;
}

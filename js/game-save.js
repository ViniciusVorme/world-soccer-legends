/**
 * Save/load da carreira — serializa o estado e persiste no armazenamento local.
 */

import { resolveClubDisplayName } from './club-names.js';
import { ensurePlayerDiscipline } from './discipline.js';
import { CLUB_IN_SERIE_C, getTeamDisplayStrength, buildGlobalPlayerMap, refreshClubSquadForDivision } from './data.js';
import { generateFixtures } from './league.js';
import { getPlayerCrestConfig, setPlayerCrestConfig, DEFAULT_PLAYER_CREST } from './crest-custom.js';
import { STORAGE_KEYS, getItem, setItem, removeItem } from './storage.js';
import { devWarn } from './debug.js';

export const SAVE_VERSION = 1;

let saveTimer = null;
let saveRestoreInProgress = false;

export function isSaveRestoreInProgress() {
  return saveRestoreInProgress;
}

function snapshotPlayer(player) {
  if (!player) return null;
  const snap = {
    playerId: player.playerId,
    name: player.name,
    positions: player.positions,
    positionsStr: player.positionsStr,
    force: player.force,
    legend: !!player.legend,
    copa: player.copa,
    nation: player.nation,
    birthYear: player.birthYear
  };
  if (player.discipline) snap.discipline = { ...player.discipline };
  return snap;
}

function serializeTeam(team) {
  return {
    id: team.id,
    name: team.name,
    isPlayer: !!team.isPlayer,
    division: team.division,
    formation: team.formation || '433',
    strength: team.strength,
    stats: team.stats ? { ...team.stats } : { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 },
    squad: team.isPlayer
      ? team.squad.map(snapshotPlayer)
      : team.squad.map(p => p.playerId)
  };
}

function serializeLeague(league) {
  return {
    currentRound: league.currentRound,
    fixtures: league.fixtures,
    teams: league.teams.map(serializeTeam)
  };
}

export function serializeGameState(state) {
  return {
    v: SAVE_VERSION,
    savedAt: Date.now(),
    clubName: state.clubName,
    budget: state.budget,
    squad: state.squad.map(snapshotPlayer),
    lineup: state.lineup.map(slot => ({
      slotPos: slot.slotPos,
      playerId: slot.player?.playerId ?? null
    })),
    formation: state.formation,
    serieA: serializeLeague(state.serieA),
    serieB: serializeLeague(state.serieB),
    serieC: serializeLeague(state.serieC),
    playerDivision: state.playerDivision,
    viewingDivision: state.viewingDivision,
    viewingStatsDivision: state.viewingStatsDivision,
    viewingStatCategory: state.viewingStatCategory,
    seasonStats: state.seasonStats,
    news: state.news,
    season: state.season,
    history: state.history,
    copaBrasil: state.copaBrasil,
    matchDayType: state.matchDayType,
    clubProfile: state.clubProfile,
    reinforcementPrompt: state.reinforcementPrompt,
    marketPool: state.marketPool,
    negotiationAttempts: state.negotiationAttempts,
    onboarding: state.onboarding,
    marketPage: state.marketPage,
    playerCrest: getPlayerCrestConfig()
  };
}

function buildPlayersMap(allPlayers) {
  return buildGlobalPlayerMap(allPlayers);
}

function rehydratePlayer(entry, playersById) {
  if (!entry) return null;
  if (typeof entry === 'string') {
    const base = playersById.get(entry);
    if (!base) return null;
    const player = { ...base };
    ensurePlayerDiscipline(player);
    return player;
  }
  const base = playersById.get(entry.playerId);
  const merged = { ...(base || entry), ...entry };
  if (entry.discipline) merged.discipline = { ...entry.discipline };
  ensurePlayerDiscipline(merged);
  return merged;
}

function repairLeagueStructures(state) {
  const serieB = state.serieB;
  if (!serieB?.teams?.some(t => t.isPlayer)) return;

  const cName = resolveClubDisplayName(CLUB_IN_SERIE_C);
  const americaIdx = serieB.teams.findIndex(
    t => !t.isPlayer && resolveClubDisplayName(t.name) === cName
  );
  let changed = false;
  if (americaIdx !== -1 && serieB.teams.length > 20) {
    serieB.teams.splice(americaIdx, 1);
    changed = true;
  }

  const round = serieB.fixtures?.[serieB.currentRound];
  const playerInRound = round?.some(m => m.home === 'player' || m.away === 'player');
  if (changed || (!playerInRound && serieB.currentRound < (serieB.fixtures?.length ?? 0))) {
    serieB.fixtures = generateFixtures(serieB.teams);
  }
}

function deserializeTeam(data, playersById) {
  const teamName = resolveClubDisplayName(data.name);
  const savedCount = Array.isArray(data.squad) ? data.squad.length : 0;
  let squad = data.squad
    .map(entry => rehydratePlayer(entry, playersById))
    .filter(Boolean);

  if (!data.isPlayer && teamName && savedCount > 0 && squad.length < savedCount) {
    const refreshed = refreshClubSquadForDivision(teamName, data.division);
    if (refreshed?.squad?.length) {
      squad = refreshed.squad;
    }
  }

  const team = {
    id: data.id,
    name: teamName,
    isPlayer: !!data.isPlayer,
    division: data.division,
    formation: data.formation || '433',
    stats: data.stats,
    squad
  };
  team.strength = squad.length
    ? (data.strength ?? getTeamDisplayStrength(team))
    : 0;
  return team;
}

function deserializeLeague(data, playersById) {
  return {
    currentRound: data.currentRound ?? 0,
    fixtures: data.fixtures ?? [],
    teams: (data.teams ?? []).map(t => deserializeTeam(t, playersById))
  };
}

export function peekSaveMeta() {
  const raw = getItem(STORAGE_KEYS.SAVE);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data?.v !== SAVE_VERSION || !data.clubName) return null;
    const league = data.playerDivision === 1
      ? data.serieA
      : data.playerDivision === 2
        ? data.serieB
        : data.serieC;
    const totalRounds = league?.fixtures?.length ?? 38;
    const round = Math.min((league?.currentRound ?? 0) + 1, totalRounds);
    return {
      clubName: data.clubName,
      season: data.season ?? 1,
      division: data.playerDivision ?? 2,
      round,
      totalRounds
    };
  } catch {
    return null;
  }
}

export function loadGameSave(state, allPlayers) {
  const raw = getItem(STORAGE_KEYS.SAVE);
  if (!raw) return false;

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return false;
  }
  if (data?.v !== SAVE_VERSION || !data.clubName) return false;

  saveRestoreInProgress = true;
  try {
    const playersById = buildPlayersMap(allPlayers);

    state.clubName = data.clubName;
    state.budget = data.budget;
    state.formation = data.formation || '433';
    state.squad = (data.squad ?? [])
      .map(s => rehydratePlayer(s, playersById))
      .filter(Boolean);
    state.lineup = (data.lineup ?? []).map(slot => ({
      slotPos: slot.slotPos,
      player: slot.playerId ? rehydratePlayer(slot.playerId, playersById) : null
    }));
    state.serieA = deserializeLeague(data.serieA ?? { teams: [], fixtures: [], currentRound: 0 }, playersById);
    state.serieB = deserializeLeague(data.serieB ?? { teams: [], fixtures: [], currentRound: 0 }, playersById);
    state.serieC = deserializeLeague(data.serieC ?? { teams: [], fixtures: [], currentRound: 0 }, playersById);
    state.playerDivision = data.playerDivision ?? 2;
    state.viewingDivision = data.viewingDivision ?? state.playerDivision;
    state.viewingStatsDivision = data.viewingStatsDivision ?? state.playerDivision;
    state.viewingStatCategory = data.viewingStatCategory ?? 'goals';
    state.seasonStats = data.seasonStats;
    state.news = data.news ?? [];
    state.season = data.season ?? 1;
    state.history = data.history;
    state.copaBrasil = data.copaBrasil;
    state.matchDayType = data.matchDayType ?? 'league';
    state.clubProfile = data.clubProfile;
    state.reinforcementPrompt = data.reinforcementPrompt;
    state.marketPool = data.marketPool;
    state.negotiationAttempts = data.negotiationAttempts ?? {};
    state.onboarding = data.onboarding;
    state.marketPage = data.marketPage ?? 0;
    state.pendingSeasonEnd = null;
    state.gameStarted = true;
    setPlayerCrestConfig(data.playerCrest ?? DEFAULT_PLAYER_CREST);
    repairLeagueStructures(state);
    return true;
  } finally {
    saveRestoreInProgress = false;
  }
}

export function persistGameSave(state) {
  if (!state.gameStarted || saveRestoreInProgress) return;
  try {
    const payload = JSON.stringify(serializeGameState(state));
    setItem(STORAGE_KEYS.SAVE, payload);
  } catch (err) {
    devWarn('[game-save] persist failed:', err);
  }
}

export function clearGameSave() {
  removeItem(STORAGE_KEYS.SAVE);
  removeItem(STORAGE_KEYS.CREST);
}

export function scheduleGameSave(state) {
  if (!state.gameStarted || saveRestoreInProgress) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persistGameSave(state);
  }, 1000);
}

export function flushGameSave(state) {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  persistGameSave(state);
}

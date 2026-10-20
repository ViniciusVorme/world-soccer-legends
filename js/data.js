import {
  resolveClubDisplayName,
  resolveClubSquadsKey
} from './club-names.js';
import { devWarn } from './debug.js';

const DATA_CACHE_BUST = '20260620';
const DATA_URL = `data/all-players.json?cb=${DATA_CACHE_BUST}`;
const SERIE_A_SQUADS_URL = `data/club-squads-serie-a.json?cb=${DATA_CACHE_BUST}`;
const SERIE_B_SQUADS_URL = `data/club-squads-serie-b.json?cb=${DATA_CACHE_BUST}`;
const SERIE_C_SQUADS_URL = `data/club-squads-serie-c.json?cb=${DATA_CACHE_BUST}`;

let serieASquadsCache = null;
let serieBSquadsCache = null;
let serieCSquadsCache = null;

const POSITION_LABELS = {
  GOL: 'Goleiro', ZAG: 'Zagueiro', LD: 'Lat. Dir.', LE: 'Lat. Esq.',
  VOL: 'Volante', MC: 'Meia C.', MEI: 'Meia', ME: 'Meia Esq.', MD: 'Meia Dir.',
  PD: 'Ponta Dir.', PE: 'Ponta Esq.', CA: 'Centroavante'
};

const FORMATIONS = {
  '433': { label: '4-3-3', slots: ['GOL', 'LD', 'ZAG', 'ZAG', 'LE', 'VOL', 'MC', 'MEI', 'PD', 'CA', 'PE'] },
  '442': { label: '4-4-2', slots: ['GOL', 'LD', 'ZAG', 'ZAG', 'LE', 'VOL', 'MC', 'MEI', 'MD', 'CA', 'PE'] },
  '352': { label: '3-5-2', slots: ['GOL', 'ZAG', 'ZAG', 'ZAG', 'LD', 'LE', 'VOL', 'MC', 'MEI', 'CA', 'CA'] },
  '4231': { label: '4-2-3-1', slots: ['GOL', 'LD', 'ZAG', 'ZAG', 'LE', 'VOL', 'MC', 'MD', 'MEI', 'ME', 'CA'] }
};

const SLOT_POSITIONS = {
  '433': [
    { pos: 'GOL', x: 50, y: 92 },
    { pos: 'LD', x: 82, y: 72 }, { pos: 'ZAG', x: 62, y: 75 }, { pos: 'ZAG', x: 38, y: 75 }, { pos: 'LE', x: 18, y: 72 },
    { pos: 'VOL', x: 50, y: 58 }, { pos: 'MC', x: 70, y: 50 }, { pos: 'MEI', x: 30, y: 50 },
    { pos: 'PD', x: 82, y: 28 }, { pos: 'CA', x: 50, y: 18 }, { pos: 'PE', x: 18, y: 28 }
  ],
  '442': [
    { pos: 'GOL', x: 50, y: 92 },
    { pos: 'LD', x: 82, y: 73 }, { pos: 'ZAG', x: 62, y: 73 }, { pos: 'ZAG', x: 38, y: 73 }, { pos: 'LE', x: 18, y: 73 },
    { pos: 'VOL', x: 40, y: 53 }, { pos: 'MC', x: 60, y: 53 }, { pos: 'MEI', x: 20, y: 53 }, { pos: 'MD', x: 80, y: 53 },
    { pos: 'CA', x: 38, y: 26 }, { pos: 'PE', x: 62, y: 26 }
  ],
  '352': [
    { pos: 'GOL', x: 50, y: 92 },
    { pos: 'ZAG', x: 70, y: 75 }, { pos: 'ZAG', x: 50, y: 78 }, { pos: 'ZAG', x: 30, y: 75 },
    { pos: 'LD', x: 88, y: 55 }, { pos: 'LE', x: 12, y: 55 },
    { pos: 'VOL', x: 50, y: 58 }, { pos: 'MC', x: 70, y: 45 }, { pos: 'MEI', x: 30, y: 45 },
    { pos: 'CA', x: 38, y: 20 }, { pos: 'CA', x: 62, y: 20 }
  ],
  '4231': [
    { pos: 'GOL', x: 50, y: 92 },
    { pos: 'LD', x: 82, y: 72 }, { pos: 'ZAG', x: 62, y: 75 }, { pos: 'ZAG', x: 38, y: 75 }, { pos: 'LE', x: 18, y: 72 },
    { pos: 'VOL', x: 38, y: 58 }, { pos: 'MC', x: 62, y: 58 },
    { pos: 'MD', x: 82, y: 38 }, { pos: 'MEI', x: 50, y: 38 }, { pos: 'ME', x: 18, y: 38 },
    { pos: 'CA', x: 50, y: 18 }
  ]
};

// Clubes da Série A — Brasileirão 2026
// https://www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/serie-a/2026
const AI_CLUBS_A = [
  'Palmeiras', 'Flamengo', 'Fluminense', 'Athletico Paranaense', 'Red Bull Bragantino',
  'Bahia', 'Coritiba', 'São Paulo', 'Atlético Mineiro', 'Corinthians',
  'Cruzeiro', 'Botafogo', 'Vitória', 'Internacional', 'Santos',
  'Grêmio', 'Vasco da Gama', 'Remo', 'Mirassol', 'Chapecoense'
];

// https://www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/serie-b/2026
const AI_CLUBS_B = [
  'Vila Nova', 'São Bernardo', 'Sport Recife', 'Criciúma', 'Náutico',
  'Operário-PR', 'Fortaleza', 'Goiás', 'Novorizontino', 'Athletic',
  'Juventude', 'Atlético Goianiense', 'CRB', 'Ceará', 'Cuiabá',
  'Botafogo-SP', 'Avaí', 'Londrina', 'Ponte Preta'
];

// https://www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/serie-c/2026
const AI_CLUBS_C = [
  'Anápolis', 'Figueirense', 'Botafogo-PB', 'Confiança', 'Brusque',
  'Floresta', 'Caxias', 'Ferroviária', 'Paysandu', 'Barra',
  'Itabaiana', 'Ypiranga', 'Maringá', 'Guarani', 'Volta Redonda',
  'Maranhão', 'Limeira', 'Ituano', 'Santa Cruz', 'América Mineiro'
];

const TEAMS_PER_DIVISION = 20;

/** Último clube da Série A — desce para a B se o jogador estrear na elite. */
export const CLUB_RELEGATED_A_TO_B = 'Chapecoense';
/** América Mineiro disputa a Série C (fora da Série B do jogador). */
export const CLUB_IN_SERIE_C = 'América Mineiro';

const STARTER_SQUAD_TEMPLATE = [
  { name: 'Araujo', positions: ['GOL'], force: 66 },
  { name: 'Mendes', positions: ['GOL'], force: 64 },
  { name: 'Ribeiro', positions: ['LD'], force: 67 },
  { name: 'Carvalho', positions: ['LD', 'ZAG'], force: 66 },
  { name: 'Ferreira', positions: ['LE'], force: 67 },
  { name: 'Oliveira', positions: ['LE', 'ZAG'], force: 65 },
  { name: 'Costa', positions: ['ZAG'], force: 68 },
  { name: 'Almeida', positions: ['ZAG'], force: 67 },
  { name: 'Souza', positions: ['ZAG', 'LD'], force: 66 },
  { name: 'Lima', positions: ['VOL'], force: 69 },
  { name: 'Martins', positions: ['VOL', 'MC'], force: 68 },
  { name: 'Barbosa', positions: ['MC', 'MEI'], force: 68 },
  { name: 'Gomes', positions: ['MEI'], force: 70 },
  { name: 'Rocha', positions: ['MEI', 'MD'], force: 69 },
  { name: 'Nunes', positions: ['MD', 'PD'], force: 68 },
  { name: 'Pinto', positions: ['PD'], force: 69 },
  { name: 'Teixeira', positions: ['PE'], force: 68 },
  { name: 'Monteiro', positions: ['PE', 'PD'], force: 67 },
  { name: 'Cardoso', positions: ['CA'], force: 70 },
  { name: 'Castro', positions: ['CA', 'PE'], force: 68 }
];

export function createStarterSquad() {
  return STARTER_SQUAD_TEMPLATE.map((tpl, i) => {
    const positions = tpl.positions;
    return {
      playerId: `generic-starter-${i + 1}`,
      name: tpl.name,
      positions,
      positionsStr: positions.join('/'),
      force: tpl.force,
      legend: false,
      generic: true,
      sel: 'BASE',
      copa: 0,
      number: i + 1
    };
  });
}

/** Elenco genérico calibrado para a força média alvo (melhor escalação 4-3-3). */
export function createStarterSquadForTargetStrength(targetStrength, formation = '433') {
  const squad = createStarterSquad();
  const lineup = autoLineup(squad, formation);
  const current = teamStrength(lineup);
  const delta = targetStrength - current;
  if (delta === 0) return squad;
  return squad.map(p => ({
    ...p,
    force: Math.max(1, p.force + delta)
  }));
}

export function weakestTeamStrength(teams) {
  if (!teams?.length) return 0;
  return Math.min(...teams.map(t => t.strength ?? getTeamDisplayStrength(t)));
}

export function findAiClub(teams, name) {
  const display = resolveClubDisplayName(name);
  return teams.find(t => resolveClubDisplayName(t.name) === display) ?? null;
}

/** Série A com jogador: 19 clubes da A (sem Chapecoense) + clube do jogador. */
export function buildPlayerSerieATeams(allAiA, playerClub) {
  const relegated = resolveClubDisplayName(CLUB_RELEGATED_A_TO_B);
  const aiTeams = allAiA.filter(t => resolveClubDisplayName(t.name) !== relegated);
  return [playerClub, ...aiTeams];
}

/** Série B com jogador: 19 clubes da B + clube do jogador. */
export function buildPlayerSerieBTeams(allAiB, playerClub) {
  return [playerClub, ...allAiB];
}

/** Chapecoense desce da Série A e entra na Série B. */
export function applyChapecoenseRelegationToSerieB(allAiB, chapecoenseTeam) {
  if (!chapecoenseTeam) return allAiB;
  return allAiB.concat([{
    ...chapecoenseTeam,
    id: `ai-b-${AI_CLUBS_B.length}`,
    division: 2
  }]);
}

export function parsePositions(posStr) {
  if (Array.isArray(posStr)) return posStr;
  return posStr.split('/').map(p => p.trim()).filter(Boolean);
}

export function calcPrice(player) {
  let base = 1;
  const f = player.force;
  if (f >= 93) base = 45;
  else if (f >= 90) base = 30;
  else if (f >= 87) base = 20;
  else if (f >= 84) base = 12;
  else if (f >= 80) base = 7;
  else if (f >= 76) base = 4;
  else if (f >= 72) base = 2;
  else base = 1;
  if (player.legend) base = Math.round(base * 1.6);
  return base;
}

export function roundMoney(millions) {
  return Math.round(millions * 10) / 10;
}

export function formatMoney(millions) {
  const m = roundMoney(millions);
  if (m >= 1000) return `R$ ${(m / 1000).toFixed(1)}B`;
  const label = Number.isInteger(m) ? String(m) : m.toFixed(1);
  return `R$ ${label}M`;
}

export function buildGlobalPlayerMap(allPlayers) {
  const map = new Map(allPlayers.map(p => [p.playerId, p]));

  const ingestClubCache = (cache) => {
    if (!cache?.clubs) return;
    for (const club of Object.values(cache.clubs)) {
      for (const raw of club.squad || []) {
        if (!raw?.playerId || map.has(raw.playerId)) continue;
        const positions = parsePositions(raw.positions);
        map.set(raw.playerId, cloneSquadPlayer({
          ...raw,
          positions,
          positionsStr: positions.join('/')
        }));
      }
    }
  };

  ingestClubCache(serieASquadsCache);
  ingestClubCache(serieBSquadsCache);
  ingestClubCache(serieCSquadsCache);
  return map;
}

export async function loadPlayers() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error('Não foi possível carregar os jogadores. Use um servidor local.');
  const raw = await res.json();

  const map = new Map();
  for (const p of raw) {
    const positions = parsePositions(p.positions);
    const entry = { ...p, positions, positionsStr: positions.join('/') };
    const existing = map.get(p.playerId);
    if (!existing || p.force > existing.force || (p.force === existing.force && p.copa > existing.copa)) {
      map.set(p.playerId, entry);
    }
  }
  return [...map.values()].sort((a, b) => b.force - a.force);
}

export async function loadSerieASquads() {
  const res = await fetch(SERIE_A_SQUADS_URL);
  if (!res.ok) throw new Error('Não foi possível carregar os elencos da Série A.');
  serieASquadsCache = await res.json();
  return serieASquadsCache;
}

export async function loadSerieBSquads() {
  const res = await fetch(SERIE_B_SQUADS_URL);
  if (!res.ok) throw new Error('Não foi possível carregar os elencos da Série B.');
  serieBSquadsCache = await res.json();
  return serieBSquadsCache;
}

export async function loadSerieCSquads() {
  const res = await fetch(SERIE_C_SQUADS_URL);
  if (!res.ok) throw new Error('Não foi possível carregar os elencos da Série C.');
  serieCSquadsCache = await res.json();
  return serieCSquadsCache;
}

function clubLookupKeys(name) {
  const keys = [];
  const add = (key) => {
    if (key && !keys.includes(key)) keys.push(key);
  };
  add(resolveClubSquadsKey(name));
  add(name);
  add(resolveClubDisplayName(name));
  return keys;
}

function lookupClubEntry(cache, name) {
  if (!cache?.clubs) return null;
  for (const key of clubLookupKeys(name)) {
    if (cache.clubs[key]) return cache.clubs[key];
  }
  return null;
}

function squadsMismatchHint() {
  if (!serieASquadsCache || !serieBSquadsCache || !serieCSquadsCache) {
    return ' Recarregue com Ctrl+Shift+R ou use uma aba anônima.';
  }
  return '';
}

export function assertSquadsReady() {
  const serieA = buildFixedSerieAClubs().length;
  if (serieA < TEAMS_PER_DIVISION) {
    throw new Error(`Elencos da Série A incompletos (${serieA}/${TEAMS_PER_DIVISION}).${squadsMismatchHint()}`);
  }
  const serieB = buildFixedSerieBClubs().length;
  if (!serieB) {
    throw new Error(`Elencos da Série B incompletos.${squadsMismatchHint()}`);
  }
  const serieC = buildFixedSerieCClubs().length;
  if (serieC < TEAMS_PER_DIVISION) {
    throw new Error(`Elencos da Série C incompletos (${serieC}/${TEAMS_PER_DIVISION}).${squadsMismatchHint()}`);
  }
}

export async function ensureSquadsReady() {
  const pending = [];
  if (!serieASquadsCache) pending.push(loadSerieASquads());
  if (!serieBSquadsCache) pending.push(loadSerieBSquads());
  if (!serieCSquadsCache) pending.push(loadSerieCSquads());
  if (pending.length) await Promise.all(pending);
  assertSquadsReady();
}

/** Exceções manuais de overall — não seguem o cálculo por valor de mercado */
const FORCE_OVERRIDES = {
  'tm-a-210-022': 83
};

function cloneSquadPlayer(p) {
  return {
    ...p,
    force: FORCE_OVERRIDES[p.playerId] ?? p.force,
    positions: [...p.positions]
  };
}

function squadFromClubEntry(clubEntry) {
  return clubEntry.squad.map(cloneSquadPlayer);
}

export function buildSerieAClub(name, index) {
  const displayName = resolveClubDisplayName(name);
  const clubEntry = lookupClubEntry(serieASquadsCache, name);
  if (!clubEntry) {
    devWarn(`Elenco da Série A não encontrado: ${displayName}`);
    return null;
  }
  const squad = squadFromClubEntry(clubEntry);
  const formation = '433';
  return {
    id: `ai-a-${index}`,
    name: displayName,
    isPlayer: false,
    squad,
    strength: getTeamDisplayStrength({ squad, formation }),
    formation,
    division: 1,
    stats: { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 }
  };
}

export function buildFixedSerieAClubs() {
  return AI_CLUBS_A.map((name, i) => buildSerieAClub(name, i)).filter(Boolean);
}

export function refreshSerieAClubSquad(teamName) {
  const club = buildSerieAClub(teamName, 0);
  if (!club) return null;
  return { squad: club.squad, strength: club.strength };
}

export function buildSerieBClub(name, index) {
  const displayName = resolveClubDisplayName(name);
  const clubEntry = lookupClubEntry(serieBSquadsCache, name);
  if (!clubEntry) {
    devWarn(`Elenco da Série B não encontrado: ${displayName}`);
    return null;
  }
  const squad = squadFromClubEntry(clubEntry);
  const formation = '433';
  return {
    id: `ai-b-${index}`,
    name: displayName,
    isPlayer: false,
    squad,
    strength: getTeamDisplayStrength({ squad, formation }),
    formation,
    division: 2,
    stats: { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 }
  };
}

export function buildFixedSerieBClubs() {
  return AI_CLUBS_B.map((name, i) => buildSerieBClub(name, i)).filter(Boolean);
}

export function refreshSerieBClubSquad(teamName) {
  const club = buildSerieBClub(teamName, 0);
  if (!club) return null;
  return { squad: club.squad, strength: club.strength };
}

function serieCClubEntry(name) {
  const displayKey = resolveClubDisplayName(CLUB_IN_SERIE_C);
  if (clubLookupKeys(name).includes(displayKey) || name === CLUB_IN_SERIE_C || name === displayKey) {
    return lookupClubEntry(serieBSquadsCache, CLUB_IN_SERIE_C);
  }
  return lookupClubEntry(serieCSquadsCache, name);
}

export function buildSerieCClub(name, index) {
  const displayName = resolveClubDisplayName(name);
  const clubEntry = serieCClubEntry(name);
  if (!clubEntry) {
    devWarn(`Elenco da Série C não encontrado: ${displayName}`);
    return null;
  }
  const squad = squadFromClubEntry(clubEntry);
  const formation = '433';
  return {
    id: `ai-c-${index}`,
    name: displayName,
    isPlayer: false,
    squad,
    strength: getTeamDisplayStrength({ squad, formation }),
    formation,
    division: 3,
    stats: { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 }
  };
}

export function buildFixedSerieCClubs() {
  return AI_CLUBS_C.map((name, i) => buildSerieCClub(name, i)).filter(Boolean);
}

export function refreshSerieCClubSquad(teamName) {
  const club = buildSerieCClub(teamName, 0);
  if (!club) return null;
  return { squad: club.squad, strength: club.strength };
}

export function refreshClubSquadForDivision(teamName, division) {
  const key = resolveClubDisplayName(teamName);
  if (division === 1) return refreshSerieAClubSquad(key);
  if (division === 2) {
    if (AI_CLUBS_B.includes(key)) return refreshSerieBClubSquad(key);
    return refreshSerieCClubSquad(key);
  }
  if (division === 3) {
    if (AI_CLUBS_C.includes(key)) return refreshSerieCClubSquad(key);
    return refreshSerieBClubSquad(key);
  }
  return null;
}

export function playerFitsPosition(player, slotPos) {
  return player.positions.includes(slotPos) ||
    (slotPos === 'ZAG' && player.positions.some(p => ['ZAG', 'LD', 'LE'].includes(p))) ||
    (['MC', 'MEI', 'ME', 'MD', 'VOL'].includes(slotPos) && player.positions.some(p => ['VOL', 'MC', 'MEI', 'ME', 'MD'].includes(p))) ||
    (['PD', 'PE', 'CA'].includes(slotPos) && player.positions.some(p => ['PD', 'PE', 'CA'].includes(p)));
}

export function autoLineup(squad, formation, options = {}) {
  const { isEligible = () => true } = options;
  const slots = FORMATIONS[formation].slots;
  const used = new Set();
  const lineup = [];

  for (const slotPos of slots) {
    let best = null;
    let bestScore = -1;
    for (const p of squad) {
      if (used.has(p.playerId)) continue;
      if (!isEligible(p)) continue;
      if (!playerFitsPosition(p, slotPos)) continue;
      const bonus = p.positions.includes(slotPos) ? 5 : 0;
      const score = p.force + bonus;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (!best) {
      for (const p of squad) {
        if (used.has(p.playerId)) continue;
        if (!isEligible(p)) continue;
        if (p.force > bestScore) {
          bestScore = p.force;
          best = p;
        }
      }
    }
    if (best) {
      used.add(best.playerId);
      lineup.push({ slotPos, player: best });
    } else {
      lineup.push({ slotPos, player: null });
    }
  }
  return lineup;
}

import { calcTeamForces } from './forces.js';

export { calcTeamForces, PESO_ATAQUE, PESO_DEFESA } from './forces.js';

export function teamStrength(lineup) {
  return calcTeamForces(lineup).overall;
}

/** Força exibida e usada na simulação — melhor escalação do elenco */
export function getTeamDisplayStrength(team) {
  if (!team?.squad?.length) return 0;
  return teamStrength(autoLineup(team.squad, team.formation || '433'));
}

function pickPlayersInRange(allPlayers, excludeIds, minForce, maxForce, count) {
  let pool = allPlayers.filter(p => !excludeIds.has(p.playerId) && p.force >= minForce && p.force <= maxForce);
  if (pool.length < count * 18) {
    pool = allPlayers.filter(p => !excludeIds.has(p.playerId) && p.force >= minForce - 5 && p.force <= maxForce + 3);
  }
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled;
}

export function buildAiSquads(allPlayers, count, excludeIds, tier = 'A', idPrefix = 'ai-a') {
  if (tier === 'A') {
    const clubs = buildFixedSerieAClubs();
    if (clubs.length < count) {
      throw new Error(`Elencos da Série A incompletos (${clubs.length}/${count}).`);
    }
    return clubs.slice(0, count);
  }

  if (tier === 'C') {
    const clubs = buildFixedSerieCClubs();
    if (clubs.length < TEAMS_PER_DIVISION) {
      throw new Error(`Elencos da Série C incompletos (${clubs.length}/${TEAMS_PER_DIVISION}).`);
    }
    return clubs;
  }

  const clubs = buildFixedSerieBClubs();
  if (!clubs.length) {
    throw new Error('Elencos da Série B incompletos.');
  }
  return clubs;
}

export {
  POSITION_LABELS, FORMATIONS, SLOT_POSITIONS,
  AI_CLUBS_A, AI_CLUBS_B, AI_CLUBS_C, TEAMS_PER_DIVISION
};

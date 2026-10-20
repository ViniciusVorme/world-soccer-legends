function resolvePlayer(team, lineup, { playerId, name }) {
  if (playerId) {
    const fromLineup = lineup?.find(s => s.player?.playerId === playerId)?.player;
    if (fromLineup) return fromLineup;
    const fromSquad = team.squad.find(p => p.playerId === playerId);
    if (fromSquad) return fromSquad;
  }
  const byNameLineup = lineup?.find(s => s.player?.name === name)?.player;
  if (byNameLineup) return byNameLineup;
  return team.squad.find(p => p.name === name) || null;
}

function ensureEntry(store, division, player, team) {
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

export function createEmptySeasonStats() {
  return { 1: {}, 2: {}, 3: {} };
}

export function resetSeasonStats(store) {
  store[1] = {};
  store[2] = {};
  store[3] = {};
}

export function recordMatchToSeasonStats(store, division, homeTeam, awayTeam, result) {
  if (!store || !result || division == null) return;

  const homeLineup = result.hLineup || [];
  const awayLineup = result.aLineup || [];

  for (const event of result.events || []) {
    if (event.type === 'goal') {
      const isHome = event.team === 'home';
      const team = isHome ? homeTeam : awayTeam;
      const lineup = isHome ? homeLineup : awayLineup;
      const scorer = resolvePlayer(team, lineup, event);
      if (!scorer) continue;
      ensureEntry(store, division, scorer, team).goals++;
      if (event.assistPlayerId || event.assistPlayer) {
        const assister = resolvePlayer(team, lineup, {
          playerId: event.assistPlayerId,
          name: event.assistPlayer
        });
        if (assister) ensureEntry(store, division, assister, team).assists++;
      }
    }
  }
}

export function getStatLeaders(store, division, stat = 'goals', limit = 25) {
  if (!store) return [];
  const bucket = store[division] || {};
  const validStats = ['goals', 'assists', 'fouls', 'yellowCards', 'redCards'];
  const key = validStats.includes(stat) ? stat : 'goals';

  return Object.values(bucket)
    .filter(entry => entry[key] > 0)
    .sort((a, b) => {
      if (b[key] !== a[key]) return b[key] - a[key];
      if (b.goals !== a.goals) return b.goals - a.goals;
      return a.name.localeCompare(b.name, 'pt-BR');
    })
    .slice(0, limit);
}

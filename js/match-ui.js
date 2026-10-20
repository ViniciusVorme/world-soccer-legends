import { t } from './i18n.js';
import { getCrestDataUrl } from './crests.js';
import { getPlayerCrestDataUrl } from './crest-custom.js';

export function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

export function teamInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
}

/**
 * Escudo do clube adversário; iniciais âmbar para o time do jogador.
 * @param {{ name: string, isPlayer?: boolean } | string} team
 * @param {{ isPlayer?: boolean, className?: string }} opts
 */
export function renderTeamCrest(team, opts = {}) {
  const name = typeof team === 'string' ? team : team?.name;
  const isPlayer = opts.isPlayer ?? (typeof team === 'object' && team?.isPlayer);
  const extra = opts.className || '';
  const base = `team-crest ${extra}`.trim();

  if (isPlayer) {
    const dataUrl = getPlayerCrestDataUrl(name);
    if (dataUrl) {
      return `<div class="${base} team-crest-img-wrap" title="${esc(name)}">
        <img src="${dataUrl}" alt="" class="team-crest-img" width="${64}" height="${72}" decoding="async" draggable="false"/>
      </div>`;
    }
    return `<div class="${base} team-crest-initials" title="${esc(name)}">${esc(teamInitials(name))}</div>`;
  }

  const dataUrl = getCrestDataUrl(name);
  if (dataUrl) {
    return `<div class="${base} team-crest-img-wrap" title="${esc(name)}">
      <img src="${dataUrl}" alt="" class="team-crest-img" width="${64}" height="${72}" decoding="async" draggable="false"/>
    </div>`;
  }

  return `<div class="${base} team-crest-initials" title="${esc(name)}">${esc(teamInitials(name))}</div>`;
}

export function renderPlayerShieldHtml(clubName, className = '') {
  const url = getPlayerCrestDataUrl(clubName);
  const extra = className ? ` ${className}` : '';
  if (url) {
    return `<div class="club-shield club-shield-custom${extra}"><img src="${url}" alt="" draggable="false"/></div>`;
  }
  return `<div class="club-shield${extra}">${esc(teamInitials(clubName))}</div>`;
}

export function applyPlayerShieldEl(el, clubName, extraClass = '') {
  if (!el) return;
  const url = getPlayerCrestDataUrl(clubName);
  const base = url ? 'club-shield club-shield-custom' : 'club-shield';
  el.className = extraClass ? `${base} ${extraClass}` : base;
  if (url) {
    el.innerHTML = `<img src="${url}" alt="" draggable="false"/>`;
  } else {
    el.textContent = teamInitials(clubName);
  }
}
export function playerOriginLabel(player) {
  if (!player) return '';
  if (player.generic) return t('originBase');
  if (player.sel && player.copa) return `${player.sel} ${player.copa}`;
  return '';
}

export function playerOriginTagKind(player) {
  return player?.generic ? 'base' : 'origin';
}

/** Coloca o clube do jogador sempre à esquerda na UI da partida. */
export function getMatchDisplayView(home, away, result = {}) {
  const swapped = !!away.isPlayer;
  const left = swapped ? away : home;
  const right = swapped ? home : away;
  const leftGoals = swapped ? (result.awayGoals ?? 0) : (result.homeGoals ?? 0);
  const rightGoals = swapped ? (result.homeGoals ?? 0) : (result.awayGoals ?? 0);

  return {
    swapped,
    left,
    right,
    leftGoals,
    rightGoals,
    leftStr: swapped ? result.aStr : result.hStr,
    rightStr: swapped ? result.hStr : result.aStr,
    leftLineup: swapped ? result.aLineup : result.hLineup,
    rightLineup: swapped ? result.hLineup : result.aLineup,
    leftEventSide: swapped ? 'away' : 'home',
    rightEventSide: swapped ? 'home' : 'away',
    leftWins: leftGoals > rightGoals,
    rightWins: rightGoals > leftGoals
  };
}

export function groupScorerLines(events, teamSide) {
  const byPlayer = new Map();
  for (const e of events) {
    if (e.team !== teamSide || e.type !== 'goal') continue;
    if (!byPlayer.has(e.player)) byPlayer.set(e.player, []);
    byPlayer.get(e.player).push(e.min);
  }
  return [...byPlayer.entries()].map(([player, mins]) => ({
    player,
    mins: [...mins].sort((a, b) => a - b)
  }));
}

export function renderGoalsMiniSummary(events, emptyLabel = null, eventSides) {
  const empty = emptyLabel ?? t('noGoalsGame');
  const leftTeam = eventSides?.left ?? 'home';
  const rightTeam = eventSides?.right ?? 'away';
  const home = groupScorerLines(events, leftTeam);
  const away = groupScorerLines(events, rightTeam);
  const hasGoals = home.length || away.length;

  if (!hasGoals) {
    return `
      <div class="goals-mini-summary goals-mini-empty-state">
        <span class="goals-mini-ball">⚽</span>
        <span>${empty}</span>
      </div>`;
  }

  const renderSide = (lines, align) => lines.map(({ player, mins }) => `
    <div class="goals-mini-line goals-mini-${align}">
      <span class="goals-mini-player">${esc(player)}</span>
      <span class="goals-mini-mins">${mins.map(m => `${m}'`).join(', ')}</span>
    </div>`).join('');

  return `
    <div class="goals-mini-summary">
      <div class="goals-mini-col home">${renderSide(home, 'left') || '<span class="goals-mini-dash">—</span>'}</div>
      <div class="goals-mini-ball" aria-hidden="true">⚽</div>
      <div class="goals-mini-col away">${renderSide(away, 'right') || '<span class="goals-mini-dash">—</span>'}</div>
    </div>`;
}

export function scorerCounts(events, teamSide) {
  const counts = {};
  for (const e of events) {
    if (e.team !== teamSide || e.type !== 'goal') continue;
    const key = e.playerId || e.player;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

export function assistCounts(events, teamSide) {
  const counts = {};
  for (const e of events) {
    if (e.team !== teamSide || e.type !== 'goal' || !e.assistPlayerId) continue;
    counts[e.assistPlayerId] = (counts[e.assistPlayerId] || 0) + 1;
  }
  return counts;
}

function hashMatchSeed(result, leftName, rightName) {
  let s = ((result.homeGoals ?? 0) * 97 + (result.awayGoals ?? 0) * 89) >>> 0;
  for (const c of leftName + rightName) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return s || 1;
}

function createSeededRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function clampStat(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function teamAssistCount(events, teamSide) {
  return events.filter(e => e.team === teamSide && e.assistPlayerId).length;
}

function disciplineCounts(events, teamSide) {
  const counts = { yellow: {}, red: {}, injury: {} };
  for (const e of events || []) {
    if (e.team !== teamSide) continue;
    const key = e.playerId || e.player;
    if (e.type === 'yellow') counts.yellow[key] = (counts.yellow[key] || 0) + 1;
    if (e.type === 'red') counts.red[key] = (counts.red[key] || 0) + 1;
    if (e.type === 'injury') counts.injury[key] = (counts.injury[key] || 0) + 1;
  }
  return counts;
}

function deriveTeamShots(goals, lambda, rng) {
  // Média real por time: ~9–12 chutes; jogos fechados ~5–7; abertos raramente passam de 15
  const raw = goals * 1.4 + lambda * 1.8 + rng() * 4 + 2;
  return clampStat(Math.round(raw), Math.max(goals, 3), 15);
}

function deriveShotsOnTarget(goals, shots, rng) {
  // ~26–40% no alvo — típico 2–4 por time em jogos com poucos gols
  const ratio = 0.26 + rng() * 0.14;
  return clampStat(Math.max(goals, Math.round(shots * ratio)), goals, shots);
}

/** Estatísticas derivadas do resultado — determinísticas para o mesmo jogo. */
export function deriveMatchStats(result, displayView) {
  const rng = createSeededRng(hashMatchSeed(result, displayView.left.name, displayView.right.name));
  const swapped = displayView.swapped;

  const leftAttack = swapped ? result.aAttack : result.hAttack;
  const rightAttack = swapped ? result.hAttack : result.aAttack;
  const leftLambda = swapped ? result.lambdaAway : result.lambdaHome;
  const rightLambda = swapped ? result.lambdaHome : result.lambdaAway;

  const attackTotal = leftAttack + rightAttack || 1;
  const lambdaTotal = leftLambda + rightLambda || 1;
  const mix = 0.55 * (leftAttack / attackTotal) + 0.45 * (leftLambda / lambdaTotal);
  let leftPossession = Math.round(mix * 100 + (rng() - 0.5) * 8);
  leftPossession = clampStat(leftPossession, 34, 66);
  const rightPossession = 100 - leftPossession;

  const leftGoals = displayView.leftGoals;
  const rightGoals = displayView.rightGoals;

  const leftShots = deriveTeamShots(leftGoals, leftLambda, rng);
  const rightShots = deriveTeamShots(rightGoals, rightLambda, rng);

  const leftShotsOnTarget = deriveShotsOnTarget(leftGoals, leftShots, rng);
  const rightShotsOnTarget = deriveShotsOnTarget(rightGoals, rightShots, rng);

  const leftCorners = clampStat(Math.round(leftLambda * 2.2 + rng() * 4 + 2), 1, 14);
  const rightCorners = clampStat(Math.round(rightLambda * 2.2 + rng() * 4 + 2), 1, 14);

  const leftFouls = result.teamFouls
    ? (swapped ? result.teamFouls.away : result.teamFouls.home)
    : clampStat(Math.round(10 + rng() * 8 + (rightAttack - leftAttack) * 0.04), 7, 22);
  const rightFouls = result.teamFouls
    ? (swapped ? result.teamFouls.home : result.teamFouls.away)
    : clampStat(Math.round(10 + rng() * 8 + (leftAttack - rightAttack) * 0.04), 7, 22);

  return {
    leftPossession,
    rightPossession,
    leftGoals,
    rightGoals,
    leftShots,
    rightShots,
    leftShotsOnTarget,
    rightShotsOnTarget,
    leftCorners,
    rightCorners,
    leftFouls,
    rightFouls,
    leftAssists: teamAssistCount(result.events, displayView.leftEventSide),
    rightAssists: teamAssistCount(result.events, displayView.rightEventSide)
  };
}

function renderStatCompareRow(labelKey, leftVal, rightVal, { highlightMax = true } = {}) {
  const leftBetter = highlightMax && leftVal > rightVal;
  const rightBetter = highlightMax && rightVal > leftVal;
  return `
    <div class="match-stat-row">
      <span class="match-stat-num ${leftBetter ? 'is-better' : ''}">${leftVal}</span>
      <span class="match-stat-label">${t(labelKey)}</span>
      <span class="match-stat-num ${rightBetter ? 'is-better' : ''}">${rightVal}</span>
    </div>`;
}

export function renderMatchStats(result, displayView) {
  const stats = deriveMatchStats(result, displayView);
  const { leftPossession, rightPossession } = stats;

  return `
    <div class="match-stats-panel">
      <div class="match-stat-possession">
        <div class="match-stat-possession-values">
          <span class="match-stat-num ${leftPossession > rightPossession ? 'is-better' : ''}">${leftPossession}%</span>
          <span class="match-stat-label">${t('statPossession')}</span>
          <span class="match-stat-num ${rightPossession > leftPossession ? 'is-better' : ''}">${rightPossession}%</span>
        </div>
        <div class="possession-bar" role="presentation">
          <div class="possession-bar-home" style="width:${leftPossession}%"></div>
          <div class="possession-bar-away" style="width:${rightPossession}%"></div>
        </div>
      </div>
      ${renderStatCompareRow('statGoals', stats.leftGoals, stats.rightGoals)}
      ${renderStatCompareRow('statShots', stats.leftShots, stats.rightShots)}
      ${renderStatCompareRow('statShotsOnTarget', stats.leftShotsOnTarget, stats.rightShotsOnTarget)}
      ${renderStatCompareRow('statCorners', stats.leftCorners, stats.rightCorners)}
      ${renderStatCompareRow('statFouls', stats.leftFouls, stats.rightFouls, { highlightMax: false })}
      ${renderStatCompareRow('statAssists', stats.leftAssists, stats.rightAssists)}
    </div>`;
}

export function renderTeamRoster(lineup, events, teamSide) {
  if (!lineup?.length) {
    return `<p class="roster-empty">${t('rosterUnavailable')}</p>`;
  }

  const scorers = scorerCounts(events, teamSide);
  const assisters = assistCounts(events, teamSide);
  const discipline = disciplineCounts(events, teamSide);
  return lineup
    .filter(s => s.player)
    .map(slot => {
      const pid = slot.player.playerId;
      const goals = scorers[pid] || scorers[slot.player.name] || 0;
      const assists = assisters[pid] || 0;
      const yellows = discipline.yellow[pid] || discipline.yellow[slot.player.name] || 0;
      const reds = discipline.red[pid] || discipline.red[slot.player.name] || 0;
      const injured = discipline.injury[pid] || discipline.injury[slot.player.name] || 0;
      const rowClass = [goals ? 'scored' : '', assists ? 'assisted' : '', reds ? 'sent-off' : '', injured ? 'injured-row' : ''].filter(Boolean).join(' ');
      const disciplineIcons = [
        yellows ? `<span class="roster-card yellow" title="${t('yellowCard')}">🟨${yellows > 1 ? `<sup class="goal-mult">${yellows}</sup>` : ''}</span>` : '',
        reds ? `<span class="roster-card red" title="${t('redCard')}">🟥</span>` : '',
        injured ? `<span class="roster-injury" title="${t('injured')}">🩹</span>` : ''
      ].filter(Boolean).join('');
      return `
    <div class="roster-row ${rowClass}">
      <span class="roster-pos">${slot.slotPos}</span>
      <span class="roster-name">${esc(slot.player.name)}</span>
      <span class="roster-icons">
        ${disciplineIcons}
        ${assists ? `<span class="roster-boot" aria-label="${t('assistsCount', { n: assists })}" title="${t('assistsCount', { n: assists })}">👟${assists > 1 ? `<sup class="goal-mult">${assists}</sup>` : ''}</span>` : ''}
        <span class="roster-ball" aria-label="${goals ? t('goalsCount', { n: goals }) : ''}">
          ${goals ? `⚽${goals > 1 ? `<sup class="goal-mult">${goals}</sup>` : ''}` : ''}
        </span>
      </span>
    </div>`;
    }).join('');
}

import { PROMOTION_SPOTS, RELEGATION_SPOTS } from './league.js';
import { renderTeamCrest, esc } from './match-ui.js';
import { t, divisionLabel } from './i18n.js';

let activeRun = null;

function escAttr(str) {
  return String(str).replace(/'/g, "\\'");
}

export function captureStandingsSnapshot(teams) {
  const snapshot = new Map();
  teams.forEach((team, rank) => {
    snapshot.set(team.id, {
      rank,
      points: team.stats.points
    });
  });
  return snapshot;
}

function buildRankCell(newRank, oldRank, animate) {
  const rankDelta = oldRank !== undefined ? oldRank - newRank : 0;
  const showShift = animate && rankDelta !== 0;

  let deltaHtml = '';
  if (showShift && rankDelta > 0) {
    deltaHtml = `<span class="standings-rank-delta up" aria-hidden="true"><span class="standings-rank-arrow">↑</span><span class="standings-rank-steps">${rankDelta}</span></span>`;
  } else if (showShift && rankDelta < 0) {
    deltaHtml = `<span class="standings-rank-delta down" aria-hidden="true"><span class="standings-rank-arrow">↓</span><span class="standings-rank-steps">${-rankDelta}</span></span>`;
  }

  const rankStack = showShift
    ? `<span class="standings-rank-stack">
        <span class="standings-rank-ghost" aria-hidden="true">${oldRank + 1}</span>
        <span class="standings-rank-num">${newRank + 1}</span>
      </span>`
    : `<span class="standings-rank-num">${newRank + 1}</span>`;

  return `<td class="standings-rank-cell">${rankStack}${deltaHtml}</td>`;
}

export function buildStandingsRowHtml(team, index, {
  viewingDivision,
  relegStart,
  oldSnapshot,
  animate
}) {
  const sg = team.stats.gf - team.stats.ga;
  let zone = '';
  if (viewingDivision === 1 && index >= relegStart) zone = 'releg';
  else if (viewingDivision === 2) {
    if (index < PROMOTION_SPOTS) zone = 'promo';
    else if (index >= relegStart) zone = 'releg';
  } else if (viewingDivision === 3 && index < PROMOTION_SPOTS) zone = 'promo';

  const prev = oldSnapshot?.get(team.id);
  const oldRank = prev?.rank;
  const rankDelta = oldRank !== undefined ? oldRank - index : 0;
  const pointsChanged = animate && prev !== undefined && prev.points !== team.stats.points;

  return `
    <tr class="${team.isPlayer ? 'is-player' : ''} ${zone}"
        data-team-id="${escAttr(team.id)}"
        data-rank-delta="${rankDelta}">
      ${buildRankCell(index, oldRank, animate)}
      <td>
        <span class="standings-team-cell">
          ${renderTeamCrest(team, { className: 'standings-crest' })}
          <button class="team-link" onclick="window.viewTeamSquad('${escAttr(team.id)}')">${esc(team.name)}</button>
        </span>
      </td>
      <td>${team.stats.played}</td>
      <td>${team.stats.won}</td>
      <td>${team.stats.drawn}</td>
      <td>${team.stats.lost}</td>
      <td>${team.stats.gf}</td>
      <td>${team.stats.ga}</td>
      <td>${sg > 0 ? '+' : ''}${sg}</td>
      <td class="standings-pts-cell${pointsChanged ? ' standings-pts-changed' : ''}">
        <strong class="standings-pts-value">${team.stats.points}</strong>
      </td>
    </tr>`;
}

function measureRowStep(tbody) {
  const rows = tbody.querySelectorAll('tr[data-team-id]');
  if (rows.length < 2) {
    return rows[0]?.getBoundingClientRect().height || 46;
  }
  const top0 = rows[0].getBoundingClientRect().top;
  const top1 = rows[1].getBoundingClientRect().top;
  const step = top1 - top0;
  return step > 8 ? step : 46;
}

function buildBannerMessage(standings, oldSnapshot, viewingDivision) {
  const playerTeam = standings.find(t => t.isPlayer);
  if (!playerTeam || !oldSnapshot) return t('standingsUpdated');

  const prev = oldSnapshot.get(playerTeam.id);
  if (!prev) return t('standingsUpdated');

  const newRank = standings.findIndex(t => t.id === playerTeam.id);
  const delta = prev.rank - newRank;
  if (delta > 0) return t('standingsPlayerUp', { n: delta, div: divisionLabel(viewingDivision) });
  if (delta < 0) return t('standingsPlayerDown', { n: -delta, div: divisionLabel(viewingDivision) });
  return t('standingsPlayerSame');
}

function showBanner(bannerEl, message, tone) {
  if (!bannerEl) return;
  bannerEl.textContent = message;
  bannerEl.classList.remove('hidden', 'tone-up', 'tone-down', 'tone-neutral');
  bannerEl.classList.add(`tone-${tone}`);
  bannerEl.removeAttribute('hidden');
}

function hideBanner(bannerEl, delay = 2800) {
  if (!bannerEl) return;
  window.setTimeout(() => {
    bannerEl.classList.add('hidden');
    bannerEl.setAttribute('hidden', '');
  }, delay);
}

const ANIM_ROW_CLASSES = [
  'standings-row-flip', 'standings-row-go',
  'standings-move-up', 'standings-move-down', 'standings-settled',
  'standings-will-rise', 'standings-will-fall'
];

function stripRowAnimation(row) {
  ANIM_ROW_CLASSES.forEach(c => row.classList.remove(c));
  row.style.removeProperty('--standings-from-y');
  row.style.removeProperty('--standings-delay');
  row.style.removeProperty('--standings-duration');
  row.style.zIndex = '';
  row.querySelectorAll('td').forEach(td => {
    td.style.transform = '';
    td.style.transition = '';
    td.style.boxShadow = '';
    td.style.backgroundColor = '';
  });
}

function finalizeStandingsRows(tbody) {
  tbody.querySelectorAll('tr[data-team-id]').forEach(row => {
    stripRowAnimation(row);
    const rankCell = row.querySelector('.standings-rank-cell');
    if (!rankCell) return;

    const rankNum = rankCell.querySelector('.standings-rank-num');
    const delta = rankCell.querySelector('.standings-rank-delta');
    if (rankNum) {
      const num = rankNum.textContent;
      const deltaHtml = delta ? delta.outerHTML : '';
      rankCell.innerHTML = `<span class="standings-rank-num">${num}</span>${deltaHtml}`;
      rankCell.querySelector('.standings-rank-delta')?.classList.add('standings-delta-settled');
    }
    row.querySelector('.standings-pts-cell')?.classList.remove('standings-pts-changed');
  });
}

export function cancelStandingsAnimation() {
  if (!activeRun) return;
  window.clearTimeout(activeRun.cleanupTimer);
  if (activeRun.tbody) finalizeStandingsRows(activeRun.tbody);
  else activeRun.rows?.forEach(stripRowAnimation);
  activeRun.table?.classList.remove('standings-animating');
  activeRun.wrapper?.classList.remove('standings-animating');
  activeRun.banner?.classList.add('hidden');
  activeRun.banner?.setAttribute('hidden', '');
  activeRun = null;
}

export function runStandingsAnimation({
  tbody,
  table,
  wrapper,
  banner,
  oldSnapshot,
  standings,
  viewingDivision
}) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    showBanner(banner, buildBannerMessage(standings, oldSnapshot, viewingDivision), 'neutral');
    hideBanner(banner, 2000);
    return;
  }

  cancelStandingsAnimation();

  const rows = [...tbody.querySelectorAll('tr[data-team-id]')];
  if (!rows.length) return;

  const movers = rows
    .map(row => {
      const teamId = row.dataset.teamId;
      const prev = oldSnapshot.get(teamId);
      const newIndex = standings.findIndex(t => t.id === teamId);
      const oldIndex = prev?.rank ?? newIndex;
      const isPlayer = row.classList.contains('is-player');
      return { row, teamId, oldIndex, newIndex, delta: oldIndex - newIndex, isPlayer };
    })
    .filter(m => m.delta !== 0)
    .sort((a, b) => {
      if (a.isPlayer !== b.isPlayer) return a.isPlayer ? 1 : -1;
      return Math.abs(b.delta) - Math.abs(a.delta);
    });

  if (!movers.length) {
    showBanner(banner, buildBannerMessage(standings, oldSnapshot, viewingDivision), 'neutral');
    hideBanner(banner, 2000);
    return;
  }

  const playerMover = movers.find(m => m.row.classList.contains('is-player'));
  const tone = playerMover
    ? (playerMover.delta > 0 ? 'up' : 'down')
    : (movers.some(m => m.delta > 0) ? 'up' : 'down');

  showBanner(banner, buildBannerMessage(standings, oldSnapshot, viewingDivision), tone);

  table?.classList.add('standings-animating');
  wrapper?.classList.add('standings-animating');

  const rowStep = measureRowStep(tbody);
  let maxEnd = 0;

  movers.forEach(({ row, delta, oldIndex, newIndex, isPlayer }) => {
    const abs = Math.abs(delta);
    const playerBump = isPlayer ? 90 : 0;
    const delay = Math.min(40 + abs * 28, 220) + playerBump;
    const duration = Math.min(520 + abs * 55, 780) + (isPlayer ? 80 : 0);
    const end = delay + duration;
    if (end > maxEnd) maxEnd = end;

    row.classList.add('standings-row-flip', delta > 0 ? 'standings-move-up' : 'standings-move-down');
    row.style.setProperty('--standings-from-y', `${delta * rowStep}px`);
    row.style.setProperty('--standings-delay', `${delay}ms`);
    row.style.setProperty('--standings-duration', `${duration}ms`);
    row.style.zIndex = String(12 + abs);

    row.querySelectorAll('td').forEach(td => {
      td.style.transform = `translate3d(0, ${delta * rowStep}px, 0)`;
      td.style.transition = 'none';
      if (row.classList.contains('is-player')) {
        td.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.28)';
      }
    });

    row.dataset.oldRank = String(oldIndex + 1);
    row.dataset.newRank = String(newIndex + 1);
  });

  const run = { rows: movers.map(m => m.row), tbody, table, wrapper, banner, cleanupTimer: null };
  activeRun = run;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (activeRun !== run) return;

      movers.forEach(({ row }) => {
        row.classList.add('standings-row-go');
        row.querySelectorAll('td').forEach(td => {
          const delay = row.style.getPropertyValue('--standings-delay') || '0ms';
          const duration = row.style.getPropertyValue('--standings-duration') || '600ms';
          td.style.transition = `transform ${duration} cubic-bezier(0.22, 1, 0.36, 1) ${delay}, box-shadow ${duration} ease ${delay}`;
          td.style.transform = 'translate3d(0, 0, 0)';
        });
      });
    });
  });

  run.cleanupTimer = window.setTimeout(() => {
    if (activeRun !== run) return;

    finalizeStandingsRows(tbody);

    table?.classList.remove('standings-animating');
    wrapper?.classList.remove('standings-animating');
    activeRun = null;
    hideBanner(banner, 1800);
  }, maxEnd + 120);
}

export function renderStandingsTable({
  tbody,
  table,
  wrapper,
  banner,
  standings,
  viewingDivision,
  oldSnapshot,
  animate
}) {
  const relegStart = standings.length - RELEGATION_SPOTS;
  const showAnim = animate && oldSnapshot;

  cancelStandingsAnimation();
  if (!showAnim && banner) {
    banner.classList.add('hidden');
    banner.setAttribute('hidden', '');
    banner.textContent = '';
  }

  tbody.innerHTML = standings
    .map((team, i) => buildStandingsRowHtml(team, i, {
      viewingDivision,
      relegStart,
      oldSnapshot: showAnim ? oldSnapshot : null,
      animate: showAnim
    }))
    .join('');

  if (showAnim) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        runStandingsAnimation({
          tbody,
          table,
          wrapper,
          banner,
          oldSnapshot,
          standings,
          viewingDivision
        });
      });
    });
  }
}

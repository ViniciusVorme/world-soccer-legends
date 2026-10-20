import { PROMOTION_SPOTS, RELEGATION_SPOTS } from './league.js';
import { renderTeamCrest, esc } from './match-ui.js';
import { t, divisionLabel } from './i18n.js';
import { renderStandingsTable } from './standings-anim.js';
import { formatMoney } from './data.js';

export function buildSeasonEndExtras({
  divisionBefore,
  standings,
  oldSnapshot,
  playerTeamId,
  divisionAfter,
  isPlayerChampion
}) {
  const playerIdx = standings.findIndex(team => team.id === playerTeamId);
  const relegStart = standings.length - RELEGATION_SPOTS;
  const prevRank = oldSnapshot?.get(playerTeamId)?.rank;

  let drama = null;
  let mood = 'neutral';

  if (isPlayerChampion) {
    mood = 'champion';
  } else if (divisionAfter > divisionBefore) {
    mood = 'relegation';
    drama = prevRank != null && divisionBefore !== 3 && prevRank < relegStart
      ? 'relegation-last-day'
      : 'relegation';
  } else if (divisionAfter < divisionBefore) {
    mood = 'promotion';
    if (prevRank != null && prevRank >= PROMOTION_SPOTS) {
      drama = 'promotion-last-day';
    }
  } else if (
    prevRank != null
    && divisionBefore !== 3
    && prevRank >= relegStart
    && playerIdx < relegStart
  ) {
    mood = 'escape';
    drama = 'narrow-escape';
  }

  return { drama, mood, playerIdx, relegStart };
}

function dramaMessage(drama) {
  if (!drama) return '';
  const key = {
    'relegation-last-day': 'seasonEndDramaRelegation',
    relegation: 'seasonEndDramaRelegationGeneric',
    'promotion-last-day': 'seasonEndDramaPromotion',
    'narrow-escape': 'seasonEndDramaEscape'
  }[drama];
  return key ? t(key) : '';
}

function buildPodiumHtml(top3, division) {
  if (!top3.length) return '';
  const order = [
    { team: top3[1], place: 2, height: 'mid' },
    { team: top3[0], place: 1, height: 'tall' },
    { team: top3[2], place: 3, height: 'low' }
  ].filter(slot => slot.team);

  const slots = order.map(({ team, place, height }) => `
    <div class="season-end-podium-slot podium-${place} podium-${height}${team.isPlayer ? ' is-player' : ''}">
      <div class="season-end-podium-crest-wrap">
        ${renderTeamCrest(team, { className: 'season-end-podium-crest' })}
        <span class="season-end-podium-medal">${place}º</span>
      </div>
      <p class="season-end-podium-name">${esc(team.name)}</p>
      <p class="season-end-podium-pts">${team.stats.points} ${t('pts')}</p>
      <div class="season-end-podium-block" aria-hidden="true"></div>
    </div>`).join('');

  return `
    <section class="season-end-podium-section">
      <h3 class="season-end-section-title">${t('seasonEndPodiumTitle', { div: divisionLabel(division) })}</h3>
      <div class="season-end-podium">${slots}</div>
    </section>`;
}

function buildLeagueCardsHtml(leaguesSummary) {
  const cards = leaguesSummary.map(league => {
    const champion = league.standings[0];
    const top = league.standings.slice(0, 4);
    const rows = top.map((team, i) => `
      <li class="season-end-league-row${team.isPlayer ? ' is-player' : ''}${i === 0 ? ' is-champion' : ''}">
        <span class="season-end-league-rank">${i + 1}º</span>
        ${renderTeamCrest(team, { className: 'season-end-league-crest' })}
        <span class="season-end-league-name">${esc(team.name)}</span>
        <span class="season-end-league-pts">${team.stats.points}</span>
      </li>`).join('');

    return `
      <article class="season-end-league-card">
        <header class="season-end-league-card-head">
          <h4>${esc(league.label)}</h4>
          ${champion ? `<span class="season-end-league-winner">
            ${renderTeamCrest(champion, { className: 'season-end-league-crest-sm' })}
            <span>${esc(champion.name)}</span>
          </span>` : ''}
        </header>
        <ol class="season-end-league-list">${rows}</ol>
      </article>`;
  }).join('');

  return `
    <section class="season-end-leagues-section">
      <h3 class="season-end-section-title">${t('seasonEndLeaguesTitle')}</h3>
      <div class="season-end-league-cards">${cards}</div>
    </section>`;
}

export function mountSeasonEndScreen(container, data, { onContinue } = {}) {
  if (!container || !data) return;

  const {
    isPlayerChampion,
    championName,
    divName,
    divisionBefore,
    playerPos,
    points,
    nextDiv,
    lastMatch,
    standings,
    oldSnapshot,
    leaguesSummary,
    drama,
    mood
  } = data;

  const seasonPrize = data.seasonPrize;

  const isRelegated = mood === 'relegation';

  let title;
  let headline;
  let subtitle;

  if (isPlayerChampion) {
    title = t('championTitle');
    headline = esc(data.clubName || championName);
    subtitle = t('seasonEndChampionSubtitle', { div: esc(divName) });
  } else if (isRelegated) {
    title = t('seasonEndRelegatedTitle');
    headline = esc(data.clubName || championName);
    subtitle = t('seasonEndRelegatedSubtitle', { div: esc(nextDiv) });
  } else {
    title = t('seasonEndTitle');
    headline = esc(championName);
    subtitle = '';
  }

  const dramaLine = dramaMessage(drama);
  const lastMatchHtml = lastMatch
    ? `<p class="season-end-last-match season-end-last-match-decisive">
        ${t('seasonEndLastMatchDecisive', {
          pg: lastMatch.playerGoals,
          og: lastMatch.opponentGoals,
          opponent: esc(lastMatch.opponent)
        })}
      </p>`
    : '';

  const top3 = standings.slice(0, 3);
  const podiumHtml = buildPodiumHtml(top3, divisionBefore);
  const leaguesHtml = buildLeagueCardsHtml(leaguesSummary);

  container.innerHTML = `
    <div class="season-end-screen season-end-mood-${mood}" data-season-mood="${mood}">
      <canvas class="season-end-confetti-canvas" aria-hidden="true"></canvas>
      <div class="season-end-scroll">
        <header class="season-end-hero">
          <span class="season-end-badge">${t('seasonLabel', { n: data.season })}</span>
          ${dramaLine ? `<div class="season-end-drama"><p>${esc(dramaLine)}</p></div>` : ''}
          <h2 class="season-end-title">${title}</h2>
          <p class="season-end-headline">${headline}</p>
          ${subtitle ? `<p class="season-end-subtitle">${subtitle}</p>` : ''}
          ${lastMatchHtml}
          <p class="season-end-campaign">${t('seasonEndYourCampaign', { pos: playerPos, pts: points })}</p>
          ${seasonPrize != null ? `<p class="season-end-prize">${t('seasonEndPrize', { prize: formatMoney(seasonPrize) })}</p>` : ''}
          <p class="season-end-next">${t('nextSeasonDiv')} <strong>${esc(nextDiv)}</strong></p>
        </header>

        ${podiumHtml}
        ${leaguesHtml}

        <section class="season-end-standings-section">
          <h3 class="season-end-section-title">${t('seasonEndStandingsTitle', { div: divName })}</h3>
          <div class="season-end-standings-card card card-elevated">
            <div id="season-end-standings-banner" class="standings-update-banner hidden" hidden aria-live="polite"></div>
            <div class="season-end-standings-wrap" id="season-end-standings-wrap">
              <table class="standings-table season-end-standings-table" id="season-end-standings-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>${t('club')}</th>
                    <th>J</th>
                    <th>V</th>
                    <th>E</th>
                    <th>D</th>
                    <th>GP</th>
                    <th>GC</th>
                    <th>SG</th>
                    <th>${t('pts')}</th>
                  </tr>
                </thead>
                <tbody id="season-end-standings-body"></tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      <div class="match-action-bar season-end-action-bar">
        <button type="button" class="btn btn-primary btn-season-continue" data-season-action>
          ${t('startSeasonN', { n: data.season + 1 })}
        </button>
      </div>
    </div>`;

  container.querySelector('[data-season-action]')?.addEventListener('click', () => onContinue?.());

  if (isPlayerChampion || mood === 'champion') {
    launchConfetti(container.querySelector('.season-end-confetti-canvas'));
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      renderStandingsTable({
        tbody: container.querySelector('#season-end-standings-body'),
        table: container.querySelector('#season-end-standings-table'),
        wrapper: container.querySelector('#season-end-standings-wrap'),
        banner: container.querySelector('#season-end-standings-banner'),
        standings,
        viewingDivision: divisionBefore,
        oldSnapshot: oldSnapshot || null,
        animate: !!oldSnapshot
      });
    });
  });
}

export function launchConfetti(canvas) {
  if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ctx = canvas.getContext('2d');
  const parent = canvas.parentElement;
  if (!ctx || !parent) return;

  const resize = () => {
    const rect = parent.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  };
  resize();

  const colors = ['#e8a830', '#f5d76e', '#ffffff', '#4caf82', '#5b9fd4'];
  const pieces = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    w: 6 + Math.random() * 6,
    h: 10 + Math.random() * 8,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 0.2,
    vy: 1.5 + Math.random() * 2.5,
    vx: (Math.random() - 0.5) * 1.2
  }));

  let frame = 0;
  const maxFrames = 280;

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.spin;
      if (p.y > canvas.height + 20) {
        p.y = -20;
        p.x = Math.random() * canvas.width;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    frame += 1;
    if (frame < maxFrames) {
      requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  requestAnimationFrame(tick);
}

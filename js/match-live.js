import { esc, renderTeamCrest, renderGoalsMiniSummary, getMatchDisplayView } from './match-ui.js';
import { playWhistle, playGoal, playHalftime, startMatchAmbience, stopMatchAmbience, resetMatchAudio } from './audio.js';
import { t, getNarration } from './i18n.js';

const TICK_MS = 95;
const HALFTIME_MS = 900;
const FINISH_DELAY_MS = 600;
const EMPTY_MATCH_MS = 2800;
const MAX_COMMENTARY_LINES = 10;

let liveTimer = null;
let liveState = null;

function pickFrom(pool, min, salt = 0) {
  return pool[(min * 7 + salt * 13) % pool.length];
}

function pickNarration(min) {
  const NARRATION = getNarration();
  if (min <= 5) return pickFrom(NARRATION.opening, min);
  if (min <= 20) return pickFrom(NARRATION.firstHalf, min);
  if (min <= 38) return pickFrom(NARRATION.firstHalf, min, 1);
  if (min <= 44) return pickFrom(NARRATION.lateFirstHalf, min);
  if (min <= 50) return pickFrom(NARRATION.secondHalfStart, min);
  if (min <= 70) return pickFrom(NARRATION.midSecond, min);
  if (min <= 82) return pickFrom(NARRATION.finalStretch, min);

  if (min % 3 === 0) return pickFrom(NARRATION.atmosphere, min);
  return pickFrom(NARRATION.finalStretch, min, 2);
}

function hashSeed(result, round) {
  let s = round * 997;
  s += result.homeGoals * 89 + result.awayGoals * 67;
  for (const e of result.events) {
    s += e.min * 31 + e.player.length * 17;
  }
  return s >>> 0;
}

function nextSeed(seed) {
  return (seed * 1664525 + 1013904223) >>> 0;
}

function pickSpacedMinutes(seed, pool, count, minGap) {
  const shuffled = [...pool];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = nextSeed(s);
    const j = s % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const picked = [];
  for (const m of shuffled) {
    if (picked.length >= count) break;
    if (picked.every(p => Math.abs(p - m) >= minGap)) picked.push(m);
  }
  return picked.sort((a, b) => a - b);
}

function buildNarrationSchedule(result, round) {
  const goalMins = new Set(result.events.map(e => e.min));
  const firstHalfPool = [];
  const secondHalfPool = [];

  for (let m = 4; m <= 44; m++) {
    if (!goalMins.has(m) && m !== 45) firstHalfPool.push(m);
  }
  for (let m = 48; m <= 88; m++) {
    if (!goalMins.has(m)) secondHalfPool.push(m);
  }

  const goalCount = result.events.length;
  const totalLines = Math.max(6, Math.min(11, 10 - Math.floor(goalCount / 2)));
  const firstCount = Math.ceil(totalLines / 2);
  const secondCount = totalLines - firstCount;
  const minGap = 7;

  let seed = hashSeed(result, round);
  const firstMins = pickSpacedMinutes(seed, firstHalfPool, firstCount, minGap);
  seed = nextSeed(seed);
  const secondMins = pickSpacedMinutes(seed, secondHalfPool, secondCount, minGap);

  const schedule = new Map();
  for (const m of [...firstMins, ...secondMins]) {
    schedule.set(m, pickNarration(m));
  }
  return schedule;
}

function clearLiveTimer() {
  if (liveTimer) {
    clearTimeout(liveTimer);
    liveTimer = null;
  }
}

function renderLiveShell(home, away, result, round) {
  const d = getMatchDisplayView(home, away, result);
  return `
    <div class="match-live-header">
      <span class="match-live-badge">${t('liveBadge', { n: round })}</span>
      <button type="button" class="btn btn-secondary btn-skip-live" id="btn-skip-live">${t('skip')}</button>
    </div>
    <div class="match-live-progress">
      <div class="match-live-progress-bar" id="live-progress-bar" style="width:0%"></div>
    </div>
    <div class="match-score-block match-live-score-block">
      <div class="match-scoreboard match-live-scoreboard">
        <div class="match-side ${d.left.isPlayer ? 'is-player' : ''}">
          ${renderTeamCrest(d.left, { className: 'match-crest' })}
          <div class="match-side-name">${esc(d.left.name)}</div>
        </div>
        <div class="match-score-center">
          <div class="match-live-clock" id="live-clock">0'</div>
          <div class="result-scoreline live-scoreline">
            <span class="score-digit" id="live-left-score">0</span>
            <span class="score-sep">×</span>
            <span class="score-digit" id="live-right-score">0</span>
          </div>
          <div class="match-score-label" id="live-status">${t('inProgress')}</div>
        </div>
        <div class="match-side">
          ${renderTeamCrest(d.right, { className: 'match-crest away' })}
          <div class="match-side-name">${esc(d.right.name)}</div>
        </div>
      </div>
      <div id="live-goals-mini">${renderGoalsMiniSummary([], t('noGoalsYet'), { left: d.leftEventSide, right: d.rightEventSide })}</div>
    </div>
    <div class="match-live-commentary-feed" id="live-commentary-feed"></div>
  `;
}

function addCommentaryLine(state, text, isGoal = false) {
  state.commentary.unshift({ text, isGoal });
  if (state.commentary.length > MAX_COMMENTARY_LINES) {
    state.commentary.length = MAX_COMMENTARY_LINES;
  }

  const feed = state.container.querySelector('#live-commentary-feed');
  if (!feed) return;

  feed.querySelector('.commentary-line.is-latest')?.classList.remove('is-latest');

  const line = document.createElement('div');
  line.className = `commentary-line is-latest is-entering${isGoal ? ' is-goal' : ''}`;
  line.textContent = text;
  feed.prepend(line);

  line.addEventListener('animationend', () => line.classList.remove('is-entering'), { once: true });

  while (feed.children.length > MAX_COMMENTARY_LINES) {
    feed.lastElementChild.remove();
  }
}

function displayScores(state) {
  const left = state.swapped ? state.awayGoals : state.homeGoals;
  const right = state.swapped ? state.homeGoals : state.awayGoals;
  return { left, right };
}

function goalEventSides(state) {
  return {
    left: state.swapped ? 'away' : 'home',
    right: state.swapped ? 'home' : 'away'
  };
}

function updateLiveDOM(state) {
  const clock = state.container.querySelector('#live-clock');
  const leftScore = state.container.querySelector('#live-left-score');
  const rightScore = state.container.querySelector('#live-right-score');
  const progress = state.container.querySelector('#live-progress-bar');
  const mini = state.container.querySelector('#live-goals-mini');
  const status = state.container.querySelector('#live-status');
  const scores = displayScores(state);

  if (clock) clock.textContent = `${state.currentMin}'`;
  if (leftScore) leftScore.textContent = scores.left;
  if (rightScore) rightScore.textContent = scores.right;
  if (progress) progress.style.width = `${(state.currentMin / 90) * 100}%`;

  if (mini) {
    const sides = goalEventSides(state);
    mini.innerHTML = state.revealed.length
      ? renderGoalsMiniSummary(state.revealed, t('noGoalsYet'), sides)
      : renderGoalsMiniSummary([], t('noGoalsYet'), sides);
  }

  if (status) {
    status.textContent = state.halftime ? t('halftime') : state.currentMin >= 90 ? t('finished') : t('inProgress');
  }
}

function flashGoal(state, team) {
  const onLeft = (team === 'home') !== state.swapped;
  const digitId = onLeft ? '#live-left-score' : '#live-right-score';
  const digit = state.container.querySelector(digitId);
  if (digit) {
    digit.classList.remove('score-pulse');
    void digit.offsetWidth;
    digit.classList.add('score-pulse');
  }
}

function finishLive(state, skipped) {
  if (state.finished) return;
  state.finished = true;
  clearLiveTimer();

  state.homeGoals = state.result.homeGoals;
  state.awayGoals = state.result.awayGoals;
  state.revealed = [...state.result.events];
  state.currentMin = 90;
  addCommentaryLine(state, skipped ? t('fullTimeSkip') : t('fullTime'), false);
  updateLiveDOM(state);

  stopMatchAmbience();

  liveTimer = setTimeout(() => {
    clearLiveTimer();
    const onComplete = state.onComplete;
    liveState = null;
    onComplete?.();
  }, skipped ? 200 : FINISH_DELAY_MS);
}

function scheduleTick(state) {
  clearLiveTimer();
  liveTimer = setTimeout(() => tick(state), TICK_MS);
}

function tick(state) {
  if (state.finished) return;

  state.currentMin++;
  state.halftime = false;

  const goalsNow = state.result.events.filter(e => e.min === state.currentMin);
  if (goalsNow.length) {
    for (const ev of goalsNow) {
      if (ev.type === 'goal') {
        state.revealed.push(ev);
        if (ev.team === 'home') state.homeGoals++;
        else state.awayGoals++;
        addCommentaryLine(state, t('goalCommentary', { min: ev.min, player: ev.player }), true);
        flashGoal(state, ev.team);
        playGoal();
      } else if (ev.type === 'yellow') {
        state.revealed.push(ev);
        addCommentaryLine(state, t('yellowCommentary', { min: ev.min, player: ev.player }), false);
      } else if (ev.type === 'red') {
        state.revealed.push(ev);
        const key = ev.secondYellow ? 'redSecondYellowCommentary' : 'redCommentary';
        addCommentaryLine(state, t(key, { min: ev.min, player: ev.player }), false);
      } else if (ev.type === 'injury') {
        state.revealed.push(ev);
        addCommentaryLine(state, t('injuryCommentary', { min: ev.min, player: ev.player }), false);
      }
    }
  } else if (state.narrationSchedule?.has(state.currentMin)) {
    const text = state.narrationSchedule.get(state.currentMin);
    addCommentaryLine(state, `${state.currentMin}' — ${text}`, false);
  }

  if (state.currentMin === 45) {
    state.halftime = true;
    playHalftime();
    addCommentaryLine(state, t('halftimeShort'), false);
    updateLiveDOM(state);
    clearLiveTimer();
    liveTimer = setTimeout(() => {
      state.halftime = false;
      scheduleTick(state);
    }, HALFTIME_MS);
    return;
  }

  if (state.currentMin >= 90) {
    finishLive(state, false);
    return;
  }

  updateLiveDOM(state);
  scheduleTick(state);
}

export function skipLiveMatch() {
  if (!liveState) return;
  finishLive(liveState, true);
}

export function isLiveMatchRunning() {
  return liveState !== null && !liveState.finished;
}

export function startLiveMatch({ container, home, away, result, round, onComplete }) {
  resetMatchAudio();
  stopLiveMatch();

  container.innerHTML = renderLiveShell(home, away, result, round);
  container.classList.remove('hidden');

  const skipBtn = container.querySelector('#btn-skip-live');
  const state = {
    container,
    home,
    away,
    result,
    round,
    onComplete,
    swapped: !!away.isPlayer,
    currentMin: 0,
    homeGoals: 0,
    awayGoals: 0,
    revealed: [],
    commentary: [],
    narrationSchedule: buildNarrationSchedule(result, round),
    halftime: false,
    finished: false
  };

  liveState = state;

  skipBtn?.addEventListener('click', () => skipLiveMatch());

  playWhistle('start');
  startMatchAmbience();
  addCommentaryLine(state, getNarration().opening[0], false);
  updateLiveDOM(state);

  if (!result.events.length && result.homeGoals === 0 && result.awayGoals === 0) {
    addCommentaryLine(state, t('midfieldStalemate'), false);
    updateLiveDOM(state);
    liveTimer = setTimeout(() => {
      addCommentaryLine(state, t('goallessMatch'), false);
      updateLiveDOM(state);
      liveTimer = setTimeout(() => {
        state.currentMin = 90;
        finishLive(state, false);
      }, 900);
    }, EMPTY_MATCH_MS - 900);
    return;
  }

  liveTimer = setTimeout(() => tick(state), 400);
}

export function stopLiveMatch() {
  clearLiveTimer();
  stopMatchAmbience(true);
  liveState = null;
}

import './viewport-fit.js';
import {
  loadPlayers, loadSerieASquads, loadSerieBSquads, loadSerieCSquads, assertSquadsReady, ensureSquadsReady, calcPrice, formatMoney, roundMoney, autoLineup, teamStrength, getTeamDisplayStrength,
  playerFitsPosition, buildAiSquads, refreshClubSquadForDivision, createStarterSquad, createStarterSquadForTargetStrength,
  weakestTeamStrength, findAiClub, buildPlayerSerieATeams, buildPlayerSerieBTeams, applyChapecoenseRelegationToSerieB,
  CLUB_RELEGATED_A_TO_B, TEAMS_PER_DIVISION,
  FORMATIONS, SLOT_POSITIONS
} from './data.js?v=159';
import {
  initLang, hydrateLangFromStorage, setLang, applyStaticTranslations, syncStartDivisionHint, t, divisionLabel, getPositionLabel, getStatCategoryMeta
} from './i18n.js';
import {
  generateFixtures, getStandings, applyResult, getPlayerNextMatch,
  isSeasonOver, simulateAiMatches, processPromotionRelegation,
  PROMOTION_SPOTS, RELEGATION_SPOTS
} from './league.js';
import { simulateMatch } from './match.js';
import { createEmptySeasonStats, resetSeasonStats, recordMatchToSeasonStats, getStatLeaders } from './season-stats.js';
import {
  finalizeMatch, prepareTeamLineup, ensureSquadDiscipline, ensurePlayerDiscipline, isPlayerAvailable,
  resetSquadDiscipline, getUnavailableCount, getDisciplineStampState, shouldShowSentOffStamp
} from './discipline.js';
import { startLiveMatch, isLiveMatchRunning } from './match-live.js';
import {
  unlockAudio, startMenuAmbience, startGameMusic, resumeAfterMatch, playUiClick, playMatchResult,
  setMusicEnabled, setSfxEnabled, isMusicEnabled, isSfxEnabled
} from './audio.js';
import {
  esc, teamInitials, renderTeamCrest, renderGoalsMiniSummary, renderTeamRoster, renderMatchStats, getMatchDisplayView,
  playerOriginLabel, playerOriginTagKind, renderPlayerShieldHtml, applyPlayerShieldEl
} from './match-ui.js';
import { initPlayerStorage } from './storage.js';
import {
  peekSaveMeta, loadGameSave, clearGameSave, scheduleGameSave, flushGameSave
} from './game-save.js';
import { captureStandingsSnapshot, renderStandingsTable } from './standings-anim.js';
import {
  COPA_FIRST_TURN_ROUNDS, COPA_PHASES, createEmptyHistory, createIdleCopa, initCopaBrasil,
  buildCopaParticipants, getPlayerCopaTie, isPlayerOnCopaBye, simulateCopaAiTies,
  applyLegResult, tryResolveTie, allCurrentLegsPlayed, advanceCopaPhase,
  buildSerieATop3, updateHistoryAfterSeason, getTieDisplay, getLegHomeAway, getPhaseLabelKey, getPhaseShortLabelKey, getPhaseConfig,
  findTeamById
} from './copa-brasil.js';
import {
  calcAcceptChance, calcAcceptChanceBreakdown, getMinOffer, getMaxOffer, stepOffer, clampOffer,
  calcOfferBarFill, getNegotiationPricing, isReputationSensitive, canNegotiateByReputation,
  getNegotiationAttemptsLeft, canSubmitNegotiation, MAX_NEGOTIATION_ATTEMPTS
} from './market-negotiation.js';
import {
  createReinforcementState, ensureReinforcementFields, resetReinforcementSeason,
  evaluateMatchForReinforcement, pickMarketSuggestions, consumePendingForDisplay
} from './reinforcement-suggest.js';
import {
  createClubProfile, recordSeasonEnd, getPopularityTier, formatPopDelta,
  processMatchPopularity, onCopaSeasonStarted, onPlayerCopaPhaseReached,
  onPlayerCopaChampion, resetSeasonPopTracking, ensureClubProfileFields
} from './club-profile.js';
import { buildSeasonEndExtras, mountSeasonEndScreen } from './season-end.js';
import {
  hasSeenTutorial, markTutorialSeen, buildMarketTutorialHtml, buildScoutHelpHtml,
  MARKET_TUTORIAL_ENABLED
} from './tutorial.js';
import {
  ONBOARDING_ENABLED, ONBOARDING_STEPS, TUTORIAL_SIGN_PRICE,
  startOnboarding, ensureOnboarding, isOnboardingActive, isOnboardingComplete, getOnboardingStep,
  getTutorialPlayerId, advanceOnboarding, skipOnboarding, canAccessTab, getAllowedTabForStep,
  pickTutorialTargetPlayer, injectTutorialPlayerIntoPool, grantTutorialBudgetIfNeeded,
  buildOnboardingPopupHtml, getOnboardingOverlayTarget
} from './onboarding.js';
import {
  getPlayerTier, getScoutLevelFromState, getMarketPoolPlayers,
  rotateMarketPool, getTierFilterOptions, playerMatchesTierFilter,
  getScoutReachPlayers, SCOUT_MAX_LEVEL,
  canUpgradeScout, clampScoutLevel
} from './market-scouts.js';
import {
  getPlayerCrestConfig, resetPlayerCrest, savePlayerCrestToStorage
} from './crest-custom.js';
import { buildCrestEditorHtml, bindCrestEditor } from './crest-editor.js';
import {
  WIN_PRIZE, DRAW_PRIZE, getSeasonSponsorship,
  calcLeagueSeasonPrize,
  getCopaReachPrize, copaMilestoneAfterPhase
} from './prizes.js';

const MIN_SQUAD = 18;
const MAX_SQUAD = 25;
const MAX_CLUB_NEWS = 5;
const INITIAL_BUDGET = 5;
const MARKET_PAGE_SIZE = 24;
const MARKET_SORT_DEFAULT = 'budget-first';

function adjustBudget(delta) {
  state.budget = roundMoney(state.budget + delta);
}

const state = {
  allPlayers: [],
  marketPlayers: [],
  marketPage: 0,
  negotiationPlayerId: null,
  negotiationOffer: 0,
  negotiationPhase: 'offer',
  negotiationAttempts: {},
  clubName: '',
  budget: INITIAL_BUDGET,
  squad: [],
  lineup: [],
  formation: '433',
  serieA: { teams: [], fixtures: [], currentRound: 0 },
  serieB: { teams: [], fixtures: [], currentRound: 0 },
  serieC: { teams: [], fixtures: [], currentRound: 0 },
  playerDivision: 2,
  viewingDivision: 2,
  viewingStatsDivision: 2,
  viewingStatCategory: 'goals',
  seasonStats: createEmptySeasonStats(),
  news: [],
  season: 1,
  gameStarted: false,
  selectedSlot: null,
  pendingSeasonEnd: null,
  preMatchStandingsSnapshot: null,
  standingsAnimPending: null,
  history: createEmptyHistory(),
  copaBrasil: createIdleCopa(),
  matchDayType: 'league',
  clubProfile: null,
  reinforcementPrompt: null,
  marketPool: null,
  onboarding: null
};

let playerTeamId = 'player';

function activeLeague() {
  if (state.playerDivision === 1) return state.serieA;
  if (state.playerDivision === 2) return state.serieB;
  return state.serieC;
}

function leagueByDiv(div) {
  if (div === 1) return state.serieA;
  if (div === 2) return state.serieB;
  return state.serieC;
}

function allLeagues() {
  return [state.serieA, state.serieB, state.serieC];
}

function ensureSeasonStats() {
  if (!state.seasonStats) state.seasonStats = createEmptySeasonStats();
  return state.seasonStats;
}

function recordDivisionMatch(division, home, away, result) {
  recordMatchToSeasonStats(ensureSeasonStats(), division, home, away, result);
}

function syncPlayerSquadToClub() {
  ensureSquadDiscipline(state.squad);
  const club = getPlayerClub();
  if (!club) return;
  club.squad = state.squad;
}

function syncLineupPlayerRefs() {
  if (!state.lineup.length || !state.squad.length) return;
  for (const slot of state.lineup) {
    if (!slot?.player?.playerId) continue;
    const squadPlayer = state.squad.find(p => p.playerId === slot.player.playerId);
    if (squadPlayer) slot.player = squadPlayer;
  }
}

function resolveDisplayPlayer(player) {
  if (!player?.playerId) return player;
  return state.squad.find(p => p.playerId === player.playerId) || player;
}

function refreshPlayerLineup() {
  ensureSquadDiscipline(state.squad);
  state.lineup = prepareTeamLineup(
    { squad: state.squad, formation: state.formation },
    state.formation,
    state.lineup,
    { keepUnavailable: true }
  );
  syncPlayerSquadToClub();
}

/** Escalação que entra em campo — troca indisponíveis pelos melhores reservas. */
function getEffectivePlayerLineup() {
  ensureSquadDiscipline(state.squad);
  return prepareTeamLineup(
    { squad: state.squad, formation: state.formation },
    state.formation,
    state.lineup
  );
}

function getEffectivePlayerStrength() {
  return teamStrength(getEffectivePlayerLineup());
}

function cloneLineupForMatch(lineup) {
  return lineup.map(s => ({
    slotPos: s.slotPos,
    player: s.player ? { ...s.player } : null
  }));
}

/** Melhor escalação — só jogadores disponíveis, substitui indisponíveis. */
function applyBestLineup() {
  ensureSquadDiscipline(state.squad);
  state.lineup = prepareTeamLineup(
    { squad: state.squad, formation: state.formation },
    state.formation
  );
  syncPlayerSquadToClub();
}

function addDisciplineNews(items) {
  for (const item of items || []) {
    if (item.type === 'suspension') {
      const key = item.reason === 'accumulation' ? 'newsSuspensionAccum'
        : item.reason === 'secondYellow' ? 'newsSuspensionSecondYellow'
        : 'newsSuspensionRed';
      addNews(t(key, { player: item.player.name }));
    } else if (item.type === 'injury') {
      addNews(t('newsInjury', {
        player: item.player.name,
        games: item.games,
        kind: t(`injuryKind_${item.kind}`)
      }));
    }
  }
}

function renderAvailabilityBadge(player) {
  if (!player) return '';
  ensureSquadDiscipline([player]);
  const d = player.discipline;
  if (d.gamesOut > 0) {
    if (d.outType === 'injured') {
      return `<span class="status-pill injured" title="${t('injured')}">${t('injuredShort', { n: d.gamesOut })}</span>`;
    }
    return `<span class="status-pill suspended" title="${t('suspended')}">${t('suspendedShort', { n: d.gamesOut })}</span>`;
  }
  return '';
}

function ensureLineupStructure() {
  const slots = FORMATIONS[state.formation].slots;
  if (state.lineup.length !== slots.length) {
    refreshPlayerLineup();
    return;
  }
  for (const slot of state.lineup) {
    if (slot.player && !state.squad.find(p => p.playerId === slot.player.playerId)) {
      slot.player = null;
    }
  }
  syncLineupPlayerRefs();
  const hasEmpty = state.lineup.some(s => !s.player);
  if (hasEmpty) refreshPlayerLineup();
}

// ─── DOM refs ───
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const els = {
  loading: $('#loading'),
  screenStart: $('#screen-start'),
  screenGame: $('#screen-game'),
  clubNameInput: $('#club-name'),
  btnStart: $('#btn-start'),
  btnContinue: $('#btn-continue'),
  btnDeleteSave: $('#btn-delete-save'),
  continueSaveSummary: $('#continue-save-summary'),
  resumeCard: $('#resume-card'),
  startForm: $('#start-form'),
  startHint: $('#start-hint'),
  displayClubName: $('#display-club-name'),
  clubShield: $('#club-shield'),
  seasonLabel: $('#season-label'),
  budgetDisplay: $('#budget-display'),
  squadCount: $('#squad-count'),
  leaguePosition: $('#league-position'),
  nextMatchInfo: $('#next-match-info'),
  btnPlayMatch: $('#btn-play-match'),
  avgForce: $('#avg-force'),
  summaryCount: $('#summary-count'),
  legendCount: $('#legend-count'),
  miniStandings: $('#mini-standings'),
  newsFeed: $('#news-feed'),
  formationSelect: $('#formation-select'),
  btnAutoLineup: $('#btn-auto-lineup'),
  pitch: $('#pitch'),
  benchList: $('#bench-list'),
  squadUnavailableHint: $('#squad-unavailable-hint'),
  squadUnavailableText: $('#squad-unavailable-text'),
  btnHighlightUnavailable: $('#btn-highlight-unavailable'),
  benchCount: $('#bench-count'),
  fullSquadList: $('#full-squad-list'),
  leagueTitle: $('#league-title'),
  divisionTabs: $('#division-tabs'),
  marketSearch: $('#market-search'),
  filterPosition: $('#filter-position'),
  filterTier: $('#filter-tier'),
  filterForce: $('#filter-force'),
  filterLegend: $('#filter-legend'),
  filterSort: $('#filter-sort'),
  btnFilter: $('#btn-filter'),
  marketList: $('#market-list'),
  btnPrevPage: $('#btn-prev-page'),
  btnNextPage: $('#btn-next-page'),
  pageInfo: $('#page-info'),
  copaBracket: $('#copa-bracket'),
  copaChampionHero: $('#copa-champion-hero'),
  copaStatusCard: $('#copa-status-card'),
  copaStatus: $('#copa-status'),
  clubPanel: $('#club-panel'),
  upgradesPanel: $('#upgrades-panel'),
  standingsBody: $('#standings-body'),
  standingsTable: $('#standings-table'),
  standingsTableWrapper: $('#standings-table-wrapper'),
  standingsBanner: $('#standings-update-banner'),
  statsTitle: $('#stats-title'),
  statsDivisionTabs: $('#stats-division-tabs'),
  statsCategoryTabs: $('#stats-category-tabs'),
  statsValueHeader: $('#stats-value-header'),
  statsBody: $('#stats-body'),
  fixturesList: $('#fixtures-list'),
  matchPreview: $('#match-preview'),
  matchLive: $('#match-live'),
  matchResult: $('#match-result'),
  modal: $('#modal'),
  modalBody: $('#modal-body'),
  modalClose: $('#modal-close'),
  screenStart: $('#screen-start'),
  btnToggleMusic: $('#btn-toggle-music'),
  btnToggleSfx: $('#btn-toggle-sfx')
};

let audioPrimed = false;

function updateTableScrollShell(shell) {
  const scroller = shell.querySelector('.table-scroller');
  if (!scroller) return;
  const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  const scrollable = maxScroll > 8;
  shell.classList.toggle('is-scrollable', scrollable);
  shell.classList.toggle('at-start', scroller.scrollLeft <= 4);
  shell.classList.toggle('at-end', scroller.scrollLeft >= maxScroll - 4);
  const prev = shell.querySelector('.table-scroll-btn-prev');
  const next = shell.querySelector('.table-scroll-btn-next');
  if (prev) prev.hidden = !scrollable;
  if (next) next.hidden = !scrollable;
}

function initTableScrollShells() {
  document.querySelectorAll('[data-table-scroll]').forEach(shell => {
    if (shell.dataset.scrollBound) return;
    shell.dataset.scrollBound = '1';
    const scroller = shell.querySelector('.table-scroller');
    const prev = shell.querySelector('.table-scroll-btn-prev');
    const next = shell.querySelector('.table-scroll-btn-next');
    if (!scroller || !prev || !next) return;

    prev.setAttribute('aria-label', t('scrollTableLeft'));
    next.setAttribute('aria-label', t('scrollTableRight'));

    const refresh = () => updateTableScrollShell(shell);
    prev.addEventListener('click', () => {
      playUiClick();
      scroller.scrollBy({ left: -Math.max(120, scroller.clientWidth * 0.45), behavior: 'smooth' });
    });
    next.addEventListener('click', () => {
      playUiClick();
      scroller.scrollBy({ left: Math.max(120, scroller.clientWidth * 0.45), behavior: 'smooth' });
    });
    scroller.addEventListener('scroll', refresh, { passive: true });
    window.addEventListener('resize', refresh);
    const ro = new ResizeObserver(refresh);
    ro.observe(scroller);
    const table = scroller.querySelector('table');
    if (table) ro.observe(table);
    refresh();
  });
}

async function primeAudio() {
  if (audioPrimed) return;
  audioPrimed = true;
  await unlockAudio();
  if (!state.gameStarted) startMenuAmbience();
}

// ─── Init ───
initLang();
applyStaticTranslations();

document.getElementById('lang-options')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.lang-option[data-lang]');
  if (!btn) return;
  setLang(btn.dataset.lang);
  applyStaticTranslations();
});

document.getElementById('start-division-options')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.start-division-option[data-division]');
  if (!btn) return;
  document.querySelectorAll('.start-division-option').forEach(opt => {
    opt.classList.toggle('active', opt === btn);
    opt.setAttribute('aria-checked', opt === btn ? 'true' : 'false');
  });
  syncStartDivisionHint(parseInt(btn.dataset.division, 10));
});

async function init() {
  await initPlayerStorage();
  hydrateLangFromStorage();
  resetPlayerCrest();
  applyStaticTranslations();

  try {
    state.allPlayers = await loadPlayers();
    await Promise.all([loadSerieASquads(), loadSerieBSquads(), loadSerieCSquads()]);
    assertSquadsReady();
    els.loading.classList.add('hidden');
  } catch (err) {
    els.loading.querySelector('.loader')?.classList.add('hidden');
    const msg = els.loading.querySelector('p');
    const isFile = location.protocol === 'file:';
    msg.innerHTML = [
      `<strong>${t('loadErrorTitle')}</strong>`,
      err?.message ? `<span class="load-error-detail">${err.message}</span>` : '',
      isFile ? t('loadErrorFile') : '',
      t('loadErrorHint'),
      isFile ? '' : `<span class="load-error-url">${t('loadErrorUrl')}</span>`
    ].filter(Boolean).join('<br>');
    return;
  }

  updateStartScreenSaveUi();

  els.btnContinue?.addEventListener('click', async () => {
    await primeAudio();
    continueGame();
  });

  els.btnDeleteSave?.addEventListener('click', () => {
    if (!peekSaveMeta()) return;
    if (!window.confirm(t('deleteSaveConfirm'))) return;
    clearGameSave();
    resetPlayerCrest();
    updateStartScreenSaveUi();
  });

  els.btnStart.addEventListener('click', async () => {
    try {
      await primeAudio();
      await ensureSquadsReady();
      clearGameSave();
      startGame();
    } catch (err) {
      console.error(err);
      window.alert(err?.message || String(err));
    }
  });
  els.screenStart?.addEventListener('click', () => { primeAudio(); }, { once: true });

  els.btnToggleMusic?.addEventListener('click', async () => {
    await primeAudio();
    const on = !isMusicEnabled();
    setMusicEnabled(on);
    els.btnToggleMusic.classList.toggle('active', on);
    els.btnToggleMusic.setAttribute('aria-pressed', String(on));
    playUiClick();
  });
  els.btnToggleSfx?.addEventListener('click', async () => {
    await primeAudio();
    const on = !isSfxEnabled();
    setSfxEnabled(on);
    els.btnToggleSfx.classList.toggle('active', on);
    els.btnToggleSfx.setAttribute('aria-pressed', String(on));
    playUiClick();
  });

  els.modalClose.addEventListener('click', () => {
    if (isOnboardingActive(state) && els.modal.classList.contains('modal-onboarding')) return;
    playUiClick();
    closeModal();
  });
  els.modal.addEventListener('click', (e) => {
    if (e.target !== els.modal) return;
    if (isOnboardingActive(state) && els.modal.classList.contains('modal-onboarding')) return;
    closeModal();
  });
  els.modalBody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-onboarding-action]');
    if (!btn) return;
    handleOnboardingAction(btn.dataset.onboardingAction);
  });

  document.getElementById('tutorial-overlay')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-onboarding-action]');
    if (!btn) return;
    handleOnboardingAction(btn.dataset.onboardingAction);
  });

  document.getElementById('btn-skip-tutorial')?.addEventListener('click', () => skipTutorial());

  window.addEventListener('resize', () => {
    if (!isOnboardingActive(state)) return;
    if (!getOnboardingOverlayTarget(getOnboardingStep(state), state)) return;
    if (els.modal.classList.contains('hidden')) showTutorialOverlay();
  });

  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (!canAccessTab(state, tab.dataset.tab)) return;
      switchTab(tab.dataset.tab);
    });
  });

  els.formationSelect.addEventListener('change', () => {
    state.formation = els.formationSelect.value;
    refreshPlayerLineup();
    renderSquad();
    updateDashboard();
  });

  els.btnAutoLineup?.addEventListener('click', () => {
    if (isOnboardingActive(state) && getOnboardingStep(state) !== ONBOARDING_STEPS.GO_SQUAD_LINEUP) return;
    applyBestLineup();
    renderSquad();
    updateDashboard();
    addNews(t('newsLineupAuto'));
    if (getOnboardingStep(state) === ONBOARDING_STEPS.GO_SQUAD_LINEUP) {
      hideTutorialOverlay();
      animateTutorialPromotion(() => {
        advanceOnboarding(state, ONBOARDING_STEPS.DONE);
        showOnboardingPopup(ONBOARDING_STEPS.DONE);
        refreshOnboardingUI();
      });
    }
  });

  els.btnHighlightUnavailable?.addEventListener('click', () => {
    playUiClick();
    highlightUnavailablePlayers();
  });

  els.divisionTabs?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-division]');
    if (!btn) return;
    state.viewingDivision = parseInt(btn.dataset.division, 10);
    renderStandingsWithOptionalAnim();
  });

  els.statsDivisionTabs?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-division]');
    if (!btn) return;
    state.viewingStatsDivision = parseInt(btn.dataset.division, 10);
    renderSeasonStats();
  });

  els.statsCategoryTabs?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-stat]');
    if (!btn) return;
    state.viewingStatCategory = btn.dataset.stat;
    renderSeasonStats();
  });

  els.btnFilter.addEventListener('click', () => { state.marketPage = 0; filterMarket(); });
  els.filterSort?.addEventListener('change', () => { state.marketPage = 0; filterMarket(); });
  els.filterTier?.addEventListener('change', () => { state.marketPage = 0; filterMarket(); });
  els.marketSearch.addEventListener('keydown', (e) => { if (e.key === 'Enter') { state.marketPage = 0; filterMarket(); } });
  els.btnPrevPage.addEventListener('click', () => { state.marketPage--; renderMarket(); });
  els.btnNextPage.addEventListener('click', () => { state.marketPage++; renderMarket(); });
  els.btnPlayMatch.addEventListener('click', async () => {
    await primeAudio();
    onDashboardMatchAction();
  });

  document.addEventListener('visibilitychange', () => {
    if (!state.gameStarted) return;
    if (document.hidden) flushGameSave(state);
  });

  window.addEventListener('beforeunload', () => {
    if (state.gameStarted) flushGameSave(state);
  });

  initTableScrollShells();
}

function getSelectedStartDivision() {
  const active = document.querySelector('.start-division-option.active');
  return parseInt(active?.dataset.division || '2', 10);
}

function updateStartScreenSaveUi() {
  const meta = peekSaveMeta();
  const hasSave = !!meta;
  els.resumeCard?.classList.toggle('hidden', !hasSave);
  els.startForm?.classList.toggle('hidden', hasSave);
  els.startHint?.classList.toggle('hidden', hasSave);
  if (hasSave && els.continueSaveSummary) {
    els.continueSaveSummary.textContent = t('continueSaveSummary', {
      season: meta.season,
      div: divisionLabel(meta.division),
      round: meta.round,
      total: meta.totalRounds,
      club: meta.clubName
    });
  }
}

function enterGameScreen({ withOnboarding = false } = {}) {
  startGameMusic();
  playUiClick();

  document.querySelector('.lang-picker')?.classList.add('hidden');
  document.querySelector('.start-division-picker')?.classList.add('hidden');
  els.resumeCard?.classList.add('hidden');
  els.startForm?.classList.add('hidden');
  els.startHint?.classList.add('hidden');
  els.screenStart.classList.remove('active');
  els.screenGame.classList.add('active');
  els.displayClubName.textContent = state.clubName;
  applyPlayerShieldEl(els.clubShield, state.clubName);

  renderAll();
  switchTab('dashboard');

  if (withOnboarding && ONBOARDING_ENABLED) {
    startOnboarding(state);
    state.onboarding.tutorialPlayerId = pickTutorialTargetPlayer(state.allPlayers, getSignedIds());
    queueMicrotask(() => showOnboardingPopup(ONBOARDING_STEPS.WELCOME));
    refreshOnboardingUI();
  } else if (isOnboardingActive(state)) {
    refreshOnboardingUI();
  }
}

function continueGame() {
  if (!loadGameSave(state, state.allPlayers)) return;

  ensureOnboarding(state);
  ensureClubProfile();
  ensureReinforcement();
  ensureSquadDiscipline(state.squad);
  ensureLineupStructure();
  syncPlayerSquadToClub();

  if (els.filterSort) els.filterSort.value = MARKET_SORT_DEFAULT;
  rotateMarketPool(state, { force: true });
  syncMarketTierFilter();
  filterMarket();

  const resumeOnboarding = ONBOARDING_ENABLED && isOnboardingActive(state);
  enterGameScreen({ withOnboarding: false });
  if (resumeOnboarding) refreshOnboardingUI();
  flushGameSave(state);
}

function startGame() {
  const name = els.clubNameInput.value.trim() || t('defaultClubName');
  const startDivision = getSelectedStartDivision();
  const signedIds = new Set();

  resetPlayerCrest();
  state.clubName = name;
  state.budget = INITIAL_BUDGET;
  state.formation = '433';
  state.news = [];
  state.season = 1;
  state.pendingSeasonEnd = null;
  state.gameStarted = true;
  state.playerDivision = startDivision;
  state.viewingDivision = startDivision;
  state.viewingStatsDivision = startDivision;
  state.viewingStatCategory = 'goals';
  state.seasonStats = createEmptySeasonStats();
  state.history = createEmptyHistory();
  state.copaBrasil = createIdleCopa();
  state.matchDayType = 'league';
  state.clubProfile = createClubProfile(startDivision);
  state.clubProfile.seasonStartPop = state.clubProfile.popularity;
  state.reinforcementPrompt = createReinforcementState();
  state.negotiationAttempts = {};

  const allAiA = buildAiSquads(state.allPlayers, TEAMS_PER_DIVISION, signedIds, 'A', 'ai-a');
  const allAiB = buildAiSquads(state.allPlayers, TEAMS_PER_DIVISION, signedIds, 'B', 'ai-b');
  const allAiC = buildAiSquads(state.allPlayers, TEAMS_PER_DIVISION, signedIds, 'C', 'ai-c');

  const aiByDivision = { 1: allAiA, 2: allAiB, 3: allAiC };
  const weakest = weakestTeamStrength(aiByDivision[startDivision] || allAiB);
  state.squad = createStarterSquadForTargetStrength(weakest, state.formation);

  ensureSquadDiscipline(state.squad);
  state.lineup = prepareTeamLineup(
    { squad: state.squad, formation: state.formation },
    state.formation,
    []
  );

  const playerClub = {
    id: playerTeamId,
    name,
    isPlayer: true,
    squad: state.squad,
    formation: state.formation,
    strength: getTeamDisplayStrength({ squad: state.squad, formation: state.formation }),
    division: startDivision,
    stats: { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 }
  };

  if (startDivision === 1) {
    const chapecoense = findAiClub(allAiA, CLUB_RELEGATED_A_TO_B);
    const aTeams = buildPlayerSerieATeams(allAiA, playerClub);
    const bTeams = applyChapecoenseRelegationToSerieB(allAiB, chapecoense);
    state.serieA = {
      teams: aTeams,
      fixtures: generateFixtures(aTeams),
      currentRound: 0
    };
    state.serieB = {
      teams: bTeams,
      fixtures: generateFixtures(bTeams),
      currentRound: 0
    };
    state.serieC = {
      teams: allAiC,
      fixtures: generateFixtures(allAiC),
      currentRound: 0
    };
  } else {
    state.serieA = {
      teams: allAiA,
      fixtures: generateFixtures(allAiA),
      currentRound: 0
    };
    const bTeams = buildPlayerSerieBTeams(allAiB, playerClub);
    state.serieB = {
      teams: bTeams,
      fixtures: generateFixtures(bTeams),
      currentRound: 0
    };
    state.serieC = {
      teams: allAiC,
      fixtures: generateFixtures(allAiC),
      currentRound: 0
    };
  }

  syncPlayerSquadToClub();

  addNews(startDivision === 1 ? t('newsStarterSquadA') : t('newsStarterSquadB'));
  if (els.filterSort) els.filterSort.value = MARKET_SORT_DEFAULT;
  rotateMarketPool(state, { force: true });
  syncMarketTierFilter();
  filterMarket();
  enterGameScreen({ withOnboarding: true });
  flushGameSave(state);
}

function getPlayerClub() {
  return state.serieA.teams.find(t => t.id === playerTeamId) ||
    state.serieB.teams.find(t => t.id === playerTeamId) ||
    state.serieC.teams.find(t => t.id === playerTeamId);
}

function getSignedIds() {
  return new Set(state.squad.map(p => p.playerId));
}

// ─── Onboarding ───
let onboardingMarketTimer = null;
let onboardingHighlightEl = null;
let onboardingScrollLocked = false;

function blockOnboardingScroll(e) {
  if (!isOnboardingActive(state)) return;
  if (els.modal && !els.modal.classList.contains('hidden') && els.modal.contains(e.target)) return;
  if (e.target?.closest?.('.tutorial-highlight, .tutorial-target, .tutorial-skip-btn, #tutorial-overlay, .modal-onboarding')) {
    return;
  }
  const step = getOnboardingStep(state);
  if (e.target?.closest?.('.squad-layout') && [
    ONBOARDING_STEPS.GO_SQUAD_TAB,
    ONBOARDING_STEPS.GO_SQUAD_BENCH,
    ONBOARDING_STEPS.GO_SQUAD_LINEUP
  ].includes(step)) {
    return;
  }
  e.preventDefault();
}

function scrollTutorialTargetIntoView(el) {
  const scrollParent = el.closest('.squad-layout, .tab-scroll-panel.active');
  if (!scrollParent) return;
  const er = el.getBoundingClientRect();
  const sr = scrollParent.getBoundingClientRect();
  const margin = 48;
  if (er.top < sr.top + margin) {
    scrollParent.scrollTop += er.top - sr.top - margin;
  } else if (er.bottom > sr.bottom - margin) {
    scrollParent.scrollTop += er.bottom - sr.bottom + margin;
  }
}

function setOnboardingScrollLock(active) {
  if (active === onboardingScrollLocked) return;
  onboardingScrollLocked = active;
  const opts = { passive: false, capture: true };
  if (active) {
    document.addEventListener('wheel', blockOnboardingScroll, opts);
    document.addEventListener('touchmove', blockOnboardingScroll, opts);
  } else {
    document.removeEventListener('wheel', blockOnboardingScroll, opts);
    document.removeEventListener('touchmove', blockOnboardingScroll, opts);
  }
}

function clearOnboardingHighlight() {
  if (onboardingHighlightEl) {
    onboardingHighlightEl.classList.remove('tutorial-highlight');
    onboardingHighlightEl = null;
  }
}

function showOnboardingPopup(step) {
  const benchStep = step === ONBOARDING_STEPS.GO_SQUAD_BENCH;
  if (!benchStep) {
    clearOnboardingHighlight();
    hideTutorialOverlay();
  }
  els.modal.classList.add('modal-onboarding');
  els.modal.classList.toggle('modal-onboarding-bench', benchStep);
  els.modal.querySelector('.modal-content')?.classList.add('modal-tutorial-wide');
  els.modalBody.innerHTML = buildOnboardingPopupHtml(step, t, esc);
  els.modal.classList.remove('hidden');
}

function clampFixedRect(el, left, top) {
  const margin = 12;
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  const r = el.getBoundingClientRect();
  let dx = 0;
  let dy = 0;
  if (r.left < margin) dx = margin - r.left;
  if (r.right > window.innerWidth - margin) dx = window.innerWidth - margin - r.right;
  if (r.top < margin) dy = margin - r.top;
  if (r.bottom > window.innerHeight - margin) dy = window.innerHeight - margin - r.bottom;
  if (dx || dy) {
    el.style.left = `${left + dx}px`;
    el.style.top = `${top + dy}px`;
  }
}

function positionTutorialOverlayUi(el, target) {
  const pad = target.isTab ? 4 : 10;
  const rect = el.getBoundingClientRect();
  const spotlight = document.getElementById('tutorial-overlay-spotlight');
  const arrow = document.getElementById('tutorial-overlay-arrow');
  const hint = document.getElementById('tutorial-overlay-hint');

  if (spotlight) {
    spotlight.style.visibility = 'visible';
    spotlight.style.left = `${Math.max(4, rect.left - pad)}px`;
    spotlight.style.top = `${Math.max(4, rect.top - pad)}px`;
    spotlight.style.width = `${rect.width + pad * 2}px`;
    spotlight.style.height = `${rect.height + pad * 2}px`;
  }

  if (hint) {
    if (target.spotlightOnly) {
      hint.classList.remove('has-action');
      hint.textContent = '';
      hint.style.display = 'none';
    } else {
      hint.style.display = '';
      const hintText = target.hintKey ? t(target.hintKey) : '';
      if (target.hintAction) {
        hint.classList.add('has-action');
        hint.innerHTML = `
          <span class="tutorial-overlay-hint-text">${hintText}</span>
          <button type="button" class="btn btn-primary btn-sm" data-onboarding-action="${target.hintAction}">${t('onboardingContinue')}</button>`;
      } else {
        hint.classList.remove('has-action');
        hint.textContent = hintText;
      }
      hint.classList.toggle('hint-arrow-right', target.arrow === 'right');
      let left;
      let top;
      let transform;
      if (target.arrow === 'right') {
        left = rect.right + 16;
        top = rect.top + rect.height / 2;
        transform = 'translateY(-50%)';
      } else if (target.arrow === 'up') {
        left = rect.left + rect.width / 2;
        top = rect.top - 12;
        transform = 'translate(-50%, -100%)';
      } else {
        left = rect.left + rect.width / 2;
        top = rect.bottom + 12;
        transform = 'translateX(-50%)';
      }
      hint.style.transform = transform;
      clampFixedRect(hint, left, top);
      replayAnimation(hint);
    }
  }

  if (arrow) {
    arrow.style.display = '';
    if (target.arrow === 'right') {
      arrow.textContent = '→';
      arrow.style.left = `${rect.right + 4}px`;
      arrow.style.top = `${rect.top + rect.height / 2}px`;
      arrow.style.transform = 'translateY(-50%)';
    } else if (target.arrow === 'up') {
      arrow.textContent = '↑';
      arrow.style.left = `${rect.left + rect.width / 2}px`;
      arrow.style.top = `${rect.top - 28}px`;
      arrow.style.transform = 'translateX(-50%)';
    } else {
      arrow.textContent = '↓';
      arrow.style.left = `${rect.left + rect.width / 2}px`;
      arrow.style.top = `${rect.top - 28}px`;
      arrow.style.transform = 'translateX(-50%)';
    }
    replayAnimation(arrow);
  }
}

function showTutorialOverlay(options = {}) {
  const overlay = document.getElementById('tutorial-overlay');
  const step = getOnboardingStep(state);
  const target = getOnboardingOverlayTarget(step, state);
  const allowWithModal = options.allowWithModal || step === ONBOARDING_STEPS.GO_SQUAD_BENCH;
  if (!overlay || !target) return;
  if (!els.modal.classList.contains('hidden') && !allowWithModal) return;

  const mergedTarget = options.spotlightOnly ? { ...target, spotlightOnly: true } : target;

  const tryShow = (attempt = 0) => {
    const el = document.querySelector(mergedTarget.selector);
    if (!el) {
      if (attempt < 24) requestAnimationFrame(() => tryShow(attempt + 1));
      return;
    }

    clearOnboardingHighlight();
    if (!mergedTarget.isTab) {
      el.classList.add('tutorial-highlight');
      onboardingHighlightEl = el;
    }

    scrollTutorialTargetIntoView(el);
    requestAnimationFrame(() => {
      positionTutorialOverlayUi(el, mergedTarget);
      overlay.classList.remove('hidden');
      overlay.setAttribute('aria-hidden', 'false');
    });
  };

  tryShow();
}

function showOnboardingBenchStep() {
  showOnboardingPopup(ONBOARDING_STEPS.GO_SQUAD_BENCH);
  requestAnimationFrame(() => showTutorialOverlay({ spotlightOnly: true, allowWithModal: true }));
}

function handleOnboardingAction(action) {
  playUiClick();
  closeModal();

  if (action === 'ack_director') {
    grantTutorialBudgetIfNeeded(state, addNews, t, formatMoney, adjustBudget);
    advanceOnboarding(state, ONBOARDING_STEPS.GO_MARKET_TAB);
    refreshOnboardingUI();
    return;
  }

  if (action === 'ack_market_popup') {
    advanceOnboarding(state, ONBOARDING_STEPS.GO_UPGRADES);
    refreshOnboardingUI();
    return;
  }

  if (action === 'ack_back_market') {
    advanceOnboarding(state, ONBOARDING_STEPS.GO_MARKET_SIGN_TAB);
    refreshOnboardingUI();
    return;
  }

  if (action === 'ack_squad_bench') {
    hideTutorialOverlay();
    advanceOnboarding(state, ONBOARDING_STEPS.GO_SQUAD_LINEUP);
    refreshOnboardingUI();
    return;
  }

  if (action === 'finish') {
    advanceOnboarding(state, ONBOARDING_STEPS.DONE);
    refreshOnboardingUI();
    renderAll();
    return;
  }
}

function applyTutorialSkipBenefits() {
  const ob = state.onboarding;
  if (!ob) return;

  grantTutorialBudgetIfNeeded(state, addNews, t, formatMoney, adjustBudget);

  if (!ob.scoutUpgraded) {
    const profile = ensureClubProfile();
    const upgrade = canUpgradeScout(profile.scoutLevel, state.budget);
    if (upgrade.ok) {
      adjustBudget(-upgrade.cost);
      profile.scoutLevel = upgrade.next;
      addNews(t('newsScoutUpgraded', { level: upgrade.next }));
    } else if (profile.scoutLevel < SCOUT_MAX_LEVEL) {
      const next = clampScoutLevel(profile.scoutLevel + 1);
      if (next > profile.scoutLevel) {
        profile.scoutLevel = next;
        addNews(t('newsScoutUpgraded', { level: next }));
      }
    }
    ob.scoutUpgraded = true;
    rotateMarketPool(state, { force: true });
    syncMarketTierFilter();
    filterMarket();
  }

  let playerId = getTutorialPlayerId(state);
  if (!playerId) {
    playerId = pickTutorialTargetPlayer(state.allPlayers, getSignedIds());
    if (playerId) ob.tutorialPlayerId = playerId;
  }

  const player = playerId ? state.allPlayers.find(p => p.playerId === playerId) : null;
  const alreadySigned = player && state.squad.some(p => p.playerId === playerId);
  if (player && !alreadySigned && state.squad.length < MAX_SQUAD) {
    if (state.budget < TUTORIAL_SIGN_PRICE) {
      adjustBudget(TUTORIAL_SIGN_PRICE - state.budget);
    }
    completeSign(player, TUTORIAL_SIGN_PRICE);
  }
}

function skipTutorial() {
  if (!isOnboardingActive(state)) return;
  playUiClick();
  if (onboardingMarketTimer) {
    clearTimeout(onboardingMarketTimer);
    onboardingMarketTimer = null;
  }
  clearOnboardingHighlight();
  hideTutorialOverlay();
  closeModal();
  applyTutorialSkipBenefits();
  skipOnboarding(state);
  refreshOnboardingUI();
  renderAll();
}

function replayAnimation(el) {
  if (!el) return;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
}

function animateTutorialPromotion(onDone) {
  const playerId = getTutorialPlayerId(state);
  const slot = playerId
    ? document.querySelector(`.pitch-slot[data-player-id="${CSS.escape(playerId)}"]`)
    : null;

  if (!slot) {
    onDone?.();
    return;
  }

  slot.scrollIntoView?.({ block: 'center', behavior: 'smooth' });

  const burst = document.createElement('div');
  burst.className = 'tutorial-promote-burst';
  burst.textContent = t('onboardingPromotedTag');
  slot.appendChild(burst);

  slot.classList.add('tutorial-promoted');

  setTimeout(() => {
    slot.classList.remove('tutorial-promoted');
    burst.remove();
    onDone?.();
  }, 1500);
}

function hideTutorialOverlay() {
  clearOnboardingHighlight();
  const overlay = document.getElementById('tutorial-overlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
}

function refreshOnboardingUI() {
  const skipBtn = document.getElementById('btn-skip-tutorial');
  if (!isOnboardingActive(state)) {
    document.body.classList.remove('onboarding-active', 'onboarding-step-squad', 'onboarding-step-market');
    hideTutorialOverlay();
    skipBtn?.classList.add('hidden');
    setOnboardingScrollLock(false);
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.remove('tutorial-allowed', 'tutorial-target');
    });
    return;
  }

  skipBtn?.classList.remove('hidden');
  setOnboardingScrollLock(true);
  document.body.classList.add('onboarding-active');
  const step = getOnboardingStep(state);
  const isSquadStep = [
    ONBOARDING_STEPS.GO_SQUAD_TAB,
    ONBOARDING_STEPS.GO_SQUAD_BENCH,
    ONBOARDING_STEPS.GO_SQUAD_LINEUP
  ].includes(step);
  const isMarketStep = [
    ONBOARDING_STEPS.GO_MARKET_TAB,
    ONBOARDING_STEPS.GO_MARKET_SIGN_TAB,
    ONBOARDING_STEPS.SIGN_TARGET,
    ONBOARDING_STEPS.MARKET_BROWSE
  ].includes(step);
  document.body.classList.toggle('onboarding-step-squad', isSquadStep);
  document.body.classList.toggle('onboarding-step-market', isMarketStep);
  const allowedTab = getAllowedTabForStep(step);
  const highlightTab = [
    ONBOARDING_STEPS.GO_MARKET_TAB,
    ONBOARDING_STEPS.GO_UPGRADES,
    ONBOARDING_STEPS.GO_MARKET_SIGN_TAB,
    ONBOARDING_STEPS.GO_SQUAD_TAB
  ].includes(step);

  document.querySelectorAll('.tab').forEach(tab => {
    const isAllowed = canAccessTab(state, tab.dataset.tab);
    const isTarget = highlightTab && tab.dataset.tab === allowedTab;
    tab.classList.toggle('tutorial-allowed', isAllowed);
    tab.classList.toggle('tutorial-target', isTarget);
  });

  if (step === ONBOARDING_STEPS.GO_SQUAD_BENCH) {
    if (els.modal.classList.contains('hidden')) {
      requestAnimationFrame(() => showOnboardingBenchStep());
    } else {
      requestAnimationFrame(() => showTutorialOverlay({ spotlightOnly: true, allowWithModal: true }));
    }
  } else if (getOnboardingOverlayTarget(step, state) && els.modal.classList.contains('hidden')) {
    requestAnimationFrame(() => showTutorialOverlay());
  }
}

function handleOnboardingTabEnter(tabName) {
  if (!isOnboardingActive(state)) return;
  const step = getOnboardingStep(state);

  if (step === ONBOARDING_STEPS.GO_MARKET_TAB && tabName === 'market') {
    hideTutorialOverlay();
    advanceOnboarding(state, ONBOARDING_STEPS.MARKET_BROWSE);
    refreshOnboardingUI();
    if (onboardingMarketTimer) clearTimeout(onboardingMarketTimer);
    onboardingMarketTimer = setTimeout(() => {
      if (getOnboardingStep(state) !== ONBOARDING_STEPS.MARKET_BROWSE) return;
      advanceOnboarding(state, ONBOARDING_STEPS.MARKET_POPUP);
      showOnboardingPopup(ONBOARDING_STEPS.MARKET_POPUP);
      refreshOnboardingUI();
    }, 900);
    return;
  }

  if (step === ONBOARDING_STEPS.GO_UPGRADES && tabName === 'upgrades') {
    hideTutorialOverlay();
    advanceOnboarding(state, ONBOARDING_STEPS.UPGRADE_SCOUT);
    renderUpgrades();
    refreshOnboardingUI();
    return;
  }

  if (step === ONBOARDING_STEPS.GO_MARKET_SIGN_TAB && tabName === 'market') {
    hideTutorialOverlay();
    injectTutorialPlayerIntoPool(state, getTutorialPlayerId(state));
    advanceOnboarding(state, ONBOARDING_STEPS.SIGN_TARGET);
    filterMarket();
    refreshOnboardingUI();
    return;
  }

  if (step === ONBOARDING_STEPS.SIGN_TARGET && tabName === 'market') {
    refreshOnboardingUI();
    return;
  }

  if (step === ONBOARDING_STEPS.GO_SQUAD_TAB && tabName === 'squad') {
    hideTutorialOverlay();
    advanceOnboarding(state, ONBOARDING_STEPS.GO_SQUAD_BENCH);
    renderAll();
    refreshOnboardingUI();
    return;
  }

  if (step === ONBOARDING_STEPS.GO_SQUAD_LINEUP && tabName === 'squad') {
    refreshOnboardingUI();
  }
}

function onTutorialPlayerSigned() {
  hideTutorialOverlay();
  advanceOnboarding(state, ONBOARDING_STEPS.GO_SQUAD_TAB);
  renderAll();
  refreshOnboardingUI();
}

// ─── Market ───
function ensureMarketPool() {
  if (!state.gameStarted || !state.allPlayers.length) return;
  rotateMarketPool(state);
}

function syncMarketTierFilter() {
  if (!els.filterTier) return;
  const scoutLevel = getScoutLevelFromState(state);
  const prev = els.filterTier.value || 'all';
  const options = getTierFilterOptions(scoutLevel);
  els.filterTier.innerHTML = options.map(opt =>
    `<option value="${opt.value}">${t(opt.labelKey)}</option>`
  ).join('');
  const stillValid = options.some(o => o.value === prev);
  els.filterTier.value = stillValid ? prev : 'all';
}

function isPlayerInMarketPool(playerId) {
  return state.marketPool?.playerIds?.includes(playerId) ?? false;
}

function sortMarketPlayers(players, sort) {
  const mode = sort || MARKET_SORT_DEFAULT;
  if (mode === 'price-asc') {
    players.sort((a, b) => calcPrice(a) - calcPrice(b) || a.force - b.force);
  } else if (mode === 'price-desc') {
    players.sort((a, b) => calcPrice(b) - calcPrice(a) || b.force - a.force);
  } else if (mode === 'force') {
    players.sort((a, b) => b.force - a.force);
  } else {
    players.sort((a, b) => {
      const aOk = isPlayerWithinMarketBudget(a) ? 0 : 1;
      const bOk = isPlayerWithinMarketBudget(b) ? 0 : 1;
      if (aOk !== bOk) return aOk - bOk;
      return calcPrice(b) - calcPrice(a) || b.force - a.force;
    });
  }
}

function filterMarket() {
  ensureMarketPool();
  const search = els.marketSearch.value.toLowerCase().trim();
  const pos = els.filterPosition.value;
  const tierFilter = els.filterTier?.value || 'all';
  const minForce = parseInt(els.filterForce.value) || 0;
  const legend = els.filterLegend.value;
  const signed = getSignedIds();
  const poolPlayers = getMarketPoolPlayers(state.allPlayers, state.marketPool);

  state.marketPlayers = poolPlayers.filter(p => {
    if (signed.has(p.playerId)) return false;
    if (!playerMatchesTierFilter(p, tierFilter)) return false;
    if (search && !p.name.toLowerCase().includes(search) && !p.playerId.includes(search)) return false;
    if (pos && !p.positions.includes(pos)) return false;
    if (p.force < minForce) return false;
    if (legend === 'true' && !p.legend) return false;
    if (legend === 'false' && p.legend) return false;
    return true;
  });

  const sort = els.filterSort?.value || MARKET_SORT_DEFAULT;
  if (els.filterSort && !els.filterSort.value) els.filterSort.value = MARKET_SORT_DEFAULT;
  sortMarketPlayers(state.marketPlayers, sort);
  renderMarket();
}

function maybeShowMarketTutorial() {
  if (!MARKET_TUTORIAL_ENABLED) return;
  if (!isOnboardingComplete(state)) return;
  if ((getPlayerClub()?.stats?.played ?? 0) < 1) return;
  if (hasSeenTutorial(state, 'marketIntro')) return;
  showMarketTutorialModal();
}

function showMarketTutorialModal() {
  markTutorialSeen(state, 'marketIntro');
  els.modal.classList.add('modal-tutorial');
  els.modal.querySelector('.modal-content')?.classList.add('modal-tutorial-wide');
  els.modalBody.innerHTML = buildMarketTutorialHtml(t);
  els.modal.classList.remove('hidden');
}

window.closeMarketTutorial = function() {
  playUiClick();
  closeModal();
};

function renderMarket() {
  const isTutorialSign = isOnboardingActive(state)
    && getOnboardingStep(state) === ONBOARDING_STEPS.SIGN_TARGET;
  const tutorialId = isTutorialSign ? getTutorialPlayerId(state) : null;

  let players = state.marketPlayers;
  if (tutorialId) {
    const tutorialPlayer = players.find(p => p.playerId === tutorialId);
    players = tutorialPlayer ? [tutorialPlayer] : [];
    state.marketPage = 0;
  }

  const totalPages = Math.max(1, Math.ceil(players.length / MARKET_PAGE_SIZE));
  state.marketPage = Math.max(0, Math.min(state.marketPage, totalPages - 1));
  const start = state.marketPage * MARKET_PAGE_SIZE;
  const page = players.slice(start, start + MARKET_PAGE_SIZE);

  els.pageInfo.textContent = t('pageInfo', {
    page: state.marketPage + 1,
    total: totalPages,
    count: players.length
  });
  els.btnPrevPage.disabled = state.marketPage === 0;
  els.btnNextPage.disabled = state.marketPage >= totalPages - 1;

  els.marketList.innerHTML = page.map(p => marketCardHtml(p)).join('')
    || `<p class="empty-msg market-empty">${t('marketEmpty')}</p>`;
}

window.signPlayer = function(playerId) {
  openNegotiationModal(playerId);
};

function completeSign(player, price) {
  if (state.squad.some(p => p.playerId === player.playerId)) return;
  if (state.squad.length >= MAX_SQUAD) return;
  if (state.budget < price) return;

  adjustBudget(-price);
  state.squad.push({ ...player });
  ensurePlayerDiscipline(state.squad[state.squad.length - 1]);
  getPlayerClub().squad = state.squad;
  ensureLineupStructure();

  addNews(t('newsSigned', { name: player.name, price: formatMoney(price) }));
  filterMarket();
  renderAll();
}

function clubPopularity() {
  if (!state.clubProfile) return 24;
  ensureClubProfileFields(state.clubProfile);
  return state.clubProfile.popularity;
}

function formatRepEffectPct(repFactor) {
  const pct = Math.round((repFactor - 1) * 100);
  if (pct > 0) return `+${pct}%`;
  if (pct < 0) return `${pct}%`;
  return '0%';
}

function negotiationChanceTierClass(chance) {
  const pct = chance * 100;
  if (pct >= 75) return 'chance-good';
  if (pct >= 40) return 'chance-mid';
  return 'chance-low';
}

function buildNegotiationRepStat(repSensitive, breakdown, pop) {
  if (!repSensitive || breakdown.repFactor === 1) return t('negotiationRepNeutral');
  return t('negotiationRepEffect', {
    pop,
    effect: formatRepEffectPct(breakdown.repFactor)
  });
}

function getPlayerNegotiationPricing(player) {
  return getNegotiationPricing(player, calcPrice(player), clubPopularity());
}

function negotiationAttemptsLeft(playerId) {
  return getNegotiationAttemptsLeft(state.negotiationAttempts, playerId);
}

function recordNegotiationAttempt(playerId) {
  state.negotiationAttempts[playerId] = (state.negotiationAttempts[playerId] ?? 0) + 1;
}

window.openNegotiationModal = function(playerId) {
  const player = state.allPlayers.find(p => p.playerId === playerId);
  if (!player || !isPlayerInMarketPool(playerId)) return;

  if (isOnboardingActive(state)) {
    if (getOnboardingStep(state) !== ONBOARDING_STEPS.SIGN_TARGET) return;
    if (playerId !== getTutorialPlayerId(state)) return;
    if (state.budget < TUTORIAL_SIGN_PRICE || state.squad.length >= MAX_SQUAD) return;
    playUiClick();
    completeSign(player, TUTORIAL_SIGN_PRICE);
    onTutorialPlayerSigned();
    return;
  }

  const pricing = getPlayerNegotiationPricing(player);
  if (!pricing.canNegotiate) return;
  if (!canSubmitNegotiation(state.negotiationAttempts, playerId)) return;

  const minOffer = getMinOffer(pricing.effectiveAsking);
  if (state.squad.length >= MAX_SQUAD || state.budget < minOffer) return;

  playUiClick();
  state.negotiationPlayerId = playerId;
  state.negotiationOffer = clampOffer(pricing.effectiveAsking, pricing.effectiveAsking, state.budget);
  state.negotiationPhase = 'offer';
  renderNegotiationModal();
};

window.adjustNegotiationOffer = function(delta) {
  const player = state.allPlayers.find(p => p.playerId === state.negotiationPlayerId);
  if (!player || state.negotiationPhase !== 'offer') return;

  const asking = getPlayerNegotiationPricing(player).effectiveAsking;
  state.negotiationOffer = stepOffer(state.negotiationOffer, delta, asking, state.budget);
  playUiClick();
  renderNegotiationModal();
};

window.submitNegotiation = function() {
  const player = state.allPlayers.find(p => p.playerId === state.negotiationPlayerId);
  if (!player || state.negotiationPhase !== 'offer') return;

  const pricing = getPlayerNegotiationPricing(player);
  const offer = state.negotiationOffer;
  if (state.budget < offer || state.squad.length >= MAX_SQUAD) return;
  if (!canSubmitNegotiation(state.negotiationAttempts, player.playerId)) return;

  playUiClick();
  recordNegotiationAttempt(player.playerId);
  const pop = clubPopularity();
  const chance = calcAcceptChance(player, offer, pricing.effectiveAsking, pop);
  const accepted = Math.random() < chance;
  const attemptsLeft = negotiationAttemptsLeft(player.playerId);

  state.negotiationPhase = accepted ? 'accepted' : 'rejected';
  renderNegotiationModal();

  if (accepted) {
    completeSign(player, offer);
    setTimeout(() => closeModal(), 1400);
  } else if (attemptsLeft <= 0) {
    addNews(t('newsNegotiationExhausted', { name: player.name }));
    filterMarket();
  } else {
    const repFactor = pricing.repFactor;
    const newsKey = isReputationSensitive(player) && repFactor < 0.72
      ? 'newsNegotiationRejectedReputation'
      : 'newsNegotiationRejected';
    addNews(t(newsKey, { name: player.name, price: formatMoney(offer) }));
  }
};

window.retryNegotiation = function() {
  if (state.negotiationPhase !== 'rejected') return;
  if (!canSubmitNegotiation(state.negotiationAttempts, state.negotiationPlayerId)) return;
  playUiClick();
  state.negotiationPhase = 'offer';
  renderNegotiationModal();
};

function renderNegotiationModal() {
  const player = state.allPlayers.find(p => p.playerId === state.negotiationPlayerId);
  if (!player) return;

  const pricing = getPlayerNegotiationPricing(player);
  const asking = pricing.effectiveAsking;
  const offer = state.negotiationOffer;
  const minOffer = getMinOffer(asking);
  const maxOffer = getMaxOffer(asking, state.budget);
  const pop = clubPopularity();
  const chanceBreakdown = calcAcceptChanceBreakdown(player, offer, asking, pop);
  const chance = chanceBreakdown.final;
  const barFill = calcOfferBarFill(offer, asking, state.budget);
  const primaryPos = player.positions?.[0] || '—';
  const repSensitive = isReputationSensitive(player);

  els.modal.classList.add('modal-negotiation');
  els.modal.querySelector('.modal-content')?.classList.add('modal-negotiation-wide');

  if (state.negotiationPhase === 'accepted') {
    els.modalBody.innerHTML = `
      <div class="negotiation-result negotiation-result-accepted">
        <div class="negotiation-result-icon" aria-hidden="true">✓</div>
        <h3>${t('negotiationAccepted')}</h3>
        <p class="negotiation-result-detail">${esc(player.name)} · ${formatMoney(offer)}</p>
      </div>`;
    els.modal.classList.remove('hidden');
    return;
  }

  if (state.negotiationPhase === 'rejected') {
    const attemptsLeft = negotiationAttemptsLeft(player.playerId);
    const exhausted = attemptsLeft <= 0;
    const rejectHint = exhausted
      ? t('negotiationRejectedExhausted')
      : t('negotiationRejectedSimple');

    els.modalBody.innerHTML = `
      <div class="negotiation-result negotiation-result-rejected">
        <div class="negotiation-result-icon" aria-hidden="true">✕</div>
        <h3>${t('negotiationRejected')}</h3>
        <p class="negotiation-result-detail">${esc(player.name)} · ${formatMoney(offer)}</p>
        <p class="negotiation-result-hint">${rejectHint}</p>
        <div class="negotiation-actions">
          ${exhausted ? '' : `<button type="button" class="btn btn-secondary" onclick="window.retryNegotiation()">${t('negotiationTryAgain')}</button>`}
          <button type="button" class="btn btn-primary" onclick="window.closeNegotiationModal()">${t('negotiationClose')}</button>
        </div>
      </div>`;
    els.modal.classList.remove('hidden');
    return;
  }

  const attemptsLeft = negotiationAttemptsLeft(player.playerId);
  const atMin = offer <= minOffer;
  const atMax = offer >= maxOffer;
  const chancePct = Math.round(chance * 100);
  const chanceClass = negotiationChanceTierClass(chance);
  const repStat = buildNegotiationRepStat(repSensitive, chanceBreakdown, pop);

  const priceRows = repSensitive
    ? `
      <div class="negotiation-price-row">
        <span class="negotiation-price-label">${t('negotiationMarketValue')}</span>
        <span class="negotiation-price-value muted">${formatMoney(pricing.marketPrice)}</span>
      </div>
      <div class="negotiation-price-row">
        <span class="negotiation-price-label">${t('negotiationExpectation')}</span>
        <span class="negotiation-price-value">${formatMoney(asking)}${
          pricing.inflationPct > 0
            ? ` <span class="negotiation-inflation-note">${t('negotiationExpectationNote', { pct: pricing.inflationPct })}</span>`
            : ''
        }</span>
      </div>`
    : `
      <div class="negotiation-price-row">
        <span class="negotiation-price-label">${t('negotiationAsking')}</span>
        <span class="negotiation-price-value muted">${formatMoney(asking)}</span>
      </div>`;

  const lastAttemptWarn = attemptsLeft === 1
    ? `<p class="negotiation-warn">${t('negotiationLastAttemptWarn')}</p>`
    : '';

  els.modalBody.innerHTML = `
    <h3>${t('negotiationTitle')}</h3>
    <div class="negotiation-summary">
      <div class="negotiation-stat">
        <span class="negotiation-stat-label">${t('negotiationStatAttempts')}</span>
        <span class="negotiation-stat-value ${attemptsLeft === 1 ? 'is-warn' : ''}">${attemptsLeft}/${MAX_NEGOTIATION_ATTEMPTS}</span>
      </div>
      <div class="negotiation-stat">
        <span class="negotiation-stat-label">${t('negotiationStatChance')}</span>
        <span class="negotiation-stat-value ${chanceClass}">~${chancePct}%</span>
      </div>
      <div class="negotiation-stat">
        <span class="negotiation-stat-label">${t('negotiationStatReputation')}</span>
        <span class="negotiation-stat-value negotiation-stat-rep">${esc(repStat)}</span>
      </div>
    </div>
    ${lastAttemptWarn}
    <div class="negotiation-player">
      <div class="player-force-ring">${player.force}</div>
      <div class="negotiation-player-info">
        <div class="negotiation-player-name">${esc(player.name)}</div>
        <div class="negotiation-player-meta">${primaryPos} · ${player.positionsStr}</div>
        <div class="player-badges">
          ${renderOriginPill(player)}
          ${player.legend ? `<span class="status-pill legend">${t('legend')}</span>` : ''}
        </div>
      </div>
    </div>
    ${player.legend ? `<p class="negotiation-legend-hint">${t('negotiationLegendHint')}</p>` : ''}
    <div class="negotiation-prices">
      ${priceRows}
      <div class="negotiation-offer-row">
        <span class="negotiation-price-label">${t('negotiationOffer')}</span>
        <div class="negotiation-stepper">
          <button type="button" class="btn btn-secondary btn-icon" ${atMin ? 'disabled' : ''}
            onclick="window.adjustNegotiationOffer(-1)" aria-label="-">−</button>
          <span class="negotiation-offer-value">${formatMoney(offer)}</span>
          <button type="button" class="btn btn-secondary btn-icon" ${atMax ? 'disabled' : ''}
            onclick="window.adjustNegotiationOffer(1)" aria-label="+">+</button>
        </div>
      </div>
    </div>
    <p class="negotiation-offer-range">${t('negotiationOfferRange', {
      min: formatMoney(minOffer),
      max: formatMoney(maxOffer)
    })}</p>
    <div class="negotiation-meter">
      <span class="negotiation-meter-label">${t('negotiationOfferBarLabel', { asking: formatMoney(asking) })}</span>
      <div class="negotiation-chance-bar" role="presentation">
        <div class="negotiation-chance-mid" aria-hidden="true"></div>
        <div class="negotiation-chance-fill negotiation-offer-fill" style="width:${Math.round(barFill)}%"></div>
      </div>
      <div class="negotiation-meter-ticks">
        <span>${formatMoney(minOffer)}</span>
        <span>${formatMoney(asking)}</span>
        <span>${formatMoney(maxOffer)}</span>
      </div>
    </div>
    <div class="negotiation-actions">
      <button type="button" class="btn btn-secondary" onclick="window.closeNegotiationModal()">${t('negotiationCancel')}</button>
      <button type="button" class="btn btn-primary" onclick="window.submitNegotiation()">${t('negotiationSubmitWithChance', { pct: chancePct })}</button>
    </div>`;
  els.modal.classList.remove('hidden');
}

window.closeNegotiationModal = function() {
  playUiClick();
  closeModal();
};

window.releasePlayer = function(playerId) {
  if (isOnboardingActive(state) && playerId === getTutorialPlayerId(state)) return;
  const idx = state.squad.findIndex(p => p.playerId === playerId);
  if (idx === -1) return;
  const player = state.squad[idx];
  const refund = Math.round(calcPrice(player) * 0.5);
  adjustBudget(refund);
  state.squad.splice(idx, 1);
  getPlayerClub().squad = state.squad;
  const wasStarter = state.lineup.some(s => s.player?.playerId === playerId);
  ensureLineupStructure();
  if (wasStarter) refreshPlayerLineup();
  addNews(t('newsReleased', { name: player.name, refund: formatMoney(refund) }));
  filterMarket();
  renderAll();
};

window.promoteToLineup = function(playerId) {
  if (state.selectedSlot === null) return;
  const player = state.squad.find(p => p.playerId === playerId);
  if (!player || !isPlayerAvailable(player)) return;

  const slotIdx = state.selectedSlot;
  const slots = FORMATIONS[state.formation].slots;

  if (state.lineup.length !== slots.length) {
    refreshPlayerLineup();
  }

  const existingIdx = state.lineup.findIndex(s => s.player?.playerId === playerId);
  if (existingIdx !== -1 && existingIdx !== slotIdx) {
    const temp = state.lineup[slotIdx].player;
    state.lineup[slotIdx].player = player;
    state.lineup[existingIdx].player = temp;
  } else {
    state.lineup[slotIdx] = { slotPos: slots[slotIdx], player };
  }

  closeModal();
  renderSquad();
  updateDashboard();
};

function slotCardDisciplineClass(player) {
  const stamp = getDisciplineStampState(resolveDisplayPlayer(player));
  const parts = [];
  if (stamp.sentOff) parts.push('has-sent-off');
  if (stamp.injured) parts.push('has-injured');
  return parts.length ? ` ${parts.join(' ')}` : '';
}

function renderDisciplineStamp(player) {
  const squadPlayer = resolveDisplayPlayer(player);
  const stamp = getDisciplineStampState(squadPlayer);
  const stamps = [];
  if (stamp.sentOff) {
    stamps.push(`<span class="slot-discipline-stamp sent-off" title="${t('sentOffLastMatch')}" aria-label="${t('sentOffLastMatch')}"><span class="slot-red-card"></span></span>`);
  }
  if (stamp.injured) {
    const d = squadPlayer?.discipline;
    const injuryTitle = d?.injuryKind
      ? t('injuredLastMatchKind', { kind: t(`injuryKind_${d.injuryKind}`) })
      : t('injuredLastMatch');
    stamps.push(`<span class="slot-discipline-stamp injured" title="${injuryTitle}" aria-label="${injuryTitle}"><span class="slot-injury-patch"></span></span>`);
  }
  return stamps.join('');
}

function renderPitchSlotTags(player) {
  const parts = [];
  if (player.legend) parts.push('<span class="slot-tag legend">★</span>');
  const origin = playerOriginLabel(player);
  if (origin) {
    parts.push(`<span class="slot-tag ${playerOriginTagKind(player)}">${esc(origin)}</span>`);
  }
  return `<span class="slot-tags">${parts.join('')}</span>`;
}

function clubTagLabel(teamName) {
  const parts = teamName.trim().split(/\s+/);
  if (parts.length >= 2) return teamInitials(teamName);
  return parts[0].slice(0, 3).toUpperCase();
}

function renderPitchClubTag(teamName) {
  if (!teamName) return '<span class="slot-tags" aria-hidden="true"></span>';
  return `<span class="slot-tags"><span class="slot-tag club" title="${esc(teamName)}">${esc(clubTagLabel(teamName))}</span></span>`;
}

function renderOriginPill(player) {
  const origin = playerOriginLabel(player);
  if (!origin) return '';
  return `<span class="status-pill ${playerOriginTagKind(player)}">${esc(origin)}</span>`;
}

// ─── Squad ───
function playerUnavailableClass(player) {
  return !isPlayerAvailable(resolveDisplayPlayer(player)) ? ' is-unavailable' : '';
}

function highlightUnavailablePlayers() {
  switchTab('squad');

  requestAnimationFrame(() => {
    const ids = new Set(
      state.squad.filter(p => !isPlayerAvailable(p)).map(p => p.playerId)
    );
    if (!ids.size) return;

    document.querySelectorAll('.discipline-highlight, .discipline-highlight-slot').forEach(el => {
      el.classList.remove('discipline-highlight', 'discipline-highlight-slot');
    });

    let firstTarget = null;

    for (const id of ids) {
      const safeId = CSS.escape(id);
      const pitchSlot = document.querySelector(`.pitch-slot[data-player-id="${safeId}"]`);
      if (pitchSlot) {
        const card = pitchSlot.querySelector('.slot-card');
        if (card) {
          pitchSlot.classList.add('discipline-highlight-slot');
          card.classList.remove('discipline-highlight');
          void card.offsetWidth;
          card.classList.add('discipline-highlight');
          if (!firstTarget) firstTarget = pitchSlot;
        }
      }

      const benchCard = document.querySelector(`.player-card[data-player-id="${safeId}"]`);
      if (benchCard) {
        benchCard.classList.remove('discipline-highlight');
        void benchCard.offsetWidth;
        benchCard.classList.add('discipline-highlight');
        if (!firstTarget) firstTarget = benchCard;
      }
    }

    firstTarget?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

window.highlightUnavailablePlayers = highlightUnavailablePlayers;

function renderPitchHtml(formation, lineup, { interactive = false, teamName = '' } = {}) {
  const slotPositions = SLOT_POSITIONS[formation];
  const formationLabel = FORMATIONS[formation]?.label || formation;
  const pitchClass = interactive ? 'pitch' : 'pitch modal-pitch';

  return `
    <div class="${pitchClass}">
      <div class="pitch-markings" aria-hidden="true">
        <div class="pitch-center-circle"></div>
        <div class="pitch-box pitch-box-top"></div>
        <div class="pitch-box pitch-box-bottom"></div>
      </div>
      <div class="pitch-formation-tag">${formationLabel}</div>
      ${slotPositions.map((sp, i) => {
        const player = lineup[i]?.player;
        const click = interactive ? ` onclick="window.openSlotModal(${i})"` : '';
        if (player) {
          return `
            <div class="pitch-slot${playerUnavailableClass(player)}" data-player-id="${escAttr(player.playerId)}" style="left:${sp.x}%;top:${sp.y}%"${click}>
              <div class="slot-card${player.legend ? ' is-legend' : ''}${slotCardDisciplineClass(player)}${playerUnavailableClass(player)}">
                <span class="slot-force-badge">${player.force}</span>
                <span class="slot-pos">${sp.pos}</span>
                <span class="slot-name">${esc(player.name)}</span>
                ${interactive ? renderPitchSlotTags(player) : renderPitchClubTag(teamName)}
                ${renderDisciplineStamp(player)}
              </div>
            </div>`;
        }
        if (!interactive) return '';
        return `
          <div class="pitch-slot empty" style="left:${sp.x}%;top:${sp.y}%"${click}>
            <div class="slot-card">
              <span class="slot-pos">${sp.pos}</span>
              <span class="slot-name">${t('scale')}</span>
              <span class="slot-hint">+</span>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

function renderSquad() {
  syncLineupPlayerRefs();
  if (!state.lineup.length && state.squad.length) {
    refreshPlayerLineup();
  } else if (state.lineup.length) {
    state.lineup = prepareTeamLineup(
      { squad: state.squad, formation: state.formation },
      state.formation,
      state.lineup,
      { keepUnavailable: true }
    );
    syncPlayerSquadToClub();
  }

  const unavailable = getUnavailableCount(state.squad);
  if (els.squadUnavailableHint) {
    if (els.squadUnavailableText) {
      els.squadUnavailableText.textContent = unavailable ? t('squadUnavailableHint', { n: unavailable }) : '';
    }
    els.squadUnavailableHint.classList.toggle('is-hidden', !unavailable);
  }
  if (els.btnHighlightUnavailable) {
    els.btnHighlightUnavailable.disabled = !unavailable;
  }

  ensureSquadDiscipline(state.squad);
  els.pitch.innerHTML = renderPitchHtml(state.formation, state.lineup, { interactive: true });

  const lineupIds = new Set(state.lineup.map(s => s.player?.playerId).filter(Boolean));
  const bench = state.squad
    .filter(p => !lineupIds.has(p.playerId))
    .sort((a, b) => b.force - a.force);

  if (els.benchCount) {
    els.benchCount.textContent = bench.length ? t('benchPlayers', { n: bench.length }) : '';
  }

  els.benchList.innerHTML = state.squad.length === 0
    ? `<p class="empty-msg">${t('noSquadPlayers')}</p>`
    : bench.length
      ? bench.map(p => playerCardHtml(p, true, false)).join('')
      : `<p class="empty-msg">${t('allInStartingXi')}</p>`;

  if (els.fullSquadList) {
    const sorted = [...state.squad].sort((a, b) => b.force - a.force);
    els.fullSquadList.innerHTML = sorted.map(p => {
      const isStarter = lineupIds.has(p.playerId);
      return playerCardHtml(p, true, isStarter);
    }).join('');
  }
}

function getMarketAskingPrice(p) {
  const marketPrice = calcPrice(p);
  const pricing = getNegotiationPricing(p, marketPrice, clubPopularity());
  if (isReputationSensitive(p)) {
    if (!pricing.canNegotiate) return Infinity;
    return pricing.effectiveAsking;
  }
  return marketPrice;
}

/** Ordenação "dentro do orçamento" — preço de mercado cabe na verba atual. */
function isPlayerWithinMarketBudget(p) {
  if (!canSubmitNegotiation(state.negotiationAttempts, p.playerId)) return false;
  const asking = getMarketAskingPrice(p);
  if (!Number.isFinite(asking)) return false;
  return state.budget >= asking;
}

function canNegotiateMarketPlayer(p) {
  if (isOnboardingActive(state)) {
    const step = getOnboardingStep(state);
    if (step !== ONBOARDING_STEPS.SIGN_TARGET) return false;
    if (p.playerId !== getTutorialPlayerId(state)) return false;
    if (state.squad.length >= MAX_SQUAD) return false;
    return state.budget >= TUTORIAL_SIGN_PRICE;
  }
  if (state.squad.length >= MAX_SQUAD) return false;
  if (!canSubmitNegotiation(state.negotiationAttempts, p.playerId)) return false;
  const marketPrice = calcPrice(p);
  const pricing = getNegotiationPricing(p, marketPrice, clubPopularity());
  if (isReputationSensitive(p) && !pricing.canNegotiate) return false;
  const minOffer = getMinOffer(isReputationSensitive(p) ? pricing.effectiveAsking : marketPrice);
  return state.budget >= minOffer;
}

function marketCardHtml(p) {
  const marketPrice = calcPrice(p);
  const isTutorialPick = getOnboardingStep(state) === ONBOARDING_STEPS.SIGN_TARGET
    && p.playerId === getTutorialPlayerId(state);
  const displayPrice = isTutorialPick ? TUTORIAL_SIGN_PRICE : marketPrice;
  const pricing = getPlayerNegotiationPricing(p);
  const blockedByRep = isReputationSensitive(p) && !pricing.canNegotiate;
  const attemptsExhausted = !canSubmitNegotiation(state.negotiationAttempts, p.playerId);
  const canNegotiate = canNegotiateMarketPlayer(p);
  const minOffer = getMinOffer(isReputationSensitive(p) ? pricing.effectiveAsking : marketPrice);
  const primaryPos = p.positions?.[0] || '—';
  let buyLabel = t('negotiate');
  if (state.squad.length >= MAX_SQUAD) buyLabel = t('squadFull');
  else if (attemptsExhausted) buyLabel = t('marketAttemptsExhausted');
  else if (blockedByRep) buyLabel = t('marketRepBlockedBtn');
  else if (state.budget < minOffer) buyLabel = t('noBudget');

  const repBadge = isReputationSensitive(p) && pricing.repStatus !== 'none'
    ? `<span class="market-rep-badge market-rep-${pricing.repStatus}" title="${
      blockedByRep ? t('marketRepBlockedHint', { min: pricing.minPop }) : ''
    }">${t(`marketRep${pricing.repStatus.charAt(0).toUpperCase()}${pricing.repStatus.slice(1)}`)}</span>`
    : '';
  const tier = getPlayerTier(p);
  const tierBadge = `<span class="market-tier-badge market-tier-${tier.toLowerCase()}" title="${t('marketTierLabel')}">${tier}</span>`;

  return `
    <div class="market-card player-card ${p.legend ? 'is-legend' : ''}${isReputationSensitive(p) ? ' is-rep-sensitive' : ''}${isTutorialPick ? ' is-tutorial-pick' : ''}">
      <div class="player-card-body">
        <div class="player-force-ring">${p.force}</div>
        <div class="player-card-main">
          <div class="player-card-topline">
            <span class="player-pos-chip">${primaryPos}</span>
            <span class="player-name">${esc(p.name)}</span>
            ${tierBadge}
            ${repBadge}
          </div>
          <div class="player-meta">${p.positionsStr}</div>
          <div class="player-badges">
            ${renderOriginPill(p)}
            ${p.legend ? `<span class="status-pill legend">${t('legend')}</span>` : ''}
          </div>
          ${blockedByRep ? `<p class="market-rep-blocked-hint">${t('marketRepBlockedHint', { min: pricing.minPop })}</p>` : ''}
          ${attemptsExhausted ? `<p class="market-attempts-exhausted-hint">${t('negotiationRejectedExhausted')}</p>` : ''}
          ${isTutorialPick ? `<p class="market-tutorial-pick">${t('onboardingTutorialPick')}</p>` : ''}
        </div>
      </div>
      <div class="market-card-footer">
        <span class="market-price">${formatMoney(displayPrice)}</span>
        <button class="btn btn-primary btn-sm" ${canNegotiate ? '' : 'disabled'}
          onclick="window.openNegotiationModal('${escAttr(p.playerId)}')">${buyLabel}</button>
      </div>
    </div>`;
}

function isTutorialPlayerReleaseBlocked(playerId) {
  if (!isOnboardingActive(state)) return false;
  const step = getOnboardingStep(state);
  if (step !== ONBOARDING_STEPS.GO_SQUAD_BENCH && step !== ONBOARDING_STEPS.GO_SQUAD_LINEUP) return false;
  return playerId === getTutorialPlayerId(state);
}

function playerCardHtml(p, showRelease, isStarter = false) {
  const primaryPos = p.positions?.[0] || '—';
  const badges = [
    isStarter ? `<span class="status-pill starter">${t('starter')}</span>` : `<span class="status-pill bench">${t('reserve')}</span>`,
    renderAvailabilityBadge(p),
    renderOriginPill(p),
    p.legend ? `<span class="status-pill legend">${t('legend')}</span>` : ''
  ].filter(Boolean).join('');

  return `
    <div class="player-card ${isStarter ? 'is-starter' : 'is-bench'}${p.legend ? ' is-legend' : ''}${slotCardDisciplineClass(p)}${playerUnavailableClass(p)}" data-player-id="${escAttr(p.playerId)}">
      <div class="player-card-body">
        <div class="player-force-ring">${p.force}</div>
        <div class="player-card-main">
          <div class="player-card-topline">
            <span class="player-pos-chip">${primaryPos}</span>
            <span class="player-name">${esc(p.name)}</span>
          </div>
          <div class="player-meta">${p.positionsStr}</div>
          <div class="player-badges">${badges}</div>
        </div>
        ${renderDisciplineStamp(p)}
      </div>
      ${showRelease ? `
      <div class="player-actions">
        <button class="btn btn-danger btn-sm"${isTutorialPlayerReleaseBlocked(p.playerId) ? ' disabled' : ''}
          onclick="window.releasePlayer('${escAttr(p.playerId)}')">${t('release')}</button>
      </div>` : ''}
    </div>`;
}

function escAttr(str) {
  return String(str).replace(/'/g, "\\'");
}

function playerSilhouetteHtml(slotPos) {
  const cls = slotPos === 'GOL' ? 'goalkeeper-silhouette-mask' : 'player-silhouette-mask';
  return `<div class="${cls}" aria-hidden="true"></div>`;
}

function renderEquippedSlotCard(player, slotPos) {
  if (!player) {
    return `
      <div class="equipped-player-card equipped-player-empty">
        <div class="equipped-player-visual">${playerSilhouetteHtml(slotPos)}</div>
        <p class="equipped-player-label">${t('emptyPosition')}</p>
        <p class="equipped-player-hint">${getPositionLabel(slotPos)}</p>
      </div>`;
  }

  const badges = [
    player.legend ? `<span class="status-pill legend">${t('legend')}</span>` : '',
    renderAvailabilityBadge(player),
    renderOriginPill(player),
    player.positions.includes(slotPos)
      ? `<span class="status-pill starter">${t('naturalPosition')}</span>`
      : `<span class="status-pill bench">${t('adaptedPosition')}</span>`
  ].filter(Boolean).join('');

  return `
    <div class="equipped-player-card">
      <div class="equipped-player-head">
        <span class="equipped-player-badge">${t('onPitch')}</span>
        <span class="equipped-player-force">${player.force}</span>
      </div>
      <div class="equipped-player-visual">${playerSilhouetteHtml(slotPos)}</div>
      <h4 class="equipped-player-name">${esc(player.name)}</h4>
      <p class="equipped-player-slot">${getPositionLabel(slotPos)} · ${slotPos}</p>
      <p class="equipped-player-positions">${player.positionsStr}</p>
      ${player.generic ? '' : `<p class="equipped-player-meta">${player.sel} · ${t('cups', { n: player.copa })}</p>`}
      <div class="equipped-player-badges">${badges}</div>
    </div>`;
}

window.openSlotModal = function(slotIdx) {
  state.selectedSlot = slotIdx;
  const slotPos = FORMATIONS[state.formation].slots[slotIdx];
  const currentPlayer = state.lineup[slotIdx]?.player || null;
  const lineupIds = new Set(state.lineup.map(s => s.player?.playerId).filter(Boolean));
  const candidates = state.squad
    .filter(p => playerFitsPosition(p, slotPos))
    .filter(p => !lineupIds.has(p.playerId))
    .filter(p => isPlayerAvailable(p))
    .sort((a, b) => {
      const aExact = a.positions.includes(slotPos) ? 1 : 0;
      const bExact = b.positions.includes(slotPos) ? 1 : 0;
      return (bExact - aExact) || (b.force - a.force);
    });

  els.modal.classList.add('modal-lineup-picker');
  els.modal.querySelector('.modal-content')?.classList.add('modal-lineup-wide');

  els.modalBody.innerHTML = `
    <h3>${t('choosePosition', { pos: getPositionLabel(slotPos) })}</h3>
    <div class="modal-lineup-layout">
      <div class="modal-lineup-candidates">
        <p class="modal-lineup-subtitle">${t('availableSubs')}</p>
        <div class="modal-player-list">
          ${candidates.map(p => `
            <div class="modal-player-option" onclick="window.promoteToLineup('${escAttr(p.playerId)}')">
              <div>
                <strong>${esc(p.name)}</strong>
                <div style="font-size:0.75rem;color:var(--text-muted)">${p.positionsStr} · ${p.force}</div>
              </div>
              ${p.positions.includes(slotPos) ? `<span style="color:var(--primary);font-size:0.75rem">${t('naturalPosition')}</span>` : ''}
            </div>`).join('') || `<p class="empty-msg">${t('noPlayerForPosition')}</p>`}
        </div>
      </div>
      <aside class="modal-lineup-equipped">
        <p class="modal-lineup-subtitle">${t('currentStarter')}</p>
        ${renderEquippedSlotCard(currentPlayer, slotPos)}
      </aside>
    </div>`;
  els.modal.classList.remove('hidden');
};

function closeModal() {
  els.modal.classList.add('hidden');
  els.modal.classList.remove('modal-lineup-picker', 'modal-squad-view', 'modal-negotiation', 'modal-reinforcement', 'modal-crest', 'modal-tutorial', 'modal-scout-help', 'modal-onboarding', 'modal-onboarding-bench');
  const content = els.modal.querySelector('.modal-content');
  content?.classList.remove('modal-lineup-wide', 'modal-squad-wide', 'modal-negotiation-wide', 'modal-reinforcement-wide', 'modal-crest-wide', 'modal-tutorial-wide', 'modal-scout-help-wide');
  state.selectedSlot = null;
  state.negotiationPlayerId = null;
  state.negotiationPhase = 'offer';
}

function openCrestEditorModal() {
  playUiClick();
  const config = getPlayerCrestConfig();
  els.modal.classList.add('modal-crest');
  els.modal.querySelector('.modal-content')?.classList.add('modal-crest-wide');
  els.modalBody.innerHTML = buildCrestEditorHtml(config, state.clubName);
  els.modal.classList.remove('hidden');

  bindCrestEditor(els.modalBody.querySelector('[data-crest-editor]'), {
    clubName: state.clubName,
    initialConfig: config,
    onSave: (draft) => {
      savePlayerCrestToStorage(draft);
      scheduleGameSave(state);
      applyPlayerShieldEl(els.clubShield, state.clubName);
      renderClub();
      renderAll();
      closeModal();
    },
    onCancel: () => closeModal()
  });
}

window.openCrestEditor = openCrestEditorModal;

// ─── League ───
function snapshotDivision(division) {
  return captureStandingsSnapshot(getStandings(leagueByDiv(division).teams));
}

function renderStandings({ animate = false } = {}) {
  const div = state.viewingDivision;
  const standings = getStandings(leagueByDiv(div).teams);
  const oldSnapshot = animate ? state.preMatchStandingsSnapshot?.[div] : null;

  if (els.leagueTitle) {
    els.leagueTitle.textContent = `${divisionLabel(div)} — ${t('roundRobin')}`;
  }
  if (els.divisionTabs) {
    els.divisionTabs.querySelectorAll('[data-division]').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.division, 10) === div);
    });
  }

  renderStandingsTable({
    tbody: els.standingsBody,
    table: els.standingsTable,
    wrapper: els.standingsTableWrapper,
    banner: els.standingsBanner,
    standings,
    viewingDivision: div,
    oldSnapshot,
    animate: !!(animate && oldSnapshot)
  });

  const standingsShell = els.standingsTableWrapper?.closest('[data-table-scroll]');
  if (standingsShell) updateTableScrollShell(standingsShell);
}

function renderStandingsWithOptionalAnim() {
  const div = state.viewingDivision;
  const shouldAnim = state.standingsAnimPending?.[div] && state.preMatchStandingsSnapshot?.[div];
  renderStandings({ animate: !!shouldAnim });
  if (shouldAnim && state.standingsAnimPending) {
    state.standingsAnimPending[div] = false;
  }
}

function tryAnimateStandingsAfterMatch() {
  const div = state.viewingDivision;
  if (!state.standingsAnimPending?.[div] || !state.preMatchStandingsSnapshot?.[div]) return;
  if (!document.getElementById('tab-league')?.classList.contains('active')) return;
  requestAnimationFrame(() => {
    renderStandings({ animate: true });
    state.standingsAnimPending[div] = false;
  });
}

function renderSeasonStats() {
  if (!els.statsBody) return;

  const div = state.viewingStatsDivision;
  const stat = state.viewingStatCategory;
  const meta = getStatCategoryMeta(stat);
  const store = ensureSeasonStats();
  const leaders = getStatLeaders(store, div, stat);
  let emptyLabel = meta.empty;
  if (!leaders.length && state.gameStarted) {
    const otherDiv = [1, 2, 3].find(d => d !== div && getStatLeaders(store, d, stat).length);
    if (otherDiv) {
      emptyLabel = t('statNoRecordsInDiv', { div: divisionLabel(div), otherDiv: divisionLabel(otherDiv) });
    }
  }

  if (els.statsTitle) {
    els.statsTitle.textContent = `${divisionLabel(div)} — ${meta.tab}`;
  }
  if (els.statsDivisionTabs) {
    els.statsDivisionTabs.querySelectorAll('[data-division]').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.division, 10) === div);
    });
  }
  if (els.statsCategoryTabs) {
    els.statsCategoryTabs.querySelectorAll('[data-stat]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.stat === stat);
    });
  }
  if (els.statsValueHeader) {
    els.statsValueHeader.textContent = meta.column;
  }

  const playerClub = getPlayerClub();
  els.statsBody.innerHTML = leaders.length
    ? leaders.map((row, i) => {
      const isPlayerClub = playerClub && row.teamId === playerClub.id;
      return `
        <tr class="${isPlayerClub ? 'is-player' : ''}">
          <td>${i + 1}</td>
          <td><strong>${esc(row.name)}</strong></td>
          <td>${esc(row.teamName)}</td>
          <td><strong>${row[stat]}</strong></td>
        </tr>`;
    }).join('')
    : `<tr><td colspan="4" class="empty-row">${emptyLabel}</td></tr>`;
}

window.viewTeamSquad = function(teamId) {
  const team = state.serieA.teams.find(t => t.id === teamId) ||
    state.serieB.teams.find(t => t.id === teamId) ||
    state.serieC.teams.find(t => t.id === teamId);
  if (!team) return;

  const formation = team.formation || '433';
  const lineup = prepareTeamLineup(team, formation);
  const lineupIds = new Set(lineup.map(s => s.player?.playerId).filter(Boolean));
  const bench = [...team.squad]
    .filter(p => !lineupIds.has(p.playerId))
    .sort((a, b) => b.force - a.force);
  const str = getTeamDisplayStrength(team) || '—';
  const formationLabel = FORMATIONS[formation]?.label || formation;

  els.modal.classList.add('modal-squad-view');
  els.modal.querySelector('.modal-content')?.classList.add('modal-squad-wide');

  els.modalBody.innerHTML = `
    <div class="modal-squad-header">
      ${renderTeamCrest(team, { className: 'modal-squad-crest' })}
      <div class="modal-squad-head-text">
        <h3>${esc(team.name)}</h3>
        <p class="modal-squad-meta">
          ${divisionLabel(team.division || 1)} · ${formationLabel} · ${t('strength')} ${str} · ${t('playersCount', { n: team.squad.length })}
        </p>
      </div>
    </div>

    <div class="modal-squad-layout">
      <section class="modal-squad-pitch-col">
        <p class="modal-lineup-subtitle">${t('startingLineup')}</p>
        <div class="modal-pitch-fit">
          ${renderPitchHtml(formation, lineup, { teamName: team.name })}
        </div>
      </section>

      <section class="modal-squad-bench-col">
        <p class="modal-lineup-subtitle">${t('bench')}${bench.length ? ` (${bench.length})` : ''}</p>
        <div class="modal-bench-list">
          ${bench.length ? bench.map(p => `
            <div class="modal-bench-item">
              <span class="modal-bench-force">${p.force}</span>
              <div class="modal-bench-info">
                <strong>${esc(p.name)}</strong>
                <span>${p.positionsStr || p.positions?.join('/')}${p.legend ? ' · ★' : ''}</span>
              </div>
            </div>`).join('') : `<p class="empty-msg">${t('noReserves')}</p>`}
        </div>
      </section>
    </div>`;
  els.modal.classList.remove('hidden');
};

function renderFixtures() {
  const lg = activeLeague();
  const teamMap = Object.fromEntries(lg.teams.map(t => [t.id, t.name]));
  const items = lg.fixtures.map((round, ri) => {
    const playerMatch = round.find(m => m.home === playerTeamId || m.away === playerTeamId);
    if (!playerMatch) return '';
    const isHome = playerMatch.home === playerTeamId;
    const isCurrent = ri === lg.currentRound;
    const isPlayed = playerMatch.played;
    const home = teamMap[playerMatch.home];
    const away = teamMap[playerMatch.away];
    const score = isPlayed ? `${playerMatch.homeGoals}–${playerMatch.awayGoals}` : '×';
    const resultClass = isPlayed
      ? (isHome
        ? (playerMatch.homeGoals > playerMatch.awayGoals ? 'win' : playerMatch.homeGoals < playerMatch.awayGoals ? 'loss' : 'draw')
        : (playerMatch.awayGoals > playerMatch.homeGoals ? 'win' : playerMatch.awayGoals < playerMatch.homeGoals ? 'loss' : 'draw'))
      : '';
    const resultLabel = resultClass === 'win' ? t('winShort') : resultClass === 'loss' ? t('lossShort') : resultClass === 'draw' ? t('drawShort') : '';
    return `
      <article class="fixture-card ${isPlayed ? 'played' : ''} ${isCurrent ? 'current' : ''} ${resultClass}">
        <div class="fixture-card-rail">
          <span class="fixture-round-badge">R${ri + 1}</span>
          ${isPlayed ? `<span class="fixture-result-pip ${resultClass}" title="${resultClass === 'win' ? t('win') : resultClass === 'loss' ? t('loss') : t('draw')}">${resultLabel}</span>` : '<span class="fixture-result-pip pending">·</span>'}
        </div>
        <div class="fixture-card-body">
          <div class="fixture-matchup">
            <span class="fixture-club fixture-home ${isHome ? 'is-you' : ''}">${esc(home)}</span>
            <span class="fixture-score-box">${score}</span>
            <span class="fixture-club fixture-away ${!isHome ? 'is-you' : ''}">${esc(away)}</span>
          </div>
          <div class="fixture-meta">
            <span class="fixture-venue ${isHome ? 'home' : 'away'}">${isHome ? t('home') : t('away')}</span>
            ${isCurrent && !isPlayed ? `<span class="fixture-badge">${t('next')}</span>` : ''}
          </div>
        </div>
      </article>`;
  }).filter(Boolean);

  const countEl = $('#fixtures-count');
  if (countEl) countEl.textContent = t('games', { n: items.length });

  els.fixturesList.innerHTML = items.join('');
}

function renderMiniStandings() {
  const standings = getStandings(activeLeague().teams).slice(0, 5);
  els.miniStandings.innerHTML = standings.map((team, i) => `
    <div class="mini-standing-row ${team.isPlayer ? 'is-player' : ''} ${i < 3 ? `rank-${i + 1}` : ''}">
      <span class="mini-pos">${i + 1}</span>
      <span class="mini-club">${esc(team.name)}</span>
      <span class="mini-pts">${team.stats.points}<small>${t('pts')}</small></span>
    </div>`).join('');
}

// ─── Copa do Brasil ───
function getCopaParticipants() {
  return buildCopaParticipants(state.serieA, state.serieB, state.serieC);
}

function isCopaActive() {
  const phase = state.copaBrasil?.phase;
  return phase && phase !== 'idle' && phase !== 'finished';
}

function isCopaMatchDay() {
  return isCopaActive()
    && state.matchDayType === 'copa'
    && activeLeague().currentRound >= COPA_FIRST_TURN_ROUNDS;
}

function maybeStartCopaAfterFirstTurn() {
  const lg = activeLeague();
  if (lg.currentRound < COPA_FIRST_TURN_ROUNDS) return;
  if (state.copaBrasil.phase !== 'idle') return;

  state.copaBrasil = initCopaBrasil(
    state.serieA, state.serieB, state.serieC, state.history, state.season
  );
  state.matchDayType = 'copa';
  const byeNames = state.copaBrasil.byeTeams
    .map(id => findTeamById(getCopaParticipants(), id)?.name)
    .filter(Boolean)
    .join(', ');
  addNews(t('newsCopaStarted', { byes: byeNames }), 'copa');
  notifyPopularityChange(onCopaSeasonStarted(ensureClubProfile(), state.season));
}

function settleCopaPrize(copa) {
  if (!copa || copa.copaPrizePaid || !getPlayerClub()?.isPlayer) return 0;
  const prize = getCopaReachPrize(copa.playerBestReach);
  if (prize <= 0) return 0;
  copa.copaPrizePaid = true;
  adjustBudget(prize);
  return prize;
}

function checkPlayerCopaElimination() {
  const copa = state.copaBrasil;
  if (copa.playerEliminated) return;
  const playerTie = copa.ties.find(t =>
    (t.home === playerTeamId || t.away === playerTeamId) && t.winnerId
  );
  if (playerTie && playerTie.winnerId !== playerTeamId) {
    copa.playerEliminated = true;
    const prize = settleCopaPrize(copa);
    addNews(t('newsCopaEliminated', {
      prize: prize > 0 ? formatMoney(prize) : t('prizeNone')
    }), 'copa');
  }
}

function finishCopaEvent() {
  const copa = state.copaBrasil;
  const participants = getCopaParticipants();
  const config = getPhaseConfig(copa.phase);
  const singleLeg = config?.legs === 1;

  for (const tie of copa.ties) {
    if (!tie.winnerId) tryResolveTie(tie, participants, singleLeg);
  }

  checkPlayerCopaElimination();

  const phaseBefore = copa.phase;
  const allResolved = copa.ties.length > 0 && copa.ties.every(t => t.winnerId);

  if (allResolved) {
    const playerWonPhase = (phaseBefore === 'phase1' && copa.byeTeams.includes(playerTeamId))
      || copa.ties.some(t => t.winnerId === playerTeamId);
    if (playerWonPhase && getPlayerClub()?.isPlayer) {
      const milestone = copaMilestoneAfterPhase(phaseBefore);
      if (milestone) copa.playerBestReach = milestone;
      if (phaseBefore !== 'final') {
        addNews(t('newsCopaAdvanced', {
          phase: t(getPhaseLabelKey(phaseBefore))
        }), 'copa');
      }
    }

    advanceCopaPhase(copa, participants, state.season);
    if (playerWonPhase) {
      const milestonePhase = copa.phase;
      if (milestonePhase === 'finished' && copa.championId === playerTeamId) {
        notifyPopularityChange(onPlayerCopaChampion(ensureClubProfile()));
      } else if (['round16', 'quarter', 'semi', 'final'].includes(milestonePhase)) {
        notifyPopularityChange(onPlayerCopaPhaseReached(ensureClubProfile(), milestonePhase));
      }
    }
    if (copa.phase === 'finished' && copa.championId) {
      if (copa.championId === playerTeamId) {
        copa.playerBestReach = 'champion';
        const prize = settleCopaPrize(copa);
        addNews(t('newsCopaChampion', {
          club: state.clubName,
          prize: formatMoney(prize)
        }), 'copa');
      } else {
        addNews(t('newsCopaChampionOther', { champion: copa.championName }), 'copa');
      }
      state.matchDayType = 'league';
      return;
    }
    copa.currentLeg = 1;
  } else if (!singleLeg && copa.currentLeg === 1 && allCurrentLegsPlayed(copa, 0)) {
    copa.currentLeg = 2;
  }

  state.matchDayType = 'league';
}

function runCopaAiSimulation(skipPlayer = true) {
  const copa = state.copaBrasil;
  const participants = getCopaParticipants();
  const config = getPhaseConfig(copa.phase);
  const legIdx = copa.currentLeg - 1;
  const singleLeg = config?.legs === 1;

  simulateCopaAiTies(copa, participants, simulateMatch, {
    skipTeamId: skipPlayer ? playerTeamId : null,
    legIdx,
    singleLeg,
    finalizeOptions: {
      seasonStats: ensureSeasonStats(),
      division: state.playerDivision,
      isCopa: true,
      playerTeamId
    }
  });
}

function playCopaMatchWithoutPlayer() {
  runCopaAiSimulation(true);
  finishCopaEvent();
  renderAll();
}

function playCopaMatch() {
  if (!canPlayMatch()) return;

  const copa = state.copaBrasil;
  const participants = getCopaParticipants();
  const config = getPhaseConfig(copa.phase);
  const legIdx = copa.currentLeg - 1;
  const singleLeg = config?.legs === 1;

  if (isPlayerOnCopaBye(copa, playerTeamId)) {
    runCopaAiSimulation(true);
    addNews(t('newsCopaBye'), 'copa');
    finishCopaEvent();
    renderAll();
    return;
  }

  if (copa.playerEliminated) {
    playCopaMatchWithoutPlayer();
    return;
  }

  const tie = getPlayerCopaTie(copa, playerTeamId);
  if (!tie) {
    playCopaMatchWithoutPlayer();
    return;
  }

  runCopaAiSimulation(true);

  const matchup = getLegHomeAway(tie, legIdx, participants);
  if (!matchup || matchup.leg.played) return;
  const { home: homeTeam, away: awayTeam } = matchup;

  const isHome = homeTeam.id === playerTeamId;
  refreshPlayerLineup();
  const playerLineup = cloneLineupForMatch(getEffectivePlayerLineup());
  const hLineup = isHome ? playerLineup : prepareTeamLineup(homeTeam, homeTeam.formation || '433');
  const aLineup = !isHome ? playerLineup : prepareTeamLineup(awayTeam, awayTeam.formation || '433');

  const result = simulateMatch(homeTeam, awayTeam, hLineup, aLineup);
  const { playerNews } = finalizeMatch(homeTeam, awayTeam, result, {
    seasonStats: ensureSeasonStats(),
    division: state.playerDivision,
    isCopa: true,
    playerTeamId
  });
  addDisciplineNews(playerNews);
  syncLineupPlayerRefs();
  applyLegResult(tie, legIdx, result.homeGoals, result.awayGoals);

  const pg = isHome ? result.homeGoals : result.awayGoals;
  const og = isHome ? result.awayGoals : result.homeGoals;
  const opponent = isHome ? awayTeam.name : homeTeam.name;
  const outcome = pg > og ? t('win') : pg < og ? t('loss') : t('draw');
  addNews(t('newsCopaMatch', {
    phase: t(getPhaseLabelKey(copa.phase)),
    outcome,
    opponent,
    pg,
    og
  }), 'copa');

  const pending = { home: homeTeam, away: awayTeam, result, isHome, isCopa: true };
  const roundLabel = copa.currentLeg === 2 ? t('copaLeg2') : t('copaLeg1');

  els.matchPreview.innerHTML = '';
  els.matchResult.classList.add('hidden');
  els.btnPlayMatch.disabled = true;
  switchTab('match');

  startLiveMatch({
    container: els.matchLive,
    home: homeTeam,
    away: awayTeam,
    result,
    round: roundLabel,
    onComplete: () => {
      els.matchLive.classList.add('hidden');
      els.matchLive.innerHTML = '';
      tryResolveTie(tie, participants, singleLeg);
      finishCopaEvent();
      notifyPopularityChange(processMatchPopularity(ensureClubProfile(), {
        season: state.season,
        isLeague: false,
        isWin: pg > og,
        isDraw: pg === og,
        isHome,
        playerGoals: pg,
        opponentId: isHome ? awayTeam.id : homeTeam.id,
        result,
        homeId: homeTeam.id,
        awayId: awayTeam.id,
        playerTeamId,
        standingsBefore: null,
        gamesPlayed: getPlayerClub().stats.played
      }));
      const oppTeam = isHome ? awayTeam : homeTeam;
      processReinforcementAfterMatch({ opponent: oppTeam, pg, og, result, isHome });
      showMatchResult(pending.home, pending.away, pending.result, pending.isHome);
      renderAll();
      els.btnPlayMatch.disabled = !canPlayMatch() && !state.pendingSeasonEnd;
    }
  });
}

function renderCopaTieCard(tie, participants) {
  const d = getTieDisplay(tie, participants);
  if (!d) return '';

  const involvesPlayer = d.homeId === playerTeamId || d.awayId === playerTeamId;
  const homeWon = d.winnerId === d.homeId;
  const awayWon = d.winnerId === d.awayId;
  const isDone = !!d.winnerId;

  let scoreLabel = '';
  let scoreHome = null;
  let scoreAway = null;

  if (!d.isTwoLeg && d.leg1) {
    scoreLabel = '';
    scoreHome = d.leg1.home;
    scoreAway = d.leg1.away;
  } else if (d.isTwoLeg && d.leg2) {
    scoreLabel = t('copaAggregate');
    scoreHome = d.aggregate.home;
    scoreAway = d.aggregate.away;
  } else if (d.isTwoLeg && d.leg1) {
    scoreLabel = t('copaLeg1');
    scoreHome = d.leg1.home;
    scoreAway = d.leg1.away;
  }

  const centerScore = scoreHome !== null
    ? `<span class="copa-score-main">${scoreHome}<span class="copa-score-sep">×</span>${scoreAway}</span>${scoreLabel ? `<span class="copa-score-label">${scoreLabel}</span>` : ''}`
    : '<span class="copa-score-pending">—</span>';

  const winnerRow = isDone
    ? `<div class="copa-match-winner">${t('copaWinner')}: <strong>${esc(d.winnerId === d.homeId ? d.homeName : d.awayName)}</strong></div>`
    : d.pending
      ? `<div class="copa-match-winner copa-match-winner-pending">${t('copaAwaiting')}</div>`
      : '';

  const legsDetail = [];
  if (d.isTwoLeg) {
    if (d.leg1) {
      legsDetail.push(`<span class="copa-leg-chip">${t('copaLeg1')}: ${d.leg1.home}×${d.leg1.away}</span>`);
    } else {
      legsDetail.push(`<span class="copa-leg-chip copa-leg-pending">${t('copaLeg1')}: —</span>`);
    }
    if (d.leg2) {
      legsDetail.push(`<span class="copa-leg-chip">${t('copaLeg2')}: ${d.leg2.home}×${d.leg2.away}</span>`);
    } else {
      legsDetail.push(`<span class="copa-leg-chip copa-leg-pending">${t('copaLeg2')}: —</span>`);
    }
  }

  const footer = d.decidedBy === 'penalties' && d.penalties
    ? `<div class="copa-match-footer"><span class="copa-footer-pen">${t('copaPenaltiesShort', { h: d.penalties.home, a: d.penalties.away })}</span></div>`
    : '';

  return `<div class="copa-match-card ${involvesPlayer ? 'is-player' : ''} ${isDone ? 'is-done' : ''}">
    <div class="copa-match-main">
      <span class="copa-team home ${homeWon ? 'is-winner' : ''} ${d.homeIsPlayer ? 'is-player-team' : ''}">${esc(d.homeName)}</span>
      <div class="copa-match-center">${centerScore}</div>
      <span class="copa-team away ${awayWon ? 'is-winner' : ''} ${d.awayIsPlayer ? 'is-player-team' : ''}">${esc(d.awayName)}</span>
    </div>
    ${winnerRow}
    ${legsDetail.length ? `<div class="copa-match-legs">${legsDetail.join('')}</div>` : ''}
    ${footer}
  </div>`;
}

const COPA_PHASE_ORDER = COPA_PHASES.map(p => p.key);

function getCopaPhaseIndex(phase) {
  if (phase === 'finished') return COPA_PHASE_ORDER.length;
  return COPA_PHASE_ORDER.indexOf(phase);
}

function renderCopaTimeline(copa) {
  const currentIdx = getCopaPhaseIndex(copa.phase);
  const steps = COPA_PHASE_ORDER.map((key, i) => {
    let state = 'upcoming';
    if (copa.phase === 'finished' || i < currentIdx) state = 'done';
    else if (i === currentIdx) state = 'active';
    const short = t(getPhaseShortLabelKey(key));
    return `<div class="copa-timeline-step ${state}" data-phase="${key}" title="${esc(t(getPhaseLabelKey(key)))}">
      <span class="copa-timeline-dot"></span>
      <span class="copa-timeline-label">${esc(short)}</span>
    </div>`;
  }).join('');
  return `<div class="copa-timeline" role="navigation" aria-label="${esc(t('tabCopa'))}">${steps}</div>`;
}

function renderCopaPhaseSection(key, ties, participants, copa, phaseNum, isCurrent) {
  const title = t(getPhaseLabelKey(key));
  const rows = ties.map(tie => renderCopaTieCard(tie, participants)).join('');
  const badge = isCurrent
    ? t('inProgress')
    : t('copaPhaseDone');
  const legHint = isCurrent && getPhaseConfig(key)?.legs === 2
    ? ` · ${copa.currentLeg === 1 ? t('copaLeg1') : t('copaLeg2')}`
    : '';

  let byeBlock = '';
  if (key === 'phase1' && copa.byeTeams?.length) {
    const byeList = copa.byeTeams
      .map(id => findTeamById(participants, id))
      .filter(Boolean)
      .map(team => `<span class="copa-bye-chip ${team.isPlayer ? 'is-player' : ''}">${esc(team.name)}</span>`)
      .join('');
    byeBlock = `<div class="copa-phase-byes"><span class="copa-byes-label">${t('copaByeTitle')}:</span> ${byeList}</div>`;
  }

  return `<details class="copa-section ${isCurrent ? 'copa-section-live' : 'copa-section-done'}" id="copa-phase-${key}" ${isCurrent ? 'open' : ''}>
    <summary class="copa-section-summary">
      <span class="copa-phase-step">${phaseNum}/${COPA_PHASE_ORDER.length}</span>
      <span class="copa-phase-name">${esc(title)}${esc(legHint)}</span>
      <span class="copa-phase-badge ${isCurrent ? 'is-live' : ''}">${badge}</span>
      <span class="copa-phase-count">${t('copaMatchCount', { n: ties.length })}</span>
    </summary>
    ${byeBlock}
    <div class="copa-match-list">${rows}</div>
  </details>`;
}

function renderCopaChampionHero(championName, championId) {
  const isPlayer = championId === playerTeamId;
  const crest = renderTeamCrest(
    isPlayer ? { name: championName, isPlayer: true } : championName,
    { className: 'copa-champion-crest' }
  );
  return `
    <div class="copa-champion-hero-inner">
      <div class="copa-champion-club">
        <p class="copa-champion-label">${t('copaChampionKicker')}</p>
        <div class="copa-champion-crest-wrap">${crest}</div>
        <p class="copa-champion-name">${esc(championName)}</p>
        <p class="copa-champion-comp">${t('tabCopa')}</p>
      </div>
    </div>`;
}

function scrollCopaToCurrentPhase() {
  const live = document.getElementById(`copa-phase-${state.copaBrasil.phase}`);
  if (!live || state.copaBrasil.phase === 'finished') return;
  requestAnimationFrame(() => {
    live.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function renderCopa(scrollToCurrent = false) {
  if (!els.copaBracket) return;
  const copa = state.copaBrasil;
  const participants = getCopaParticipants();

  if (!els.copaStatus) return;

  const showChampionHero = copa.phase === 'finished' && copa.championName;
  if (els.copaChampionHero) {
    if (showChampionHero) {
      els.copaChampionHero.hidden = false;
      els.copaChampionHero.innerHTML = renderCopaChampionHero(copa.championName, copa.championId);
    } else {
      els.copaChampionHero.hidden = true;
      els.copaChampionHero.innerHTML = '';
    }
  }
  if (els.copaStatusCard) {
    els.copaStatusCard.classList.toggle('is-hidden', !!showChampionHero);
  }

  if (copa.phase === 'idle') {
    els.copaStatus.textContent = t('copaNotStarted');
    els.copaBracket.innerHTML = `<p class="empty-msg">${t('copaNotStartedHint')}</p>`;
    return;
  }

  const phaseLabel = t(getPhaseLabelKey(copa.phase));
  const legHint = copa.phase !== 'finished' && getPhaseConfig(copa.phase)?.legs === 2
    ? ` · ${copa.currentLeg === 1 ? t('copaLeg1') : t('copaLeg2')}`
    : '';
  els.copaStatus.textContent = showChampionHero
    ? ''
    : `${phaseLabel}${legHint}`;

  const sections = [];
  const currentIdx = getCopaPhaseIndex(copa.phase);

  sections.push(renderCopaTimeline(copa));

  for (let i = 0; i < COPA_PHASE_ORDER.length; i++) {
    const key = COPA_PHASE_ORDER[i];
    let ties = null;
    let isCurrent = false;

    if (copa.phase === 'finished') {
      ties = copa.bracket[key];
    } else if (i < currentIdx) {
      ties = copa.bracket[key];
    } else if (i === currentIdx) {
      ties = copa.ties;
      isCurrent = true;
    }

    if (!ties?.length) continue;
    sections.push(renderCopaPhaseSection(key, ties, participants, copa, i + 1, isCurrent));
  }

  els.copaBracket.innerHTML = sections.join('') || `<p class="empty-msg">${t('copaNoMatches')}</p>`;

  els.copaBracket.querySelectorAll('.copa-timeline-step').forEach(step => {
    step.addEventListener('click', () => {
      const el = document.getElementById(`copa-phase-${step.dataset.phase}`);
      if (!el) return;
      el.open = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  if (scrollToCurrent) scrollCopaToCurrentPhase();
}

// ─── Match ───
function canPlayMatch() {
  if (isOnboardingActive(state)) return false;
  const lg = activeLeague();
  if (state.squad.length < MIN_SQUAD
    || state.pendingSeasonEnd
    || isLiveMatchRunning()) return false;
  if (isSeasonOver(lg.currentRound, lg.fixtures)) return false;
  if (isCopaMatchDay()) return true;
  if (state.matchDayType === 'league' || !isCopaActive()) return true;
  return false;
}

function onDashboardMatchAction() {
  if (state.pendingSeasonEnd) {
    showSeasonEndScreen();
    return;
  }
  if (isCopaMatchDay()) {
    playCopaMatch();
    return;
  }
  playPlayerMatch();
}

function simulateLeagueRoundSkipPlayer(lg) {
  const statsStore = ensureSeasonStats();
  const recordOpts = { recordMatch: recordDivisionMatch };
  for (const div of [1, 2, 3]) {
    if (div === state.playerDivision) continue;
    const otherLg = leagueByDiv(div);
    simulateAiMatches(otherLg.fixtures, otherLg.currentRound, otherLg.teams, simulateMatch, {
      ...recordOpts,
      division: div,
      seasonStats: statsStore
    });
  }
  simulateAiMatches(lg.fixtures, lg.currentRound, lg.teams, simulateMatch, {
    ...recordOpts,
    skipTeamId: playerTeamId,
    division: state.playerDivision,
    seasonStats: statsStore
  });
  for (const league of allLeagues()) league.currentRound++;
  maybeRotateMarketAfterRound();
  checkSeasonEnd();
  renderAll();
  scheduleGameSave(state);
}

function playPlayerMatch() {
  if (!canPlayMatch()) return;

  const lg = activeLeague();
  const match = getPlayerNextMatch(lg.fixtures, lg.currentRound, playerTeamId);
  if (!match) {
    simulateLeagueRoundSkipPlayer(lg);
    return;
  }
  if (match.played) return;

  state.preMatchStandingsSnapshot = {
    1: snapshotDivision(1),
    2: snapshotDivision(2),
    3: snapshotDivision(3)
  };
  state.standingsAnimPending = { 1: true, 2: true, 3: true };

  const statsStore = ensureSeasonStats();
  const recordOpts = { recordMatch: recordDivisionMatch };
  for (const div of [1, 2, 3]) {
    if (div === state.playerDivision) continue;
    const otherLg = leagueByDiv(div);
    simulateAiMatches(otherLg.fixtures, otherLg.currentRound, otherLg.teams, simulateMatch, {
      ...recordOpts,
      division: div,
      seasonStats: statsStore
    });
  }
  simulateAiMatches(lg.fixtures, lg.currentRound, lg.teams, simulateMatch, {
    ...recordOpts,
    skipTeamId: playerTeamId,
    division: state.playerDivision,
    seasonStats: statsStore
  });

  const home = lg.teams.find(t => t.id === match.home);
  const away = lg.teams.find(t => t.id === match.away);
  const isHome = match.home === playerTeamId;
  const standingsBefore = getStandings(lg.teams);

  refreshPlayerLineup();
  const playerLineup = cloneLineupForMatch(getEffectivePlayerLineup());
  const hLineup = isHome ? playerLineup : prepareTeamLineup(home, home.formation || '433');
  const aLineup = !isHome ? playerLineup : prepareTeamLineup(away, away.formation || '433');

  const result = simulateMatch(home, away, hLineup, aLineup);
  const { playerNews } = finalizeMatch(home, away, result, {
    seasonStats: statsStore,
    division: state.playerDivision,
    isCopa: false,
    playerTeamId
  });
  addDisciplineNews(playerNews);
  syncLineupPlayerRefs();
  match.played = true;
  match.homeGoals = result.homeGoals;
  match.awayGoals = result.awayGoals;
  applyResult(lg.teams, match.home, match.away, result.homeGoals, result.awayGoals);
  recordDivisionMatch(state.playerDivision, home, away, result);

  const pg = isHome ? result.homeGoals : result.awayGoals;
  const og = isHome ? result.awayGoals : result.homeGoals;
  const opponent = isHome ? away.name : home.name;
  const opponentId = isHome ? away.id : home.id;
  let outcome;
  let prize = 0;
  if (pg > og) { outcome = t('win'); prize = WIN_PRIZE; adjustBudget(WIN_PRIZE); }
  else if (pg < og) { outcome = t('loss'); }
  else { outcome = t('draw'); prize = DRAW_PRIZE; adjustBudget(DRAW_PRIZE); }

  const prizeLabel = prize > 0
    ? t('prizeBonus', { amount: formatMoney(prize) })
    : t('prizeNone');
  addNews(t('newsMatchResult', {
    outcome,
    opponent,
    pg,
    og,
    prize: prizeLabel
  }));

  const round = lg.currentRound + 1;
  const pending = { home, away, result, isHome, standingsBefore, opponentId, pg, og };

  els.matchPreview.innerHTML = '';
  els.matchResult.classList.add('hidden');
  els.btnPlayMatch.disabled = true;
  switchTab('match');

  startLiveMatch({
    container: els.matchLive,
    home,
    away,
    result,
    round,
    onComplete: () => {
      els.matchLive.classList.add('hidden');
      els.matchLive.innerHTML = '';
      for (const league of allLeagues()) league.currentRound++;
      maybeRotateMarketAfterRound();
      maybeStartCopaAfterFirstTurn();
      notifyPopularityChange(processMatchPopularity(ensureClubProfile(), {
        season: state.season,
        isLeague: true,
        isWin: pending.pg > pending.og,
        isDraw: pending.pg === pending.og,
        isHome: pending.isHome,
        playerGoals: pending.pg,
        opponentId: pending.opponentId,
        result: pending.result,
        homeId: pending.home.id,
        awayId: pending.away.id,
        playerTeamId,
        standingsBefore: pending.standingsBefore,
        gamesPlayed: getPlayerClub().stats.played
      }));
      const oppTeam = pending.isHome ? pending.away : pending.home;
      processReinforcementAfterMatch({
        opponent: oppTeam,
        pg: pending.pg,
        og: pending.og,
        result: pending.result,
        isHome: pending.isHome
      });
      if (isCopaActive() && state.copaBrasil.phase !== 'finished') {
        state.matchDayType = 'copa';
      }
      checkSeasonEnd();
      if (state.pendingSeasonEnd) {
        const pg = pending.isHome ? pending.result.homeGoals : pending.result.awayGoals;
        const og = pending.isHome ? pending.result.awayGoals : pending.result.homeGoals;
        state.pendingSeasonEnd.lastMatch = {
          playerGoals: pg,
          opponentGoals: og,
          opponent: pending.isHome ? pending.away.name : pending.home.name
        };
        showSeasonEndScreen();
      } else {
        showMatchResult(pending.home, pending.away, pending.result, pending.isHome);
      }
      renderAll();
      tryAnimateStandingsAfterMatch();
      els.btnPlayMatch.disabled = !canPlayMatch() && !state.pendingSeasonEnd;
    }
  });
}

function bindMatchActionButton() {
  const btn = els.matchResult.querySelector('[data-match-action]');
  btn?.addEventListener('click', onMatchResultContinue);
}

function bindMatchResultTabs(root) {
  const tabs = root.querySelectorAll('[data-result-tab]');
  const panels = root.querySelectorAll('[data-result-panel]');
  if (!tabs.length) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const id = tab.dataset.resultTab;
      tabs.forEach(item => item.classList.toggle('active', item.dataset.resultTab === id));
      panels.forEach(panel => panel.classList.toggle('active', panel.dataset.resultPanel === id));
    });
  });
}

function onMatchResultContinue() {
  els.matchResult.classList.add('hidden');
  switchTab('dashboard');
  resumeAfterMatch();
  showPendingReinforcementPrompt();
}

window.onMatchResultContinue = onMatchResultContinue;

function showMatchResult(home, away, result, isPlayerHome) {
  const d = getMatchDisplayView(home, away, result);
  const pg = isPlayerHome ? result.homeGoals : result.awayGoals;
  const og = isPlayerHome ? result.awayGoals : result.homeGoals;
  playMatchResult(pg > og ? true : pg < og ? false : null);
  const outcome = pg > og ? t('win') : pg < og ? t('loss') : t('draw');
  const outcomeClass = pg > og ? 'outcome-win' : pg < og ? 'outcome-loss' : 'outcome-draw';
  const round = activeLeague().currentRound;

  els.matchPreview.innerHTML = '';
  els.matchResult.classList.remove('hidden');
  switchTab('match');
  els.matchResult.innerHTML = `
    <div class="match-result-layout">
      <div class="match-result-scroll scroll-surface">
        <div class="match-result-header">
          <span class="match-round-badge">${t('round', { n: round })}</span>
          <span class="match-outcome-badge ${outcomeClass}">${outcome}</span>
        </div>

        <div class="match-score-block">
          <div class="match-scoreboard">
            <div class="match-side ${d.leftWins ? 'is-winner' : ''} ${d.left.isPlayer ? 'is-player' : ''}">
              ${renderTeamCrest(d.left, { className: 'match-crest' })}
              <div class="match-side-name">${esc(d.left.name)}</div>
              <div class="match-side-meta">${t('strength')} ${d.leftStr}${d.left.isPlayer ? ` · ${t('yourClub')}` : ''}</div>
            </div>

            <div class="match-score-center">
              <div class="result-scoreline">
                <span class="score-digit ${d.leftWins ? 'winner' : ''}">${d.leftGoals}</span>
                <span class="score-sep">×</span>
                <span class="score-digit ${d.rightWins ? 'winner' : ''}">${d.rightGoals}</span>
              </div>
              <div class="match-score-label">${t('finalScore')}</div>
            </div>

            <div class="match-side ${d.rightWins ? 'is-winner' : ''}">
              ${renderTeamCrest(d.right, { className: 'match-crest away' })}
              <div class="match-side-name">${esc(d.right.name)}</div>
              <div class="match-side-meta">${t('strength')} ${d.rightStr}${d.right.isPlayer ? ` · ${t('yourClub')}` : ''}</div>
            </div>
          </div>
          ${renderGoalsMiniSummary(result.events, t('noGoalsGame'), { left: d.leftEventSide, right: d.rightEventSide })}
        </div>

        <div class="match-result-detail">
          <div class="match-result-tabs">
            <button type="button" class="match-result-tab active" data-result-tab="lineup">${t('tabLineup')}</button>
            <button type="button" class="match-result-tab" data-result-tab="stats">${t('tabStats')}</button>
          </div>

          <div class="match-result-tab-panel active" data-result-panel="lineup">
            <p class="roster-section-label">${t('lineupOnPitch')}</p>
            <div class="match-roster-grid">
              <div class="match-roster-panel home-panel">
                <div class="roster-panel-head">
                  <span class="col-dot home-dot"></span>
                  <span class="roster-team-name">${esc(d.left.name)}</span>
                  <span class="roster-score">${d.leftGoals}</span>
                </div>
                <div class="roster-list">${renderTeamRoster(d.leftLineup, result.events, d.leftEventSide)}</div>
              </div>
              <div class="match-roster-panel away-panel">
                <div class="roster-panel-head">
                  <span class="col-dot away-dot"></span>
                  <span class="roster-team-name">${esc(d.right.name)}</span>
                  <span class="roster-score">${d.rightGoals}</span>
                </div>
                <div class="roster-list">${renderTeamRoster(d.rightLineup, result.events, d.rightEventSide)}</div>
              </div>
            </div>
          </div>

          <div class="match-result-tab-panel" data-result-panel="stats">
            ${renderMatchStats(result, d)}
          </div>
        </div>
      </div>

      <div class="match-action-bar">
        <button type="button" class="btn btn-primary btn-match-continue" data-match-action>
          ${t('continue')}
        </button>
      </div>
    </div>`;
  bindMatchActionButton();
  bindMatchResultTabs(els.matchResult);
}

function showSeasonEndScreen() {
  const d = state.pendingSeasonEnd;
  if (!d) return;

  els.matchPreview.innerHTML = '';
  els.matchLive.classList.add('hidden');
  els.matchLive.innerHTML = '';
  els.matchResult.classList.remove('hidden');
  switchTab('match');

  mountSeasonEndScreen(els.matchResult, d, {
    onContinue: () => window.newSeason()
  });
}

function checkSeasonEnd() {
  const lg = activeLeague();
  if (!isSeasonOver(lg.currentRound, lg.fixtures)) return;

  const divisionBefore = state.playerDivision;
  const allStandings = {
    1: getStandings(state.serieA.teams),
    2: getStandings(state.serieB.teams),
    3: getStandings(state.serieC.teams)
  };
  const standings = allStandings[divisionBefore];
  const champion = standings[0];
  const playerPos = standings.findIndex(tm => tm.isPlayer) + 1;
  const divName = divisionLabel(divisionBefore);
  const serieATop3 = buildSerieATop3(state.serieA.teams);
  const oldSnapshot = state.preMatchStandingsSnapshot?.[divisionBefore] || null;

  const promo = processPromotionRelegation(state.serieA, state.serieB, state.serieC, playerTeamId);
  const { drama, mood } = buildSeasonEndExtras({
    divisionBefore,
    standings,
    oldSnapshot,
    playerTeamId,
    divisionAfter: promo.playerDivision,
    isPlayerChampion: champion.isPlayer
  });

  state.playerDivision = promo.playerDivision;
  const pc = getPlayerClub();
  if (pc) pc.division = state.playerDivision;
  promo.messages.forEach(m => addNews(m));

  const seasonPrize = calcLeagueSeasonPrize(divisionBefore, playerPos, champion.isPlayer);
  adjustBudget(seasonPrize);

  if (champion.isPlayer) {
    addNews(t('newsChampion', {
      div: divName,
      club: state.clubName,
      prize: formatMoney(seasonPrize)
    }));
  } else {
    addNews(t('newsSeasonEnd', {
      div: divName,
      champion: champion.name,
      pos: playerPos,
      prize: formatMoney(seasonPrize)
    }));
  }

  const nextDiv = divisionLabel(state.playerDivision);
  updateHistoryAfterSeason(state.history, serieATop3, state.copaBrasil);

  const endResult = recordSeasonEnd(ensureClubProfile(), {
    season: state.season,
    divisionBefore,
    divisionAfter: state.playerDivision,
    position: playerPos,
    points: getPlayerClub().stats.points,
    isChampion: champion.isPlayer,
    copa: state.copaBrasil,
    playerTeamId
  });
  if (endResult.popDelta) {
    notifyPopularityChange(endResult.popDelta);
  }

  state.pendingSeasonEnd = {
    season: state.season,
    clubName: state.clubName,
    championName: champion.name,
    isPlayerChampion: champion.isPlayer,
    playerPos,
    divName,
    divisionBefore,
    nextDiv,
    points: getPlayerClub().stats.points,
    copaChampion: state.copaBrasil.championName || null,
    standings,
    oldSnapshot,
    drama,
    mood,
    seasonPrize,
    leaguesSummary: [1, 2, 3].map(div => ({
      division: div,
      label: divisionLabel(div),
      standings: allStandings[div]
    }))
  };
}

function maybeRotateMarketAfterRound() {
  if (!state.gameStarted) return;
  const rotated = rotateMarketPool(state);
  if (rotated) {
    syncMarketTierFilter();
    filterMarket();
  }
}

window.newSeason = function() {
  state.pendingSeasonEnd = null;
  state.copaBrasil = createIdleCopa();
  state.matchDayType = 'league';
  state.season++;
  resetSeasonStats(state.seasonStats);
  const signedIds = getSignedIds();
  const emptyStats = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 };

  for (const league of allLeagues()) {
    for (const t of league.teams) {
      t.stats = { ...emptyStats };
      if (!t.isPlayer) {
        const fresh = refreshClubSquadForDivision(t.name, t.division);
        if (fresh) {
          t.squad = fresh.squad;
          t.strength = fresh.strength;
        }
      }
    }
    league.currentRound = 0;
    league.fixtures = generateFixtures(league.teams);
  }
  state.viewingDivision = state.playerDivision;

  getPlayerClub().squad = state.squad;
  resetSquadDiscipline(state.squad);
  const sponsorship = getSeasonSponsorship(state.playerDivision);
  adjustBudget(sponsorship);
  resetSeasonPopTracking(ensureClubProfile());
  resetReinforcementSeason(ensureReinforcement());
  state.negotiationAttempts = {};
  rotateMarketPool(state, { force: true });
  syncMarketTierFilter();
  addNews(t('newsNewSeason', {
    season: state.season,
    div: divisionLabel(state.playerDivision),
    sponsorship: formatMoney(sponsorship)
  }));
  els.matchResult.classList.add('hidden');
  renderAll();
  switchTab('dashboard');
};

// ─── Dashboard ───
function updateDashboard() {
  state.budget = roundMoney(state.budget);
  els.budgetDisplay.textContent = formatMoney(state.budget);
  els.squadCount.textContent = `${state.squad.length}/${MAX_SQUAD}`;

  const str = getEffectivePlayerStrength();
  els.avgForce.textContent = str || '—';
  els.summaryCount.textContent = state.squad.length;
  els.legendCount.textContent = state.squad.filter(p => p.legend).length;

  const lg = activeLeague();
  const standings = getStandings(lg.teams);
  const pos = standings.findIndex(t => t.isPlayer) + 1;
  els.leaguePosition.textContent = pos ? `${t('positionOrdinal', { pos })} ${divisionLabel(state.playerDivision)}` : '—';

  const totalRounds = lg.fixtures.length;
  const roundNum = Math.min(lg.currentRound + 1, totalRounds);
  els.seasonLabel.textContent = `T${state.season} · ${divisionLabel(state.playerDivision)} · R${roundNum}/${totalRounds}`;
  const roundTag = document.getElementById('dashboard-round-tag');
  if (roundTag) {
    if (isCopaMatchDay()) {
      const phaseLabel = t(getPhaseLabelKey(state.copaBrasil.phase));
      roundTag.textContent = `${t('tabCopa')} · ${phaseLabel}`;
    } else {
      roundTag.textContent = isSeasonOver(lg.currentRound, lg.fixtures) ? t('seasonEnd') : t('roundShort', { n: roundNum });
    }
  }

  els.btnPlayMatch.disabled = !canPlayMatch();

  if (state.squad.length < MIN_SQUAD) {
    els.nextMatchInfo.innerHTML = `<p class="empty-msg">${t('needMorePlayers', { n: MIN_SQUAD - state.squad.length })}</p>`;
    els.btnPlayMatch.textContent = t('needMinSquad', { n: MIN_SQUAD });
  } else if (state.pendingSeasonEnd) {
    const d = state.pendingSeasonEnd;
    els.nextMatchInfo.innerHTML = `
      <div class="dash-season-end-hint">
        <p class="dash-season-end-title">${d.isPlayerChampion ? t('champion') : t('seasonOver')}</p>
        <p class="empty-msg">${esc(d.divName)} · ${t('positionOrdinal', { pos: d.playerPos })} · ${d.points} ${t('pts')}</p>
        <p class="empty-msg">${t('nextSeasonHint', { div: esc(d.nextDiv) })}</p>
      </div>`;
    els.btnPlayMatch.textContent = t('newSeason');
    els.btnPlayMatch.disabled = false;
  } else if (isSeasonOver(lg.currentRound, lg.fixtures)) {
    els.nextMatchInfo.innerHTML = `<p class="empty-msg">${t('seasonOver')}.</p>`;
  } else if (isCopaMatchDay()) {
    renderCopaNextMatch();
  } else {
    const match = getPlayerNextMatch(lg.fixtures, lg.currentRound, playerTeamId);
    if (match) {
      const home = lg.teams.find(t => t.id === match.home);
      const away = lg.teams.find(t => t.id === match.away);
      const isHome = match.home === playerTeamId;
      const opp = isHome ? away : home;
      const oppStr = getTeamDisplayStrength(opp);
      const venue = isHome ? t('home') : t('away');
      els.nextMatchInfo.innerHTML = `
        <div class="dash-match-block">
          <div class="dash-match-team is-player">
            ${renderTeamCrest({ name: state.clubName, isPlayer: true }, { className: 'dash-crest' })}
            <div class="dash-team-name">${esc(state.clubName)}</div>
            <div class="dash-team-force">${t('strength')} ${str}</div>
          </div>
          <div class="dash-match-center">
            <span class="dash-venue">${venue}</span>
            <span class="dash-vs">VS</span>
            <span class="dash-round">R${lg.currentRound + 1}</span>
          </div>
          <div class="dash-match-team">
            ${renderTeamCrest(opp, { className: 'dash-crest away' })}
            <div class="dash-team-name">${esc(opp.name)}</div>
            <div class="dash-team-force">${t('strength')} ${oppStr}</div>
          </div>
        </div>`;
      els.btnPlayMatch.textContent = isHome ? t('playHome') : t('playAway');
    } else {
      els.nextMatchInfo.innerHTML = `<p class="empty-msg">${t('leagueByeRound')}</p>`;
      els.btnPlayMatch.textContent = t('leagueSimulateRound');
    }
  }

  renderMiniStandings();
  renderNews();
}

function renderCopaNextMatch() {
  const copa = state.copaBrasil;
  const participants = getCopaParticipants();
  const str = getEffectivePlayerStrength();
  const phaseLabel = t(getPhaseLabelKey(copa.phase));

  if (isPlayerOnCopaBye(copa, playerTeamId)) {
    els.nextMatchInfo.innerHTML = `
      <div class="dash-copa-hint">
        <p class="dash-copa-phase">${t('tabCopa')} · ${phaseLabel}</p>
        <p class="empty-msg">${t('copaByePlayer')}</p>
      </div>`;
    els.btnPlayMatch.textContent = t('copaSimulateRound');
    return;
  }

  if (copa.playerEliminated) {
    els.nextMatchInfo.innerHTML = `
      <div class="dash-copa-hint">
        <p class="dash-copa-phase">${t('tabCopa')} · ${phaseLabel}</p>
        <p class="empty-msg">${t('copaEliminatedWatch')}</p>
      </div>`;
    els.btnPlayMatch.textContent = t('copaSimulateRound');
    return;
  }

  const tie = getPlayerCopaTie(copa, playerTeamId);
  if (!tie) {
    els.nextMatchInfo.innerHTML = `<p class="empty-msg">${t('copaNoPlayerMatch')}</p>`;
    els.btnPlayMatch.textContent = t('copaSimulateRound');
    return;
  }

  const legIdx = copa.currentLeg - 1;
  const matchup = getLegHomeAway(tie, legIdx, participants);
  if (!matchup) return;
  const { home, away } = matchup;
  const isHome = home.id === playerTeamId;
  const opp = isHome ? away : home;
  const oppStr = getTeamDisplayStrength(opp);
  const venue = isHome ? t('home') : t('away');

  els.nextMatchInfo.innerHTML = `
    <div class="dash-match-block">
      <p class="dash-copa-phase">${t('tabCopa')} · ${phaseLabel}${copa.currentLeg === 2 ? ` · ${t('copaLeg2')}` : ''}</p>
      <div class="dash-match-block">
        <div class="dash-match-team is-player">
          ${renderTeamCrest({ name: state.clubName, isPlayer: true }, { className: 'dash-crest' })}
          <div class="dash-team-name">${esc(state.clubName)}</div>
          <div class="dash-team-force">${t('strength')} ${str}</div>
        </div>
        <div class="dash-match-center">
          <span class="dash-venue">${venue}</span>
          <span class="dash-vs">VS</span>
        </div>
        <div class="dash-match-team">
          ${renderTeamCrest(opp, { className: 'dash-crest away' })}
          <div class="dash-team-name">${esc(opp.name)}</div>
          <div class="dash-team-force">${t('strength')} ${oppStr}</div>
        </div>
      </div>
    </div>`;
  els.btnPlayMatch.textContent = isHome ? t('playHome') : t('playAway');
}

function addNews(text, kind = 'league') {
  const lg = activeLeague();
  state.news.unshift({ round: lg.currentRound + 1, text, kind });
  if (state.news.length > MAX_CLUB_NEWS) state.news.pop();
}

function ensureClubProfile() {
  if (!state.clubProfile) {
    state.clubProfile = createClubProfile(state.playerDivision);
  }
  return ensureClubProfileFields(state.clubProfile);
}

function ensureReinforcement() {
  if (!state.reinforcementPrompt) state.reinforcementPrompt = createReinforcementState();
  return ensureReinforcementFields(state.reinforcementPrompt);
}

function getScoutReachPlayerList() {
  return getScoutReachPlayers(
    state.allPlayers,
    getSignedIds(),
    getScoutLevelFromState(state)
  );
}

function processReinforcementAfterMatch({ opponent, pg, og, result, isHome }) {
  if (!isOnboardingComplete(state)) return;
  const reinf = ensureReinforcement();
  const { reinf: next, trigger, silenceFeed } = evaluateMatchForReinforcement(reinf, {
    isWin: pg > og,
    isDraw: pg === og,
    isLoss: pg < og,
    playerGoals: pg,
    opponentGoals: og,
    lineup: state.lineup,
    opponentStrength: opponent.strength || getTeamDisplayStrength(opponent) || 70,
    round: getPlayerClub().stats.played,
    events: result.events,
    playerSide: isHome ? 'home' : 'away',
    squadFull: state.squad.length >= MAX_SQUAD
  });
  state.reinforcementPrompt = next;

  if (silenceFeed) {
    addNews(t('reinfSilenceFeed'));
    return;
  }
  if (!trigger) return;

  let players = [];
  let specialCase = null;
  if (trigger.squadFull) {
    specialCase = 'squadFull';
  } else {
    players = pickMarketSuggestions(
      getScoutReachPlayerList(),
      getSignedIds(),
      canNegotiateMarketPlayer,
      calcPrice,
      3
    );
    if (!players.length) specialCase = 'noBudget';
    else if (players.length < 3) specialCase = 'fewOptions';
  }

  state.reinforcementPrompt.pending = {
    sector: trigger.sector,
    scapegoatId: trigger.scapegoat?.playerId ?? null,
    scapegoatName: trigger.scapegoat?.name ?? null,
    playerIds: players.map(p => p.playerId),
    textKey: trigger.textKey,
    subtitleKey: trigger.subtitleKey,
    specialCase,
    round: trigger.round
  };
}

function showPendingReinforcementPrompt() {
  const reinf = ensureReinforcement();
  const pending = consumePendingForDisplay(reinf);
  if (!pending) return;
  state.reinforcementPrompt = reinf;

  const mainText = pending.scapegoatName
    ? t(pending.textKey, { name: pending.scapegoatName })
    : t(pending.textKey);

  let subtitle;
  if (pending.specialCase === 'squadFull') {
    subtitle = t('reinfSpecialSquadFull');
  } else if (pending.specialCase === 'noBudget') {
    subtitle = t('reinfSpecialNoBudget');
  } else if (pending.specialCase === 'fewOptions') {
    subtitle = `${t(pending.subtitleKey)} ${t('reinfSpecialFewOptions')}`;
  } else {
    subtitle = t(pending.subtitleKey);
  }

  const players = pending.playerIds
    .map(id => state.allPlayers.find(p => p.playerId === id))
    .filter(Boolean);

  const cards = players.map(p => {
    const price = calcPrice(p);
    const primaryPos = p.positions?.[0] || '—';
    return `
      <div class="reinf-suggest-card">
        <div class="player-force-ring">${p.force}</div>
        <div class="reinf-suggest-info">
          <strong class="reinf-suggest-name">${esc(p.name)}</strong>
          <span class="reinf-suggest-meta">${primaryPos} · ${formatMoney(price)}</span>
        </div>
        <button type="button" class="btn btn-primary btn-sm"
          onclick="window.negotiateFromReinforcement('${escAttr(p.playerId)}')">${t('negotiate')}</button>
      </div>`;
  }).join('');

  els.modal.classList.add('modal-reinforcement');
  els.modal.querySelector('.modal-content')?.classList.add('modal-reinforcement-wide');
  els.modalBody.innerHTML = `
    <h3 class="reinf-modal-title">${t('reinfModalTitle')}</h3>
    <p class="reinf-modal-lead">${mainText}</p>
    <p class="reinf-modal-sub">${subtitle}</p>
    ${cards ? `<div class="reinf-suggest-list">${cards}</div>` : ''}
    <div class="reinf-modal-actions">
      <button type="button" class="btn btn-secondary" onclick="window.openMarketFromReinforcement()">${t('reinfGoMarket')}</button>
      <button type="button" class="btn btn-primary" onclick="window.closeReinforcementModal()">${t('reinfClose')}</button>
    </div>`;
  els.modal.classList.remove('hidden');
}

window.closeReinforcementModal = function() {
  closeModal();
};

window.openMarketFromReinforcement = function() {
  playUiClick();
  closeModal();
  switchTab('market');
  filterMarket();
};

window.negotiateFromReinforcement = function(playerId) {
  playUiClick();
  closeModal();
  window.openNegotiationModal(playerId);
};

function notifyPopularityChange(delta) {
  if (!delta) return;
  const profile = ensureClubProfile();
  addNews(t('newsPopularityChange', {
    delta: formatPopDelta(delta),
    total: profile.popularity
  }));
}

function popularityTierLabel(tier) {
  const keys = {
    unknown: 'clubPopTierUnknown',
    regional: 'clubPopTierRegional',
    national: 'clubPopTierNational',
    big: 'clubPopTierBig',
    icon: 'clubPopTierIcon'
  };
  return t(keys[tier] || keys.unknown);
}

function trophyLabel(type) {
  const keys = {
    serieA: 'clubTrophySerieA',
    serieB: 'clubTrophySerieB',
    serieC: 'clubTrophySerieC',
    copa: 'clubTrophyCopa'
  };
  return t(keys[type] || keys.serieB);
}

function formatSeasonHistoryCopa(entry) {
  if (entry.copaReach === 'champion') return t('clubHistoryCopaChampion');
  if (!entry.copaReach || entry.copaReach === 'none') return t('clubHistoryCopaNone');
  return t('clubHistoryCopaReach', { phase: t(getPhaseLabelKey(entry.copaReach)) });
}

function scoutMarketDescription(level) {
  const n = clampScoutLevel(level);
  return t(`scoutMarketDesc${n}`);
}

function renderUpgrades() {
  if (!els.upgradesPanel || !state.gameStarted) return;

  const profile = ensureClubProfile();
  const scoutLevel = getScoutLevelFromState(state);
  const upgrade = canUpgradeScout(profile.scoutLevel, state.budget);
  const atMax = upgrade.reason === 'max';

  let summaryHtml = '';
  let footHtml = '';

  if (atMax) {
    summaryHtml = `
      <div class="upgrade-tile-summary">
        <p class="upgrade-summary-current">${scoutMarketDescription(scoutLevel)}</p>
        <p class="upgrade-summary-maxed">${t('scoutMaxLevel')}</p>
      </div>`;
  } else {
    const canAfford = upgrade.ok;
    summaryHtml = `
      <div class="upgrade-tile-summary">
        <div class="upgrade-summary-block">
          <span class="upgrade-summary-label">${t('scoutSummaryNow')}</span>
          <p class="upgrade-summary-current">${scoutMarketDescription(scoutLevel)}</p>
        </div>
        <div class="upgrade-summary-block is-next">
          <span class="upgrade-summary-label">${t('scoutSummaryNext')}</span>
          <p class="upgrade-summary-next">${scoutMarketDescription(upgrade.next)}</p>
        </div>
      </div>`;

    footHtml = `
      <div class="upgrade-tile-action">
        <div class="upgrade-tile-foot-meta">
          <p class="scout-upgrade-cost">${t('scoutUpgradeCost', { cost: formatMoney(upgrade.cost) })}</p>
          <p class="scout-upgrade-note is-warn${canAfford ? ' is-hidden' : ''}" ${canAfford ? 'aria-hidden="true"' : ''}>${t('scoutUpgradeNoBudget')}</p>
        </div>
        <button type="button" class="btn btn-primary btn-sm" ${canAfford ? '' : 'disabled'}
          onclick="window.upgradeScout()">${t('scoutUpgradeBtn')}</button>
      </div>`;
  }

  els.upgradesPanel.innerHTML = `
    <div class="upgrades-layout">
      <div class="panel-head upgrades-head">
        <h3>${t('upgradesTitle')}</h3>
        <p class="section-hint">${t('upgradesHint')}</p>
      </div>

      <div class="upgrades-grid">
        <section class="upgrade-tile card card-elevated scout-dept-card">
          <div class="upgrade-tile-row">
            <header class="upgrade-tile-head">
              <div class="upgrade-tile-title">
                <div class="upgrade-tile-title-row">
                  <h4>${t('scoutDeptTitle')}</h4>
                  <button type="button" class="upgrade-help-btn" onclick="window.openScoutHelpModal()"
                    aria-label="${t('scoutHelpAria')}">?</button>
                </div>
                <p class="upgrade-tile-meta">${t('scoutLevelOf', { level: scoutLevel, max: SCOUT_MAX_LEVEL })}</p>
              </div>
            </header>

            ${summaryHtml}
            ${footHtml}
          </div>
        </section>
      </div>
    </div>`;
}

window.openScoutHelpModal = function() {
  playUiClick();
  els.modal.classList.add('modal-scout-help');
  els.modal.querySelector('.modal-content')?.classList.add('modal-scout-help-wide');
  els.modalBody.innerHTML = buildScoutHelpHtml(t);
  els.modal.classList.remove('hidden');
};

window.closeScoutHelpModal = function() {
  playUiClick();
  closeModal();
};

window.upgradeScout = function() {
  if (!state.gameStarted) return;
  if (isOnboardingActive(state) && getOnboardingStep(state) !== ONBOARDING_STEPS.UPGRADE_SCOUT) return;
  const profile = ensureClubProfile();
  const upgrade = canUpgradeScout(profile.scoutLevel, state.budget);
  if (!upgrade.ok) return;

  playUiClick();
  adjustBudget(-upgrade.cost);
  profile.scoutLevel = upgrade.next;
  rotateMarketPool(state, { force: true });
  syncMarketTierFilter();
  filterMarket();
  addNews(t('newsScoutUpgraded', { level: upgrade.next }));
  updateDashboard();
  renderUpgrades();

  if (isOnboardingActive(state) && getOnboardingStep(state) === ONBOARDING_STEPS.UPGRADE_SCOUT) {
    state.onboarding.scoutUpgraded = true;
    hideTutorialOverlay();
    advanceOnboarding(state, ONBOARDING_STEPS.BACK_MARKET_POPUP);
    showOnboardingPopup(ONBOARDING_STEPS.BACK_MARKET_POPUP);
    refreshOnboardingUI();
  }
};

function renderClub() {
  if (!els.clubPanel || !state.gameStarted) return;

  const profile = ensureClubProfile();
  const tier = getPopularityTier(profile.popularity);
  const pop = profile.popularity;
  const trophyCount = profile.trophies.length;
  const leagueTitles = profile.trophies.filter(tr => tr.type !== 'copa').length;
  const copaTitles = profile.trophies.filter(tr => tr.type === 'copa').length;

  const trophiesHtml = profile.trophies.length
    ? profile.trophies.map(tr => `
        <div class="club-trophy-item club-trophy-${tr.type}">
          <div class="club-trophy-body">
            <span class="club-trophy-title">${esc(trophyLabel(tr.type))}</span>
            <span class="club-trophy-season">${t('clubHistorySeason', { season: tr.season })}</span>
          </div>
        </div>`).join('')
    : `<div class="club-trophy-empty">
        <p>${t('clubTrophiesEmpty')}</p>
      </div>`;

  const historyHtml = profile.seasonHistory.length
    ? profile.seasonHistory.map(entry => {
      const badges = [
        entry.isChampion ? `<span class="club-tag is-gold">${t('clubHistoryChampion')}</span>` : '',
        entry.promoted ? `<span class="club-tag is-up">${t('clubHistoryPromoted')}</span>` : '',
        entry.relegated ? `<span class="club-tag is-down">${t('clubHistoryRelegated')}</span>` : ''
      ].filter(Boolean).join('');

      const popClass = entry.popDelta > 0 ? 'is-up' : entry.popDelta < 0 ? 'is-down' : 'is-flat';

      return `
        <tr class="club-history-row">
          <td class="club-history-cell-season">${t('clubHistorySeason', { season: entry.season })}</td>
          <td class="club-history-cell-div">${esc(divisionLabel(entry.division))}</td>
          <td class="club-history-cell-pos"><span class="club-pos-pill">${t('positionOrdinal', { pos: entry.position })}</span></td>
          <td class="club-history-cell-pts">${entry.points}</td>
          <td class="club-history-cell-copa">${formatSeasonHistoryCopa(entry)}</td>
          <td class="club-history-cell-pop"><span class="club-pop-pill ${popClass}">${formatPopDelta(entry.popDelta)}</span></td>
          <td class="club-history-cell-tags">${badges || '<span class="club-tag is-muted">—</span>'}</td>
        </tr>`;
    }).join('')
    : '';

  const historyBlock = profile.seasonHistory.length
    ? `<div class="club-history-scroll">
        <table class="club-history-table">
          <thead>
            <tr>
              <th>${t('clubHistoryColSeason')}</th>
              <th>${t('clubHistoryColDivision')}</th>
              <th>${t('clubHistoryColPos')}</th>
              <th>${t('pts')}</th>
              <th>${t('tabCopa')}</th>
              <th>${t('clubPopularity')}</th>
              <th>${t('clubHistoryColNotes')}</th>
            </tr>
          </thead>
          <tbody>${historyHtml}</tbody>
        </table>
      </div>`
    : `<p class="club-history-empty">${t('clubHistoryEmpty')}</p>`;

  els.clubPanel.innerHTML = `
    <div class="club-layout">
      <section class="club-hero card card-elevated club-tier-${tier}">
        <div class="club-hero-glow" aria-hidden="true"></div>
        <div class="club-hero-main">
          <div class="club-hero-id">
            <div class="club-crest-edit-wrap">
              ${renderPlayerShieldHtml(state.clubName, 'club-shield-hero')}
              <button type="button" class="btn btn-primary club-crest-edit-btn" onclick="window.openCrestEditor()">
                ${t('crestEditBtn')}
              </button>
            </div>
            <div class="club-hero-copy">
              <span class="club-hero-kicker">${t('clubTitle')}</span>
              <h2 class="club-hero-name">${esc(state.clubName)}</h2>
              <div class="club-hero-pills">
                <span class="club-pill">${esc(divisionLabel(state.playerDivision))}</span>
                <span class="club-pill">${t('seasonShort', { n: state.season })}</span>
              </div>
            </div>
          </div>
          <div class="club-hero-pop">
            <div class="club-pop-head">
              <span class="club-pop-label">${t('clubPopularity')}</span>
              <p class="club-pop-tier-name">
                <span class="club-pop-tier-dot club-pop-tier-dot-${tier}" aria-hidden="true"></span>
                ${popularityTierLabel(tier)}
              </p>
            </div>
            <div class="club-pop-score">
              <span class="club-pop-value">${pop}</span>
              <span class="club-pop-max">/100</span>
            </div>
            <div class="club-pop-track" role="presentation">
              <div class="club-pop-fill" style="width:${pop}%"></div>
              <span class="club-pop-tick" style="left:20%"></span>
              <span class="club-pop-tick" style="left:40%"></span>
              <span class="club-pop-tick" style="left:60%"></span>
              <span class="club-pop-tick" style="left:80%"></span>
            </div>
          </div>
        </div>
      </section>

      <div class="club-stats-row">
        <div class="club-stat-tile">
          <span class="club-stat-label">${t('clubTrophies')}</span>
          <strong class="club-stat-value">${trophyCount}</strong>
        </div>
        <div class="club-stat-tile">
          <span class="club-stat-label">${t('clubStatLeagueTitles')}</span>
          <strong class="club-stat-value">${leagueTitles}</strong>
        </div>
        <div class="club-stat-tile">
          <span class="club-stat-label">${t('tabCopa')}</span>
          <strong class="club-stat-value">${copaTitles}</strong>
        </div>
      </div>

      <div class="club-grid">
        <section class="club-card card card-elevated">
          <div class="card-head">
            <h3>${t('clubTrophies')}</h3>
            <span class="card-tag">${trophyCount}</span>
          </div>
          <div class="club-trophy-shelf">${trophiesHtml}</div>
        </section>

        <section class="club-card card card-elevated club-history-card">
          <div class="card-head">
            <h3>${t('clubHistory')}</h3>
          </div>
          ${historyBlock}
        </section>
      </div>
    </div>`;
}

function renderNews() {
  els.newsFeed.innerHTML = state.news.slice(0, MAX_CLUB_NEWS).map(n => `
    <li class="news-item">
      ${n.round > 0 ? `<span class="news-round">R${n.round}</span>` : '<span class="news-round news-general">•</span>'}
      <span class="news-text">${esc(n.text)}</span>
    </li>`
  ).join('') || `<li class="empty-msg">${t('noNews')}</li>`;
}

// ─── Tabs ───
window.switchTab = function(tabName) {
  if (state.gameStarted && !canAccessTab(state, tabName)) return;
  if (state.gameStarted) playUiClick();
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tabName}`));
  els.screenGame?.classList.toggle('match-focus', tabName === 'match');
  if (tabName === 'league' && state.gameStarted) {
    renderStandingsWithOptionalAnim();
  } else if (tabName === 'stats' && state.gameStarted) {
    renderSeasonStats();
  } else if (tabName === 'copa' && state.gameStarted) {
    renderCopa(true);
  } else if (tabName === 'market' && state.gameStarted) {
    syncMarketTierFilter();
    filterMarket();
    maybeShowMarketTutorial();
  } else if (tabName === 'upgrades' && state.gameStarted) {
    renderUpgrades();
  } else if (tabName === 'club' && state.gameStarted) {
    renderClub();
  }
  handleOnboardingTabEnter(tabName);
  refreshOnboardingUI();
};

function renderAll() {
  updateDashboard();
  renderClub();
  renderUpgrades();
  renderSquad();
  renderStandings();
  renderSeasonStats();
  renderFixtures();
  renderCopa();
  filterMarket();
  refreshOnboardingUI();
  scheduleGameSave(state);
}

function installScreenshotDemoHooks() {
  if (!location.search.includes('demo=screenshots')) return;

  window.debugShowReinforcementPrompt = function() {
    ensureReinforcement();
    const picks = pickMarketSuggestions(
      getScoutReachPlayerList(),
      getSignedIds(),
      canNegotiateMarketPlayer,
      calcPrice,
      3
    );
    const zag = state.lineup.find(s => s.slotPos === 'ZAG')?.player;
    state.reinforcementPrompt.pending = {
      sector: 'def',
      scapegoatId: zag?.playerId ?? null,
      scapegoatName: zag?.name ?? null,
      playerIds: picks.map(p => p.playerId),
      textKey: zag?.name ? 'reinfDefName0' : 'reinfDefGeneric0',
      subtitleKey: 'reinfListSubtitle0',
      specialCase: !picks.length ? 'noBudget' : picks.length < 3 ? 'fewOptions' : null,
      round: getPlayerClub().stats.played || 3
    };
    showPendingReinforcementPrompt();
  };

  window.debugSetPlayerCrest = function(config) {
    savePlayerCrestToStorage(config);
    if (state.gameStarted) {
      applyPlayerShieldEl(els.clubShield, state.clubName);
      renderClub();
    }
  };

  window.debugShowSeasonEnd = function(mood = 'champion') {
    const div = state.playerDivision || 2;
    const lg = leagueByDiv(div);
    let standings = getStandings(lg.teams);
    const playerTeam = standings.find(tm => tm.isPlayer);

    if (mood === 'champion' && playerTeam) {
      const rest = standings.filter(tm => !tm.isPlayer);
      standings = [
        { ...playerTeam, stats: { ...playerTeam.stats, points: 78, played: 38, won: 24, drawn: 6, lost: 8, gf: 62, ga: 28 } },
        ...rest.map((tm, i) => ({
          ...tm,
          stats: { ...tm.stats, points: Math.max(55, 74 - i * 3) }
        }))
      ];
    }

    const oldSnapshot = captureStandingsSnapshot(standings);
    const allStandings = {
      1: getStandings(state.serieA.teams),
      2: getStandings(state.serieB.teams),
      3: getStandings(state.serieC.teams)
    };
    if (mood === 'champion' && playerTeam) {
      allStandings[div] = standings;
    }
    const nextDivNum = mood === 'relegation'
      ? Math.min(3, div + 1)
      : mood === 'promotion'
        ? Math.max(1, div - 1)
        : div;
    state.pendingSeasonEnd = {
      season: state.season,
      clubName: state.clubName,
      championName: mood === 'champion' ? state.clubName : standings[0].name,
      isPlayerChampion: mood === 'champion',
      playerPos: mood === 'relegation'
        ? standings.length
        : mood === 'champion'
          ? 1
          : standings.findIndex(tm => tm.isPlayer) + 1,
      divName: divisionLabel(div),
      divisionBefore: div,
      nextDiv: divisionLabel(nextDivNum),
      points: mood === 'relegation' ? 28 : mood === 'champion' ? 78 : getPlayerClub().stats.points,
      standings,
      oldSnapshot,
      drama: mood === 'relegation' ? 'relegation-last-day' : mood === 'promotion' ? 'promotion-last-day' : mood === 'escape' ? 'narrow-escape' : null,
      mood,
      seasonPrize: calcLeagueSeasonPrize(div, mood === 'champion' ? 1 : standings.findIndex(tm => tm.isPlayer) + 1, mood === 'champion'),
      lastMatch: mood === 'relegation'
        ? { playerGoals: 0, opponentGoals: 2, opponent: 'Avaí' }
        : { playerGoals: 2, opponentGoals: 1, opponent: 'Rival FC' },
      leaguesSummary: [1, 2, 3].map(d => ({
        division: d,
        label: divisionLabel(d),
        standings: allStandings[d]
      }))
    };
    showSeasonEndScreen();
  };
}

installScreenshotDemoHooks();

function installPlaytestHooks() {
  if (!location.search.includes('playtest=discipline')) return;

  window.auditDisciplineUI = function auditDisciplineUI() {
    renderSquad();
    const issues = [];

    for (const p of state.squad) {
      const stamp = getDisciplineStampState(p);
      const d = p.discipline;
      const needsSentOff = stamp.sentOff;
      const needsInjured = stamp.injured;
      if (!needsSentOff && !needsInjured) {
        if (d?.suspensionReason === 'accumulation' && (d.gamesOut || 0) > 0) {
          const safeId = CSS.escape(p.playerId);
          const card = document.querySelector(`.pitch-slot[data-player-id="${safeId}"] .slot-card`)
            || document.querySelector(`.player-card[data-player-id="${safeId}"]`);
          if (card?.querySelector('.slot-discipline-stamp.sent-off')) {
            issues.push({ player: p.name, type: 'wrong-stamp-on-accumulation' });
          }
        }
        continue;
      }

      const safeId = CSS.escape(p.playerId);
      const pitchCard = document.querySelector(`.pitch-slot[data-player-id="${safeId}"] .slot-card`);
      const benchCard = document.querySelector(`.player-card[data-player-id="${safeId}"]`);
      const card = pitchCard || benchCard;

      if (!card) {
        issues.push({ player: p.name, type: 'card-not-found', stamp, reason: d?.suspensionReason });
        continue;
      }

      if (needsSentOff) {
        const ok = card.classList.contains('has-sent-off')
          && card.querySelector('.slot-discipline-stamp.sent-off');
        if (!ok) {
          issues.push({
            player: p.name,
            type: 'missing-sent-off-dom',
            stamp,
            reason: d?.suspensionReason
          });
        }
      }
      if (needsInjured) {
        const ok = card.classList.contains('has-injured')
          && card.querySelector('.slot-discipline-stamp.injured');
        if (!ok) issues.push({ player: p.name, type: 'missing-injured-dom', stamp });
      }
    }

    return {
      unavailable: getUnavailableCount(state.squad),
      stamped: state.squad.filter(p => {
        const s = getDisciplineStampState(p);
        return s.sentOff || s.injured;
      }).length,
      mustStamp: state.squad.filter(p => shouldShowSentOffStamp(p.discipline) || getDisciplineStampState(p).injured).length,
      issues,
      ok: issues.length === 0
    };
  };
}

installPlaytestHooks();

init();

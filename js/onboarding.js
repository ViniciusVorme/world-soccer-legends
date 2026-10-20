/** Tutorial guiado de onboarding (1ª partida). */

import { getPlayerTier, MARKET_POOL_SIZE } from './market-scouts.js';

export const ONBOARDING_ENABLED = true;
export const TUTORIAL_BUDGET_BONUS = 7;
export const TUTORIAL_SIGN_PRICE = 4;

export const ONBOARDING_STEPS = {
  WELCOME: 'welcome',
  GO_MARKET_TAB: 'go_market_tab',
  MARKET_BROWSE: 'market_browse',
  MARKET_POPUP: 'market_popup',
  GO_UPGRADES: 'go_upgrades',
  UPGRADE_SCOUT: 'upgrade_scout',
  BACK_MARKET_POPUP: 'back_market_popup',
  GO_MARKET_SIGN_TAB: 'go_market_sign_tab',
  SIGN_TARGET: 'sign_target',
  GO_SQUAD_TAB: 'go_squad_tab',
  GO_SQUAD_BENCH: 'go_squad_bench',
  GO_SQUAD_LINEUP: 'go_squad_lineup',
  DONE: 'done'
};

export function createOnboardingState() {
  return {
    active: false,
    step: ONBOARDING_STEPS.DONE,
    completed: false,
    tutorialPlayerId: null,
    budgetGranted: false,
    scoutUpgraded: false
  };
}

export function ensureOnboarding(state) {
  if (!state.onboarding) state.onboarding = createOnboardingState();
  return state.onboarding;
}

export function isOnboardingComplete(state) {
  if (!ONBOARDING_ENABLED) return true;
  const ob = ensureOnboarding(state);
  return ob.completed || ob.step === ONBOARDING_STEPS.DONE;
}

export function isOnboardingActive(state) {
  if (!ONBOARDING_ENABLED) return false;
  const ob = ensureOnboarding(state);
  return ob.active && !ob.completed && ob.step !== ONBOARDING_STEPS.DONE;
}

export function getOnboardingStep(state) {
  return ensureOnboarding(state).step;
}

export function getTutorialPlayerId(state) {
  return ensureOnboarding(state).tutorialPlayerId;
}

export function isTutorialTargetPlayer(state, playerId) {
  return isOnboardingActive(state)
    && getOnboardingStep(state) === ONBOARDING_STEPS.SIGN_TARGET
    && playerId === getTutorialPlayerId(state);
}

export function startOnboarding(state) {
  if (!ONBOARDING_ENABLED) return;
  const ob = ensureOnboarding(state);
  ob.active = true;
  ob.completed = false;
  ob.step = ONBOARDING_STEPS.WELCOME;
  ob.tutorialPlayerId = null;
  ob.budgetGranted = false;
  ob.scoutUpgraded = false;
}

export function advanceOnboarding(state, step) {
  const ob = ensureOnboarding(state);
  ob.step = step;
  if (step === ONBOARDING_STEPS.DONE) {
    ob.active = false;
    ob.completed = true;
  }
}

export function skipOnboarding(state) {
  advanceOnboarding(state, ONBOARDING_STEPS.DONE);
}

export function getAllowedTabForStep(step) {
  switch (step) {
    case ONBOARDING_STEPS.GO_MARKET_TAB:
    case ONBOARDING_STEPS.MARKET_BROWSE:
    case ONBOARDING_STEPS.MARKET_POPUP:
    case ONBOARDING_STEPS.GO_MARKET_SIGN_TAB:
    case ONBOARDING_STEPS.SIGN_TARGET:
      return 'market';
    case ONBOARDING_STEPS.GO_UPGRADES:
    case ONBOARDING_STEPS.UPGRADE_SCOUT:
    case ONBOARDING_STEPS.BACK_MARKET_POPUP:
      return 'upgrades';
    case ONBOARDING_STEPS.GO_SQUAD_TAB:
    case ONBOARDING_STEPS.GO_SQUAD_BENCH:
    case ONBOARDING_STEPS.GO_SQUAD_LINEUP:
      return 'squad';
    default:
      return 'dashboard';
  }
}

export function canAccessTab(state, tabName) {
  if (!isOnboardingActive(state)) return true;
  const step = getOnboardingStep(state);
  if (step === ONBOARDING_STEPS.WELCOME) {
    return tabName === 'dashboard';
  }
  if (step === ONBOARDING_STEPS.GO_MARKET_TAB) {
    return tabName === 'dashboard' || tabName === 'market';
  }
  if (step === ONBOARDING_STEPS.MARKET_POPUP) {
    return tabName === 'market';
  }
  if (step === ONBOARDING_STEPS.GO_UPGRADES) {
    return tabName === 'market' || tabName === 'upgrades';
  }
  if (step === ONBOARDING_STEPS.BACK_MARKET_POPUP) {
    return tabName === 'upgrades';
  }
  if (step === ONBOARDING_STEPS.GO_MARKET_SIGN_TAB) {
    return tabName === 'upgrades' || tabName === 'market';
  }
  if (step === ONBOARDING_STEPS.GO_SQUAD_TAB) {
    return tabName === 'market' || tabName === 'squad';
  }
  if (step === ONBOARDING_STEPS.GO_SQUAD_BENCH || step === ONBOARDING_STEPS.GO_SQUAD_LINEUP) {
    return tabName === 'squad';
  }
  return tabName === getAllowedTabForStep(step);
}

export function pickTutorialTargetPlayer(allPlayers, signedIds) {
  const candidates = allPlayers.filter(p => {
    if (signedIds.has(p.playerId)) return false;
    if (p.legend) return false;
    if (getPlayerTier(p) !== 'T2') return false;
    const force = p.force ?? 0;
    return force >= 76 && force <= 79;
  });
  candidates.sort((a, b) => (b.force - a.force) || a.playerId.localeCompare(b.playerId));
  return candidates[0]?.playerId ?? null;
}

export function injectTutorialPlayerIntoPool(state, playerId) {
  if (!playerId || !state.marketPool?.playerIds) return;
  const ids = state.marketPool.playerIds.filter(id => id !== playerId);
  ids.unshift(playerId);
  state.marketPool.playerIds = ids.slice(0, MARKET_POOL_SIZE);
}

export function grantTutorialBudgetIfNeeded(state, addNews, t, formatMoney, adjustBudget) {
  const ob = ensureOnboarding(state);
  if (ob.budgetGranted) return;
  ob.budgetGranted = true;
  adjustBudget(TUTORIAL_BUDGET_BONUS);
  addNews(t('newsTutorialBudget', { amount: formatMoney(TUTORIAL_BUDGET_BONUS) }));
}

export function buildOnboardingPopupHtml(step, t, esc) {
  const actions = {
    [ONBOARDING_STEPS.WELCOME]: `
      <button type="button" class="btn btn-primary" data-onboarding-action="ack_director">${t('onboardingGoMarket')}</button>`,
    [ONBOARDING_STEPS.MARKET_POPUP]: `
      <button type="button" class="btn btn-primary" data-onboarding-action="ack_market_popup">${t('onboardingGoUpgrades')}</button>`,
    [ONBOARDING_STEPS.BACK_MARKET_POPUP]: `
      <button type="button" class="btn btn-primary" data-onboarding-action="ack_back_market">${t('onboardingGoMarket')}</button>`,
    [ONBOARDING_STEPS.GO_SQUAD_BENCH]: `
      <button type="button" class="btn btn-primary" data-onboarding-action="ack_squad_bench">${t('onboardingContinue')}</button>`,
    [ONBOARDING_STEPS.DONE]: `
      <button type="button" class="btn btn-primary" data-onboarding-action="finish">${t('onboardingContinue')}</button>`
  };

  const titles = {
    [ONBOARDING_STEPS.WELCOME]: t('onboardingWelcomeTitle'),
    [ONBOARDING_STEPS.MARKET_POPUP]: t('onboardingMarketWeakTitle'),
    [ONBOARDING_STEPS.BACK_MARKET_POPUP]: t('onboardingBackMarketTitle'),
    [ONBOARDING_STEPS.GO_SQUAD_BENCH]: t('onboardingOverlayBench'),
    [ONBOARDING_STEPS.DONE]: t('onboardingDoneTitle')
  };

  const bodies = {
    [ONBOARDING_STEPS.WELCOME]: t('onboardingWelcomeLead'),
    [ONBOARDING_STEPS.MARKET_POPUP]: t('onboardingMarketWeakLead'),
    [ONBOARDING_STEPS.BACK_MARKET_POPUP]: t('onboardingBackMarketLead'),
    [ONBOARDING_STEPS.GO_SQUAD_BENCH]: t('onboardingBenchLead'),
    [ONBOARDING_STEPS.DONE]: t('onboardingDoneLead')
  };

  return `
    <div class="tutorial-modal onboarding-modal">
      <h3 class="tutorial-modal-title">${esc(titles[step] || '')}</h3>
      <p class="tutorial-modal-lead">${bodies[step] || ''}</p>
      <div class="tutorial-modal-actions">${actions[step] || ''}</div>
    </div>`;
}

export function getOnboardingOverlayTarget(step, state) {
  switch (step) {
    case ONBOARDING_STEPS.GO_MARKET_TAB:
    case ONBOARDING_STEPS.GO_MARKET_SIGN_TAB:
      return { selector: '.tab[data-tab="market"]', hintKey: 'onboardingGoMarket', arrow: 'down', isTab: true };
    case ONBOARDING_STEPS.GO_UPGRADES:
      return { selector: '.tab[data-tab="upgrades"]', hintKey: 'onboardingOverlayUpgrades', arrow: 'down', isTab: true };
    case ONBOARDING_STEPS.GO_SQUAD_TAB:
      return { selector: '.tab[data-tab="squad"]', hintKey: 'onboardingGoSquad', arrow: 'down', isTab: true };
    case ONBOARDING_STEPS.GO_SQUAD_BENCH: {
      const playerId = getTutorialPlayerId(state);
      if (!playerId) return null;
      return {
        selector: `#bench-list .player-card[data-player-id="${CSS.escape(playerId)}"]`,
        hintKey: 'onboardingOverlayBench',
        hintAction: 'ack_squad_bench',
        arrow: 'up'
      };
    }
    case ONBOARDING_STEPS.UPGRADE_SCOUT:
      return { selector: '.scout-dept-card .upgrade-tile-action .btn-primary', hintKey: 'onboardingOverlayUpgradeBtn', arrow: 'down' };
    case ONBOARDING_STEPS.SIGN_TARGET:
      return { selector: '.market-card.is-tutorial-pick', hintKey: 'onboardingOverlaySign', arrow: 'down' };
    case ONBOARDING_STEPS.GO_SQUAD_LINEUP:
      return { selector: '#btn-auto-lineup', hintKey: 'onboardingOverlayLineup', arrow: 'down' };
    default:
      return null;
  }
}

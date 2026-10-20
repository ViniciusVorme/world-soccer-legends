/** Tutorial guiado — flags e conteúdo das telas de ajuda. */

/** Tutorial do mercado na 1ª visita após onboarding + 1ª partida. */
export const MARKET_TUTORIAL_ENABLED = true;

export function createTutorialState() {
  return {
    marketIntro: false
  };
}

export function ensureTutorialState(state) {
  if (!state.tutorials) state.tutorials = createTutorialState();
  return state.tutorials;
}

export function hasSeenTutorial(state, key) {
  return ensureTutorialState(state)[key] === true;
}

export function markTutorialSeen(state, key) {
  ensureTutorialState(state)[key] = true;
}

export function buildScoutHelpHtml(t) {
  const rows = [
    ['scoutHelpModest', 'scoutHelpModestRange'],
    ['scoutHelpProspect', 'scoutHelpProspectRange'],
    ['scoutHelpGood', 'scoutHelpGoodRange'],
    ['scoutHelpStrong', 'scoutHelpStrongRange'],
    ['scoutHelpElite', 'scoutHelpEliteRange'],
    ['scoutHelpLegend', 'scoutHelpLegendRange']
  ];

  return `
    <div class="tutorial-modal scout-help-modal">
      <h3 class="tutorial-modal-title">${t('scoutHelpTitle')}</h3>
      <p class="tutorial-modal-lead">${t('scoutHelpLead')}</p>
      <dl class="scout-help-list">
        ${rows.map(([labelKey, rangeKey]) => `
          <div class="scout-help-row">
            <dt>${t(labelKey)}</dt>
            <dd>${t(rangeKey)}</dd>
          </div>`).join('')}
      </dl>
      <div class="tutorial-modal-actions">
        <button type="button" class="btn btn-primary" onclick="window.closeScoutHelpModal()">${t('scoutHelpGotIt')}</button>
      </div>
    </div>`;
}

export function buildMarketTutorialHtml(t) {
  const bullets = [
    t('marketTutorialBullet1'),
    t('marketTutorialBullet2'),
    t('marketTutorialBullet3'),
    t('marketTutorialBullet4'),
    t('marketTutorialBullet5')
  ];

  return `
    <div class="tutorial-modal">
      <h3 class="tutorial-modal-title">${t('marketTutorialTitle')}</h3>
      <p class="tutorial-modal-lead">${t('marketTutorialLead')}</p>
      <ul class="tutorial-modal-list">
        ${bullets.map(line => `<li>${line}</li>`).join('')}
      </ul>
      <div class="tutorial-modal-actions">
        <button type="button" class="btn btn-primary" onclick="window.closeMarketTutorial()">${t('marketTutorialGotIt')}</button>
      </div>
    </div>`;
}

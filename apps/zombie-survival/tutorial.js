const steps = [
  'Use WASD ou as setas para se mover. No telemóvel, use o joystick.',
  'Aponte com o rato na direção do alvo.',
  'Clique para disparar. Mantenha o botão premido para fogo contínuo.',
  'Prima R para recarregar a arma atual.',
  'Use 1-9, 0 ou a roda do rato para trocar de arma.',
  'Mantenha SHIFT enquanto se move para correr.',
  'Prima ESPAÇO para fazer um dash e escapar do perigo.',
  'Prima F para atacar com a arma corpo a corpo.'
];

let currentStep = 0;
let onComplete = null;

export function startTutorial(onDone) {
  currentStep = 0;
  onComplete = onDone;
  const screen = document.getElementById('tutorial-screen');
  screen.classList.add('tutorial-overlay');
  screen.classList.remove('hidden');
  renderTutorialStep();
}

export function advanceTutorial() {
  currentStep += 1;
  if (currentStep >= steps.length) {
    finishTutorial();
    return;
  }
  renderTutorialStep();
}

export function finishTutorial() {
  const screen = document.getElementById('tutorial-screen');
  screen.classList.add('hidden');
  screen.classList.remove('tutorial-overlay');
  const onDone = onComplete;
  onComplete = null;
  onDone?.();
}

function renderTutorialStep() {
  const message = document.getElementById('tutorial-message');
  const progress = document.getElementById('tutorial-progress');
  const nextButton = document.getElementById('tutorial-next-btn');

  message.textContent = steps[currentStep];
  progress.textContent = `Passo ${currentStep + 1}/${steps.length}`;
  nextButton.textContent = currentStep === steps.length - 1 ? 'COMEÇAR SOBREVIVÊNCIA' : 'CONTINUAR';
}
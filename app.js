const EngineState = {
  TRANSITIONING: 'TRANSITIONING',
  AWAITING_INPUT: 'AWAITING_INPUT',
  LOCKED_ANSWERED: 'LOCKED_ANSWERED'
};

let currentEngineState = EngineState.TRANSITIONING;
let globalLifecycleToken = 0;
let activeEngineMode = 'adaptive';
let streak = 1;
let totalSolved = 0;

const timerRegistry = new Set();
function registerTimeout(fn, delay) {
  const id = setTimeout(() => {
    timerRegistry.delete(id);
    fn();
  }, delay);
  timerRegistry.add(id);
  return id;
}

function clearAllActiveTimers() {
  timerRegistry.forEach(id => clearTimeout(id));
  timerRegistry.clear();
}

const ProblemGenerators = {
  spatial: () => {
    const symbols = ['▲', '■', '◆', '●', '★', '✚'];
    const s1 = symbols[Math.floor(Math.random() * symbols.length)];
    const s2 = symbols[Math.floor(Math.random() * symbols.length)];
    return {
      domain: 'Spatial Rotation',
      text: `Analyze the coordinate orientation [ ${s1} ➔ ${s2} ]. If transformed by 90° clockwise, which relative axis holds true?`,
      renderVisual: (container) => {
        container.innerHTML = `
          <div style="font-size: 2rem; display: flex; gap: 20px; align-items: center;">
            <div style="border: 2px solid #334155; padding: 10px 16px; border-radius: 8px;">${s1}</div>
            <span>➔</span>
            <div style="border: 2px dashed #6366f1; padding: 10px 16px; border-radius: 8px;">${s2}</div>
          </div>
        `;
      },
      options: [
        { id: 'A', text: `${s1} occupies inverted horizontal axis` },
        { id: 'B', text: `${s2} maps perpendicular to origin` },
        { id: 'C', text: `${s1} mirrors across vertical plane` },
        { id: 'D', text: `${s2} reflects directly along diagonal` }
      ],
      correctId: 'B',
      explanation: 'A 90° clockwise affine rotation remaps the horizontal unit vector directly onto the perpendicular downward orthogonal axis.'
    };
  },

  memory: (token) => {
    const activeCells = [];
    while (activeCells.length < 3) {
      const cell = Math.floor(Math.random() * 9);
      if (!activeCells.includes(cell)) activeCells.push(cell);
    }
    const targetCell = activeCells[0];
    const row = Math.floor(targetCell / 3) + 1;
    const col = (targetCell % 3) + 1;

    return {
      domain: 'Working Memory',
      text: 'Working Memory Retention: A 3-node cluster will illuminate for 2 seconds. Retain the matrix coordinates!',
      renderVisual: (container) => {
        let gridHtml = '<div style="display: grid; grid-template-columns: repeat(3, 44px); gap: 6px;">';
        for (let i = 0; i < 9; i++) {
          const isLit = activeCells.includes(i);
          gridHtml += `<div id="mem-cell-${i}" style="width:44px; height:44px; border-radius:6px; background:${isLit ? '#f59e0b' : '#1e293b'}; border:1px solid #334155;"></div>`;
        }
        gridHtml += '</div>';
        gridHtml += `
          <div class="countdown-bar-wrap">
            <div id="memory-progress" class="countdown-bar-fill"></div>
          </div>
        `;
        container.innerHTML = gridHtml;

        const prog = document.getElementById('memory-progress');
        if (prog) {
          prog.style.transition = 'width 2000ms linear';
          requestAnimationFrame(() => { prog.style.width = '0%'; });
        }

        registerTimeout(() => {
          if (token !== globalLifecycleToken) return;
          for (let i = 0; i < 9; i++) {
            const el = document.getElementById(`mem-cell-${i}`);
            if (el) el.style.background = '#1e293b';
          }
        }, 2000);
      },
      options: [
        { id: 'A', text: `Node at Row ${row}, Col ${col}` },
        { id: 'B', text: `Node at Row ${row === 1 ? 3 : 1}, Col ${col}` },
        { id: 'C', text: `Node at Row ${row}, Col ${col === 1 ? 3 : 1}` },
        { id: 'D', text: `Node at Row 2, Col 2` }
      ],
      correctId: 'A',
      explanation: `Cell index ${targetCell} indexes strictly to row coordinate ${row} and column coordinate ${col} in a 3-wide matrix array.`
    };
  },

  logic: () => {
    return {
      domain: 'Deductive Logic',
      text: 'Rule Matrix: Entity A is strictly faster than B. Entity C is slower than B, but faster than D. Which sequence is universally consistent?',
      renderVisual: (container) => {
        container.innerHTML = `<div style="font-family: monospace; color: #94a3b8; font-size: 0.95rem;">[ A > B ] ∧ [ B > C > D ]</div>`;
      },
      options: [
        { id: 'A', text: 'D > A > B > C' },
        { id: 'B', text: 'A > C > B > D' },
        { id: 'C', text: 'A > B > C > D' },
        { id: 'D', text: 'B > A > D > C' }
      ],
      correctId: 'C',
      explanation: 'By direct transitive deduction: A precedes B, and B precedes C which precedes D. Therefore, A > B > C > D is uniquely acyclic and valid.'
    };
  }
};

let activeProblemInstance = null;

function renderProblem() {
  globalLifecycleToken++;
  const thisToken = globalLifecycleToken;

  currentEngineState = EngineState.TRANSITIONING;
  clearAllActiveTimers();

  const optionsContainer = document.getElementById('optionsContainer');
  const visualWorkspace = document.getElementById('visual-workspace');
  const feedbackBox = document.getElementById('feedbackBox');
  const explainDrawer = document.getElementById('explanationDrawer');
  const btnNext = document.getElementById('btn-next');
  const btnExplainToggle = document.getElementById('btn-toggle-explain');

  optionsContainer.replaceChildren();
  visualWorkspace.replaceChildren();
  feedbackBox.className = 'feedback-box';
  feedbackBox.textContent = '';
  explainDrawer.className = 'explanation-details';
  explainDrawer.textContent = '';
  btnNext.disabled = true;
  btnExplainToggle.style.display = 'none';

  const generators = [ProblemGenerators.spatial, ProblemGenerators.memory, ProblemGenerators.logic];
  const selectedGenerator = generators[Math.floor(Math.random() * generators.length)];
  activeProblemInstance = selectedGenerator(thisToken);

  document.getElementById('domain-label').textContent = activeProblemInstance.domain;
  document.getElementById('question-text').textContent = activeProblemInstance.text;
  activeProblemInstance.renderVisual(visualWorkspace);

  activeProblemInstance.options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'opt-btn';
    btn.dataset.id = opt.id;
    btn.innerHTML = `<span class="opt-tag">${opt.id}</span> <span>${opt.text}</span>`;
    btn.onclick = () => handleOptionSelection(opt.id, thisToken);
    optionsContainer.appendChild(btn);
  });

  currentEngineState = EngineState.AWAITING_INPUT;
}

function handleOptionSelection(selectedId, token) {
  if (token !== globalLifecycleToken || currentEngineState !== EngineState.AWAITING_INPUT) {
    return;
  }

  currentEngineState = EngineState.LOCKED_ANSWERED;

  const isCorrect = selectedId === activeProblemInstance.correctId;
  const optionsContainer = document.getElementById('optionsContainer');
  const buttons = optionsContainer.querySelectorAll('.opt-btn');

  buttons.forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.id === activeProblemInstance.correctId) {
      btn.classList.add('correct');
    } else if (btn.dataset.id === selectedId) {
      btn.classList.add('wrong');
    }
  });

  const feedback = document.getElementById('feedbackBox');
  if (isCorrect) {
    feedback.className = 'feedback-box correct';
    feedback.textContent = 'Correct. Heuristic pattern verified.';
    totalSolved++;
    document.getElementById('solved-count').textContent = totalSolved;
  } else {
    feedback.className = 'feedback-box wrong';
    feedback.textContent = `Constraint Discrepancy. Target resolution was Option ${activeProblemInstance.correctId}.`;
  }

  const drawer = document.getElementById('explanationDrawer');
  drawer.textContent = activeProblemInstance.explanation;
  document.getElementById('btn-toggle-explain').style.display = 'inline-block';

  document.getElementById('btn-next').disabled = false;
}

function triggerReveal() {
  if (currentEngineState !== EngineState.AWAITING_INPUT) return;
  handleOptionSelection('NONE', globalLifecycleToken);
}

function requestNextQuestion() {
  if (currentEngineState !== EngineState.LOCKED_ANSWERED) return;
  renderProblem();
}

function toggleExplanation() {
  const drawer = document.getElementById('explanationDrawer');
  drawer.classList.toggle('open');
}

function switchEngine(mode) {
  if (activeEngineMode === mode) return;
  activeEngineMode = mode;
  document.getElementById('tab-adaptive').classList.toggle('active', mode === 'adaptive');
  document.getElementById('tab-curated').classList.toggle('active', mode === 'curated');
  renderProblem();
}

window.addEventListener('DOMContentLoaded', () => {
  renderProblem();
});

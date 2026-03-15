/**
 * Stroke Order Lab — app.js (Polished v4)
 * Full rewrite: Flutter-ported features, micro-animations, haptic feedback, mobile gestures.
 * Keeps HanziWriter as rendering engine.
 */

'use strict';

// ═══════════════════════════════════════════════
//  State
// ═══════════════════════════════════════════════
const State = {
  char: '永',
  strokeCount: 0,
  currentStroke: 0,
  isAnimating: false,
  isLooping: false,
  isInQuiz: false,
  isBusy: false,

  animSpeed: 1.0,
  hintSpeed: 3.0,
  showOutline: true,
  showBackground: false,
  showGrid: false,
  showMedians: false,
  showUserStrokes: false,
  highlightRadical: false,
  hintAfterMisses: 3,
  drawWidth: 20,

  strokeColor: '#c0392b',
  radicalColor: '#e8a000',
  outlineColor: '#ddd0b8',
  drawingColor: '#333333',

  theme: 'light',

  // Quiz tracking (ported from Flutter QuizSummary)
  quizMistakes: [],
  quizStrokePaths: [],
  quizTotalMistakes: 0,
};

let writer = null;
let charData = null; // raw character data for speed normalization

const $ = id => document.getElementById(id);
const SETTINGS_KEY = 'hz_settings_v2';
const RECENT_KEY = 'hz_recent_v1';

// ═══════════════════════════════════════════════
//  Persistence
// ═══════════════════════════════════════════════
const SAVED_KEYS = [
  'animSpeed', 'hintSpeed', 'showOutline', 'showBackground', 'showGrid', 'showMedians',
  'showUserStrokes', 'highlightRadical', 'hintAfterMisses', 'drawWidth',
  'strokeColor', 'radicalColor', 'outlineColor', 'drawingColor', 'theme'
];

function saveSettings() {
  const o = {};
  SAVED_KEYS.forEach(k => o[k] = State[k]);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(o));
}

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    Object.keys(s).forEach(k => { if (k in State) State[k] = s[k]; });
  } catch (_) { }
}

// ═══════════════════════════════════════════════
//  Haptic Feedback
// ═══════════════════════════════════════════════
function haptic(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

function hapticTap() { haptic(15); }
function hapticBuzz() { haptic(100); }
function hapticSuccess() { haptic([50, 30, 50, 30, 50]); }

// ═══════════════════════════════════════════════
//  Animated Status Bar
// ═══════════════════════════════════════════════
let statusTimeout = null;
function setStatus(msg) {
  const bar = $('status');

  // Remove all existing status text elements
  const oldTexts = bar.querySelectorAll('.status-text');
  oldTexts.forEach(el => {
    el.classList.add('exit');
  });

  clearTimeout(statusTimeout);
  statusTimeout = setTimeout(() => {
    bar.querySelectorAll('.status-text.exit').forEach(el => el.remove());
  }, 220);

  const span = document.createElement('span');
  span.className = 'status-text enter';
  span.textContent = msg;
  bar.appendChild(span);

  // Remove enter class after animation
  setTimeout(() => span.classList.remove('enter'), 400);
}

// ═══════════════════════════════════════════════
//  Boot
// ═══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  applyInitialUI();

  // Input
  $('loadBtn').addEventListener('click', loadCharacter);
  $('charInput').addEventListener('keydown', e => { if (e.key === 'Enter') loadCharacter(); });

  // Playback controls
  $('animateBtn').addEventListener('click', () => { hapticTap(); togglePlay(); });
  $('showFullBtn').addEventListener('click', () => { hapticTap(); showFullCharacter(); });
  $('resetBtn').addEventListener('click', () => { hapticTap(); resetCharacter(); });
  $('prevBtn').addEventListener('click', () => { hapticTap(); prevStroke(); });
  $('nextBtn').addEventListener('click', () => { hapticTap(); nextStroke(); });

  // Sidebar
  $('sidebarToggle').addEventListener('click', () => { hapticTap(); toggleSidebar(); });

  // Speed — dynamically update the writer's internal speed
  $('speedSlider').addEventListener('input', e => {
    State.animSpeed = parseFloat(e.target.value);
    $('speedValue').textContent = State.animSpeed.toFixed(1) + '×';
    if (writer && writer._options) {
      writer._options.strokeAnimationSpeed = State.animSpeed;
    }
    saveSettings();
  });

  // Loop
  $('loopToggle').addEventListener('change', e => { State.isLooping = e.target.checked; });

  // Display toggles
  $('outlineToggle').addEventListener('change', e => {
    State.showOutline = e.target.checked;
    syncVisualsWithState();
    saveSettings();
  });

  $('backgroundToggle').addEventListener('change', e => {
    State.showBackground = e.target.checked;
    syncVisualsWithState();
    saveSettings();
  });

  $('gridToggle').addEventListener('change', e => {
    State.showGrid = e.target.checked;
    $('gridOverlay').style.display = State.showGrid ? 'block' : 'none';
    saveSettings();
  });

  $('mediansToggle').addEventListener('change', e => {
    State.showMedians = e.target.checked;
    syncVisualsWithState();
    saveSettings();
  });

  $('radicalToggle').addEventListener('change', e => {
    State.highlightRadical = e.target.checked;
    syncVisualsWithState();
    saveSettings();
  });

  // Practice
  $('hintSlider').addEventListener('input', e => {
    State.hintAfterMisses = parseInt(e.target.value);
    $('hintValue').textContent = State.hintAfterMisses;
    saveSettings();
  });

  $('hintSpeedSlider').addEventListener('input', e => {
    State.hintSpeed = parseFloat(e.target.value);
    $('hintSpeedValue').textContent = State.hintSpeed.toFixed(1) + '×';
    saveSettings();
  });

  $('drawWidthSlider').addEventListener('input', e => {
    State.drawWidth = parseInt(e.target.value);
    $('drawWidthValue').textContent = State.drawWidth;
    if (writer) writer.updateColor('drawingWidth', State.drawWidth);
    saveSettings();
  });

  $('showUserStrokesToggle').addEventListener('change', e => {
    State.showUserStrokes = e.target.checked;
    renderUserStrokes();
    saveSettings();
  });

  // Colors
  $('strokeColor').addEventListener('input', e => {
    State.strokeColor = e.target.value;
    syncVisualsWithState();
    saveSettings();
  });
  $('radColor').addEventListener('input', e => {
    State.radicalColor = e.target.value;
    syncVisualsWithState();
    saveSettings();
  });
  $('outColor').addEventListener('input', e => {
    State.outlineColor = e.target.value;
    syncVisualsWithState();
    saveSettings();
  });
  $('drawColor').addEventListener('input', e => {
    State.drawingColor = e.target.value;
    if (writer) writer.updateColor('drawingColor', State.drawingColor);
    saveSettings();
  });

  // Theme
  $('themeToggle').addEventListener('click', toggleTheme);

  // Quiz
  $('quizBtn').addEventListener('click', () => { hapticTap(); toggleQuiz(); });

  // Keyboard
  document.addEventListener('keydown', handleGlobalKeydown);

  // Touch gestures on canvas
  setupCanvasGestures();

  // Responsive SVG
  setupResizeObserver();

  // Mobile bottom sheet backdrop
  const backdrop = $('sheetBackdrop');
  if (backdrop) {
    backdrop.addEventListener('click', closeSidebar);
  }

  // Go
  loadCharacter();
  renderRecent();
});

function applyInitialUI() {
  $('charInput').value = State.char;

  $('speedSlider').value = State.animSpeed;
  $('speedValue').textContent = State.animSpeed.toFixed(1) + '×';

  $('hintSpeedSlider').value = State.hintSpeed;
  $('hintSpeedValue').textContent = State.hintSpeed.toFixed(1) + '×';

  $('outlineToggle').checked = State.showOutline;
  $('backgroundToggle').checked = State.showBackground;
  $('gridToggle').checked = State.showGrid;
  $('gridOverlay').style.display = State.showGrid ? 'block' : 'none';
  $('mediansToggle').checked = State.showMedians;
  $('radicalToggle').checked = State.highlightRadical;
  $('showUserStrokesToggle').checked = State.showUserStrokes;

  $('hintSlider').value = State.hintAfterMisses;
  $('hintValue').textContent = State.hintAfterMisses;
  $('drawWidthSlider').value = State.drawWidth;
  $('drawWidthValue').textContent = State.drawWidth;

  $('strokeColor').value = State.strokeColor;
  $('radColor').value = State.radicalColor;
  $('outColor').value = State.outlineColor;
  $('drawColor').value = State.drawingColor;

  document.body.setAttribute('data-theme', State.theme);
  updateThemeIcons();
}

// ═══════════════════════════════════════════════
//  Core Sync Logic
// ═══════════════════════════════════════════════
function syncVisualsWithState() {
  if (!writer) return;

  // Colors
  writer.updateColor('strokeColor', State.strokeColor);
  writer.updateColor('radicalColor', State.highlightRadical ? State.radicalColor : State.strokeColor);
  writer.updateColor('drawingColor', State.drawingColor);

  // Outline / Background custom logic
  // "Background" acts as Fill, "Outline" acts as Stroke
  if (State.showOutline || State.showBackground) {
    writer.showOutline();
    const svg = $('writer').querySelector('svg');
    if (svg) {
      const outlineGroup = svg.querySelector('g').children[0];
      if (outlineGroup) {
        for (let i = 0; i < outlineGroup.children.length; i++) {
          const path = outlineGroup.children[i].querySelector('path') || outlineGroup.children[i];

          // Background toggle controls FILL
          if (State.showBackground) {
            path.style.fill = 'rgba(180,160,130,0.25)'; // Faint beige background
          } else {
            path.style.fill = 'none';
          }

          // Outline toggle controls STROKE
          if (State.showOutline) {
            path.style.stroke = State.outlineColor;
            path.style.strokeWidth = '3';
            path.style.strokeLinecap = 'round';
            path.style.strokeLinejoin = 'round';
          } else {
            path.style.stroke = 'none';
          }
        }
      }
    }
  } else {
    writer.hideOutline();
  }

  // Show the character up to the current stroke
  showStrokesUpTo(State.currentStroke);

  updateUI();
}

function updateUI() {
  const cur = State.strokeCount ? State.currentStroke : '—';
  const tot = State.strokeCount || '—';

  // Animated stroke counter
  const el = $('strokeProgress');
  const newText = `${cur} / ${tot}`;
  if (el.textContent !== newText) {
    el.innerHTML = `<span class="counter-value rolling">${newText}</span>`;
    setTimeout(() => {
      const cv = el.querySelector('.counter-value');
      if (cv) cv.classList.remove('rolling');
    }, 300);
  }

  // Button states
  const playBtn = $('animateBtn');
  if (State.isAnimating) {
    playBtn.textContent = '⏹ Stop';
    playBtn.classList.add('is-playing');
  } else {
    playBtn.textContent = '▶ Play Strokes';
    playBtn.classList.remove('is-playing');
  }

  const locked = State.isAnimating || State.isInQuiz || State.isBusy;
  $('prevBtn').disabled = locked || State.currentStroke <= 0;
  $('nextBtn').disabled = locked || State.currentStroke >= State.strokeCount || State.strokeCount === 0;
  $('showFullBtn').disabled = locked || (State.currentStroke >= State.strokeCount && State.strokeCount > 0);
  $('resetBtn').disabled = locked && !State.isAnimating;
}

// Fix SVG scaling: read creation dimensions and use as viewBox
function fixWriterSVG() {
  const svg = $('writer').querySelector('svg');
  if (!svg) return;
  const w = svg.getAttribute('width');
  const h = svg.getAttribute('height');
  if (w && h) {
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.removeAttribute('width');
    svg.removeAttribute('height');
  }
}

// Show exactly N strokes instantly via direct DOM manipulation.
// Does NOT call hideCharacter/showCharacter for partial display
// because their CSS transitions override inline styles.
function showStrokesUpTo(n) {
  if (!writer) return;

  if (n <= 0) {
    writer.hideCharacter();
    return;
  }
  if (n >= State.strokeCount) {
    writer.showCharacter();
    return;
  }

  // For partial display, directly set each stroke's opacity.
  // This avoids the race condition where hideCharacter/showCharacter's
  // CSS transitions override our inline styles.
  const charGroup = getCharStrokesGroup();
  if (!charGroup) {
    // Fallback: can't access DOM, use showCharacter
    writer.showCharacter();
    return;
  }

  for (let i = 0; i < charGroup.children.length; i++) {
    const el = charGroup.children[i];
    el.style.transition = 'none';
    el.style.opacity = i < n ? '1' : '0';

    // Crucial fix: HanziWriter animates via stroke-dashoffset.
    // If we bypass its API, we must force the path to be fully drawn.
    const path = el.querySelector('path');
    if (path && i < n) {
      path.style.strokeDasharray = 'none';
      path.style.strokeDashoffset = '0';
    }
  }
}

// Get the character strokes group from the SVG DOM
function getCharStrokesGroup() {
  const svg = $('writer').querySelector('svg');
  if (!svg) return null;
  const mainG = svg.querySelector('g');
  if (!mainG || mainG.children.length < 2) return null;
  return mainG.children[1];
}

// Clear inline styles on a stroke so HanziWriter can animate it
function clearInlineStrokeStyles(strokeIndex) {
  const charGroup = getCharStrokesGroup();
  if (!charGroup) return;
  const el = charGroup.children[strokeIndex];
  if (el) {
    el.style.transition = '';
    el.style.opacity = '';
    const path = el.querySelector('path');
    if (path) {
      path.style.strokeDashoffset = '';
      path.style.strokeDasharray = '';
    }
  }
}

// Clear ALL inline stroke styles (used before playStrokes)
function clearAllInlineStrokeStyles() {
  const charGroup = getCharStrokesGroup();
  if (!charGroup) return;
  for (let i = 0; i < charGroup.children.length; i++) {
    const el = charGroup.children[i];
    el.style.transition = '';
    el.style.opacity = '';
    const path = el.querySelector('path');
    if (path) {
      path.style.strokeDashoffset = '';
      path.style.strokeDasharray = '';
    }
  }
}

// Handle responsive resizing
function setupResizeObserver() {
  const wrapper = $('writerWrap');
  if (!wrapper || !window.ResizeObserver) return;

  const observer = new ResizeObserver(() => {
    fixWriterSVG();
  });
  observer.observe(wrapper);
}

// ═══════════════════════════════════════════════
//  Speed Normalization (ported from Flutter)
//  Adjusts animation speed based on stroke median length
//  Reference: first stroke of 你 ≈ 520 units
// ═══════════════════════════════════════════════
function getNormalizedSpeed(strokeIndex) {
  if (!charData || !charData.medians || strokeIndex >= charData.medians.length) {
    return State.animSpeed;
  }

  const median = charData.medians[strokeIndex];
  if (!median || median.length < 2) return State.animSpeed;

  // Calculate median path length
  let length = 0;
  for (let i = 1; i < median.length; i++) {
    const dx = median[i][0] - median[i - 1][0];
    const dy = median[i][1] - median[i - 1][1];
    length += Math.sqrt(dx * dx + dy * dy);
  }

  // Normalize to reference length (520), clamp between 0.5x and 1.5x
  const normFactor = Math.min(1.5, Math.max(0.5, length / 520));

  // Return adjusted speed: shorter strokes go slower (lower factor = lower speed multiplier)
  return State.animSpeed * (1 / normFactor);
}

// ═══════════════════════════════════════════════
//  Character Loading
// ═══════════════════════════════════════════════
async function loadCharacter() {
  const raw = $('charInput').value.trim();
  if (!raw) return;

  const char = raw.charAt(0);
  State.char = char;
  State.isBusy = true;

  // Fully stop any current animation/quiz
  if (writer) {
    try { writer.pauseAnimation(); } catch (_) { }
    try { writer.cancelQuiz(); } catch (_) { }
  }
  State.isAnimating = false;
  State.isInQuiz = false;
  clearUserStrokes();
  updateUI();

  // Show shimmer
  const shimmer = $('writerShimmer');
  const writerEl = $('writer');
  shimmer.classList.add('active');
  writerEl.classList.add('loading');
  setStatus('Loading…');

  try {
    // Pre-load character data
    const data = await HanziWriter.loadCharacterData(char);
    charData = data;
    State.strokeCount = data.strokes.length;
    State.currentStroke = 0;
    State.quizMistakes = new Array(State.strokeCount).fill(0);
    State.quizStrokePaths = new Array(State.strokeCount).fill(null).map(() => []);
    State.quizTotalMistakes = 0;

    // Destroy old writer completely
    writer = null;
    writerEl.innerHTML = '';

    // Measure container for responsive sizing
    const wrapper = $('writerWrap');
    const size = Math.min(wrapper.clientWidth, wrapper.clientHeight) || 400;

    // Create new writer with container-matched dimensions
    writer = HanziWriter.create('writer', char, {
      width: size,
      height: size,
      padding: 10,
      strokeAnimationSpeed: State.animSpeed,
      delayBetweenStrokes: 200,
      showHintAfterMisses: State.hintAfterMisses,
      drawingWidth: State.drawWidth,
      strokeColor: State.strokeColor,
      outlineColor: State.showOutline ? State.outlineColor : 'rgba(0,0,0,0)',
      radicalColor: State.highlightRadical ? State.radicalColor : State.strokeColor,
      drawingColor: State.drawingColor,
      charDataLoader: function (character, onComplete) {
        if (typeof onComplete === 'function') {
          onComplete(data);
        }
        return data;
      }
    });

    // Wait for HanziWriter to finish rendering
    await new Promise(resolve => setTimeout(resolve, 350));

    // Fix SVG scaling: ensure the SVG fills its container
    fixWriterSVG();

    State.isBusy = false;

    // Crossfade: hide shimmer, reveal character
    shimmer.classList.remove('active');
    writerEl.classList.remove('loading');

    syncVisualsWithState();
    setStatus(`${char} · ${State.strokeCount} strokes`);
    pushRecent(char);
    renderRecent();

    // Auto-play
    playStrokes();

  } catch (e) {
    State.isBusy = false;
    shimmer.classList.remove('active');
    writerEl.classList.remove('loading');
    updateUI();
    setStatus('Character not found');
    hapticBuzz();
  }
}

// ═══════════════════════════════════════════════
//  Playback
// ═══════════════════════════════════════════════
function togglePlay() {
  State.isAnimating ? stopPlay() : playStrokes();
}

async function playStrokes() {
  if (!writer || State.isBusy) return;
  if (State.isInQuiz) cancelQuiz();

  State.currentStroke = 0;
  State.isAnimating = true;
  clearAllInlineStrokeStyles();
  writer.hideCharacter();
  updateUI();
  setStatus('Playing strokes…');

  function playNext() {
    if (!State.isAnimating || !writer) return;

    if (State.currentStroke < State.strokeCount) {
      clearInlineStrokeStyles(State.currentStroke);
      writer.animateStroke(State.currentStroke, {
        onComplete: () => {
          State.currentStroke++;
          updateUI();
          if (State.isAnimating) playNext();
        }
      });
    } else {
      if (State.isLooping && State.isAnimating) {
        State.currentStroke = 0;
        clearAllInlineStrokeStyles();
        writer.hideCharacter();
        updateUI();
        setTimeout(playNext, 500);
      } else {
        State.isAnimating = false;
        updateUI();
        setStatus('Done');
      }
    }
  }

  playNext();
}

function stopPlay() {
  if (writer) {
    try { writer.pauseAnimation(); } catch (_) { }
  }
  State.isAnimating = false;
  updateUI();
  setStatus('Stopped');
}

function showFullCharacter() {
  if (!writer || State.isBusy) return;
  stopPlay();
  State.currentStroke = State.strokeCount;
  syncVisualsWithState();
  setStatus('Full character shown');
}

function resetCharacter() {
  stopPlay();
  if (State.isInQuiz) cancelQuiz();
  State.currentStroke = 0;
  clearUserStrokes();
  syncVisualsWithState();
  setStatus('Reset');
}

function nextStroke() {
  if (!writer || State.isAnimating || State.isBusy || State.currentStroke >= State.strokeCount) return;

  State.isBusy = true;
  updateUI();

  // Clear inline overrides so HanziWriter can animate this stroke
  clearInlineStrokeStyles(State.currentStroke);

  writer.animateStroke(State.currentStroke, {
    onComplete: () => {
      State.currentStroke++;
      State.isBusy = false;
      updateUI();
      setStatus(`Stroke ${State.currentStroke} / ${State.strokeCount}`);
    }
  });
}

function prevStroke() {
  if (!writer || State.isAnimating || State.isBusy || State.currentStroke <= 0) return;

  State.currentStroke--;
  showStrokesUpTo(State.currentStroke);
  updateUI();
  setStatus(State.currentStroke === 0 ? 'Start' : `Stroke ${State.currentStroke} / ${State.strokeCount}`);
}

// ═══════════════════════════════════════════════
//  Quiz Mode (ported from Flutter)
// ═══════════════════════════════════════════════
function toggleQuiz() {
  State.isInQuiz ? cancelQuiz() : startQuiz();
}

function startQuiz() {
  if (!writer) return;
  stopPlay();
  State.isInQuiz = true;
  State.currentStroke = 0;
  State.quizMistakes = new Array(State.strokeCount).fill(0);
  State.quizStrokePaths = new Array(State.strokeCount).fill(null).map(() => []);
  State.quizTotalMistakes = 0;
  clearUserStrokes();
  syncVisualsWithState();

  $('quizBtn').textContent = '✕ Cancel Quiz';
  $('quizResult').style.display = 'none';
  setStatus('Draw strokes in order…');

  writer.quiz({
    showHintAfterMisses: State.hintAfterMisses,
    onMistake: d => {
      hapticBuzz();
      State.quizMistakes[d.strokeNum] = (State.quizMistakes[d.strokeNum] || 0) + 1;
      State.quizTotalMistakes++;
      flashQuiz('wrong');
      setStatus(`✗ Mistake on stroke ${d.strokeNum + 1}`);
    },
    onCorrectStroke: d => {
      hapticTap();
      State.currentStroke = d.strokeNum + 1;
      flashQuiz('correct');
      updateUI();
      setStatus(`✓ Correct! ${d.strokesRemaining} remaining`);
    },
    onComplete: summary => {
      hapticSuccess();
      State.isInQuiz = false;
      State.currentStroke = State.strokeCount;
      $('quizBtn').textContent = '✏ Start Quiz';

      const m = summary.totalMistakes;
      const result = $('quizResult');

      if (m === 0) {
        result.textContent = '🎉 Perfect!';
        result.className = 'quiz-result perfect';
        spawnConfetti();
      } else {
        result.textContent = `Done: ${m} mistake${m !== 1 ? 's' : ''}`;
        result.className = 'quiz-result';
      }
      result.style.display = 'block';

      updateUI();
      setStatus('Quiz complete!');
    }
  });
}

function cancelQuiz() {
  if (writer) writer.cancelQuiz();
  State.isInQuiz = false;
  $('quizBtn').textContent = '✏ Start Quiz';
  syncVisualsWithState();
  setStatus('Quiz cancelled');
}

// ═══════════════════════════════════════════════
//  Quiz Visual Feedback
// ═══════════════════════════════════════════════
function flashQuiz(type) {
  const el = $('quizFlash');
  el.className = 'quiz-flash';
  // Force reflow to restart animation
  void el.offsetWidth;
  el.classList.add(type);

  setTimeout(() => {
    el.className = 'quiz-flash';
  }, 500);
}

function spawnConfetti() {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);

  const colors = ['#c0392b', '#e8a000', '#2d7a3a', '#3498db', '#9b59b6', '#f39c12'];

  for (let i = 0; i < 50; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.top = '-10px';
    piece.style.width = (Math.random() * 8 + 4) + 'px';
    piece.style.height = (Math.random() * 8 + 4) + 'px';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    piece.style.animationDuration = (Math.random() * 2 + 1.5) + 's';
    piece.style.animationDelay = (Math.random() * 0.5) + 's';
    container.appendChild(piece);
  }

  setTimeout(() => container.remove(), 4000);
}

// ═══════════════════════════════════════════════
//  User Stroke Overlay Canvas (Flutter feature)
// ═══════════════════════════════════════════════
function getStrokeCanvas() {
  const canvas = $('userStrokeCanvas');
  const wrapper = $('writerWrap');
  canvas.width = wrapper.clientWidth;
  canvas.height = wrapper.clientHeight;
  return canvas;
}

function renderUserStrokes() {
  const canvas = getStrokeCanvas();
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!State.showUserStrokes) {
    canvas.classList.remove('visible');
    return;
  }

  canvas.classList.add('visible');

  ctx.strokeStyle = State.drawingColor;
  ctx.lineWidth = Math.max(2, State.drawWidth * (canvas.width / 400));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.5;

  State.quizStrokePaths.forEach(path => {
    if (!path || path.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(path[0].x * canvas.width, path[0].y * canvas.height);
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x * canvas.width, path[i].y * canvas.height);
    }
    ctx.stroke();
  });
}

function clearUserStrokes() {
  const canvas = $('userStrokeCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.classList.remove('visible');
  }
}

// ═══════════════════════════════════════════════
//  Canvas Touch Gestures (mobile)
// ═══════════════════════════════════════════════
function setupCanvasGestures() {
  const wrapper = $('writerWrap');
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let isSwiping = false;

  wrapper.addEventListener('touchstart', e => {
    // Don't interfere with quiz drawing
    if (State.isInQuiz) return;

    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
      isSwiping = false;
    }
  }, { passive: true });

  wrapper.addEventListener('touchmove', e => {
    if (State.isInQuiz) return;

    if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;

      // Detect horizontal swipe (dx significant, dy small)
      if (Math.abs(dx) > 30 && Math.abs(dy) < Math.abs(dx) * 0.7) {
        isSwiping = true;
      }
    }
  }, { passive: true });

  wrapper.addEventListener('touchend', e => {
    if (State.isInQuiz) return;

    const elapsed = Date.now() - touchStartTime;
    if (isSwiping && elapsed < 500) {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (dx > 50) {
        // Swipe right → previous stroke
        hapticTap();
        prevStroke();
      } else if (dx < -50) {
        // Swipe left → next stroke
        hapticTap();
        nextStroke();
      }
    }
    isSwiping = false;
  }, { passive: true });
}

// ═══════════════════════════════════════════════
//  Sidebar & Theme
// ═══════════════════════════════════════════════
function toggleSidebar() {
  const layout = $('appLayout');
  const open = layout.classList.toggle('sidebar-open');
  $('toggleIcon').innerHTML = open
    ? `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`
    : `<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>`;

  // Mobile: toggle backdrop
  const isMobile = window.innerWidth <= 680;
  if (isMobile) {
    const backdrop = $('sheetBackdrop');
    if (backdrop) backdrop.classList.toggle('active', open);
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    hapticTap();
  }
}

function closeSidebar() {
  $('appLayout').classList.remove('sidebar-open');
  $('toggleIcon').innerHTML = `<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>`;
  const backdrop = $('sheetBackdrop');
  if (backdrop) backdrop.classList.remove('active');
  document.body.style.overflow = '';
}

function toggleTheme() {
  State.theme = State.theme === 'light' ? 'dark' : 'light';
  document.body.setAttribute('data-theme', State.theme);
  updateThemeIcons();
  saveSettings();
  hapticTap();
}

function updateThemeIcons() {
  $('moonIcon').style.display = State.theme === 'dark' ? 'none' : 'block';
  $('sunIcon').style.display = State.theme === 'dark' ? 'block' : 'none';
}

// ═══════════════════════════════════════════════
//  Keyboard Shortcuts
// ═══════════════════════════════════════════════
function handleGlobalKeydown(e) {
  if (e.target.tagName === 'INPUT') return;
  switch (e.key.toLowerCase()) {
    case ' ': e.preventDefault(); togglePlay(); break;
    case 'r': resetCharacter(); break;
    case 'q': toggleQuiz(); break;
    case 'escape': if (State.isInQuiz) cancelQuiz(); break;
    case 'arrowright': nextStroke(); break;
    case 'arrowleft': prevStroke(); break;
    case 'f': showFullCharacter(); break;
  }
}

// ═══════════════════════════════════════════════
//  Recent Characters
// ═══════════════════════════════════════════════
function pushRecent(char) {
  let list = getRecent();
  list = [char, ...list.filter(c => c !== char)].slice(0, 10);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (_) { return []; }
}

function renderRecent() {
  const list = getRecent();
  const el = $('recentlyViewed');
  if (!list.length) { el.innerHTML = ''; return; }

  el.innerHTML = '<span class="recent-label">Recent:</span>' +
    list.map((c, i) =>
      `<button class="chip" style="animation-delay:${i * 0.05}s" onclick="loadChip('${c}')">${c}</button>`
    ).join('');
}

// ═══════════════════════════════════════════════
//  Global
// ═══════════════════════════════════════════════
window.loadChip = function (char) {
  $('charInput').value = char;
  loadCharacter();
};

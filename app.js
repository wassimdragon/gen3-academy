/* ==========================================================================
   Generation 3 Academy - Application Logic & Socratic AI Engine
   Multi-Lesson & Gamified Dashboard Edition
   ========================================================================== */

let curriculumData = null;
let currentLessonIndex = 0;
let currentXP = 450;
let maxXP = 600;
let userAnswers = {};
let currentAiMode = 'foundational';

// Web Audio API Sound Effects Generator (100% Permissible & Instrument-Free)
class SoundFX {
  static init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  }

  static playChime() {
    try {
      this.init();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, this.ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, this.ctx.currentTime + 0.15); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, this.ctx.currentTime + 0.3); // G5

      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.5);
    } catch (e) {
      console.log('Audio playback prevented or unsupported');
    }
  }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('data/lessons.json');
    curriculumData = await res.json();
    renderQuestMap(curriculumData.lessons);
    renderLesson(curriculumData.lessons[0]);
    renderFlashcards(curriculumData.flashcards);
    renderBadges(curriculumData.badges);
    setupEventListeners();
  } catch (err) {
    console.error('Failed to load curriculum dataset:', err);
  }
});

// Switch Between Student Portal & Parent/Teacher Dashboard
function switchView(viewName) {
  const studentView = document.getElementById('student-view');
  const dashView = document.getElementById('dashboard-view');
  const btnStudent = document.getElementById('btn-student-mode');
  const btnDash = document.getElementById('btn-dashboard-mode');

  if (viewName === 'dashboard') {
    studentView.style.display = 'none';
    dashView.classList.add('active');
    btnStudent.classList.remove('active');
    btnDash.classList.add('active');
  } else {
    studentView.style.display = 'flex';
    dashView.classList.remove('active');
    btnStudent.classList.add('active');
    btnDash.classList.remove('active');
  }
}

// Render Quest Map Nodes
function renderQuestMap(lessons) {
  const mapContainer = document.getElementById('quest-map');
  mapContainer.innerHTML = lessons.map((l, idx) => `
    <div class="quest-node ${idx === currentLessonIndex ? 'active' : ''} ${l.status === 'completed' ? 'completed' : (l.status === 'locked' ? 'locked' : '')}" onclick="selectQuestNode(${idx})">
      <div class="quest-number">${l.status === 'completed' ? '✓' : l.lessonNumber}</div>
      <div class="quest-node-title">Lesson ${l.lessonNumber}</div>
      <div style="font-size: 0.7rem; color: var(--text-muted);">${l.title}</div>
    </div>
  `).join('');
}

function selectQuestNode(index) {
  const lesson = curriculumData.lessons[index];
  if (lesson.status === 'locked') {
    alert(`Lesson ${lesson.lessonNumber} is locked. Complete previous missions first!`);
    return;
  }
  currentLessonIndex = index;
  renderQuestMap(curriculumData.lessons);
  renderLesson(lesson);
  window.scrollTo({ top: 300, behavior: 'smooth' });
}

// Render Active Lesson Content
function renderLesson(lesson) {
  document.getElementById('mission-number-tag').innerText = `Lesson ${lesson.lessonNumber} Mission`;
  document.getElementById('mission-title').innerText = lesson.title;
  document.getElementById('mission-subtitle').innerText = lesson.subtitle;

  // Render Objectives
  const objList = document.getElementById('objectives-list');
  objList.innerHTML = lesson.objectives.map(obj => `<li>${obj}</li>`).join('');

  // Render Dynamic Sections
  const bodyContainer = document.getElementById('dynamic-lesson-body');
  if (!lesson.sections || lesson.sections.length === 0) {
    bodyContainer.innerHTML = `
      <article class="lesson-card">
        <div style="text-align: center; padding: 2rem;">
          <h3 style="color: var(--accent-gold); margin-bottom: 0.5rem;">Mission Locked / Preview Mode</h3>
          <p style="color: var(--text-muted);">Complete Lesson 1 verification checkpoint to unlock full mission content for Lesson ${lesson.lessonNumber}.</p>
        </div>
      </article>
    `;
  } else {
    bodyContainer.innerHTML = lesson.sections.map(sec => renderSectionCard(sec)).join('');
  }

  // Render Quiz Checkpoint
  renderQuiz(lesson.quiz || []);
}

function renderSectionCard(sec) {
  if (sec.type === 'narrative') {
    return `
      <article class="lesson-card">
        <div class="lesson-card-header">
          <h2 class="card-title"><span>🔍</span> ${sec.title}</h2>
        </div>
        <p style="white-space: pre-line; color: var(--text-main); margin-bottom: 1rem;">${sec.content}</p>
        ${sec.callout ? `
          <div style="background: rgba(229, 193, 88, 0.1); border-left: 3px solid var(--accent-gold); padding: 1rem; border-radius: 4px;">
            <strong style="color: var(--accent-gold);">${sec.callout.title}:</strong>
            <p style="font-size: 0.9rem; color: var(--text-main); margin-top: 0.3rem;">${sec.callout.text}</p>
          </div>
        ` : ''}
      </article>
    `;
  }

  if (sec.type === 'analogy') {
    return `
      <article class="lesson-card">
        <div class="lesson-card-header">
          <h2 class="card-title"><span>🛠️</span> ${sec.title}</h2>
        </div>
        <div class="analogy-box">
          <p class="analogy-story">${sec.story}</p>
          <div class="analogy-options">
            ${sec.options.map((opt, idx) => `
              <button class="analogy-btn" onclick="handleAnalogyChoice(${idx}, ${opt.correct})">
                <span>${opt.text}</span>
                <span style="font-size: 0.8rem; opacity: 0.6;">Select ➔</span>
              </button>
            `).join('')}
          </div>
          <div class="feedback-msg" id="analogy-feedback"></div>
        </div>
      </article>
    `;
  }

  if (sec.type === 'socratic_inquiry') {
    return `
      <article class="lesson-card">
        <div class="lesson-card-header">
          <h2 class="card-title"><span>💡</span> ${sec.title}</h2>
        </div>
        <p style="margin-bottom: 1rem;">${sec.content}</p>
        <div style="background: rgba(14, 32, 25, 0.7); border: 1px solid var(--glass-border); padding: 1.25rem; border-radius: 12px; margin-bottom: 1rem;">
          <h4 style="color: var(--primary-emerald); margin-bottom: 0.5rem;">Why Intellect Needs Guidance:</h4>
          <p style="font-size: 0.9rem; color: var(--text-muted);">${sec.explanation}</p>
        </div>
        <div style="background: rgba(229, 193, 88, 0.12); border: 1px solid var(--accent-gold); padding: 1rem; border-radius: 12px; color: var(--text-gold);">
          <strong>🌟 The Solution:</strong> ${sec.solution}
        </div>
      </article>
    `;
  }

  if (sec.type === 'verses') {
    return `
      <article class="lesson-card">
        <div class="lesson-card-header">
          <h2 class="card-title"><span>📖</span> ${sec.title}</h2>
        </div>
        <div>
          ${sec.verses.map(v => `
            <div class="verse-card">
              <div class="verse-surah">📜 ${v.surah}</div>
              <div class="arabic-text">${v.arabic}</div>
              <div class="verse-translation">"${v.translation}"</div>
              <div class="verse-note">💡 Lesson Insight: ${v.note}</div>
            </div>
          `).join('')}
        </div>
      </article>
    `;
  }

  if (sec.type === 'concept_map') {
    return `
      <article class="lesson-card">
        <div class="lesson-card-header">
          <h2 class="card-title"><span>🌱</span> ${sec.title}</h2>
        </div>
        <p style="margin-bottom: 1rem; color: var(--text-muted);">${sec.intro}</p>
        <div class="concept-grid">
          ${sec.categories.map(cat => `
            <div class="concept-card">
              <h4>✨ ${cat.name}</h4>
              <ul>
                ${cat.examples.map(ex => `<li>${ex}</li>`).join('')}
              </ul>
            </div>
          `).join('')}
        </div>
      </article>
    `;
  }

  return '';
}

// Handle Interactive Analogy Choice
function handleAnalogyChoice(index, isCorrect) {
  const btns = document.querySelectorAll('.analogy-btn');
  const feedback = document.getElementById('analogy-feedback');
  const activeLesson = curriculumData.lessons[currentLessonIndex];
  const sec2 = activeLesson.sections.find(s => s.id === 'strange-tool');

  btns.forEach((btn, idx) => {
    btn.classList.remove('correct', 'wrong');
    if (idx === index) {
      btn.classList.add(isCorrect ? 'correct' : 'wrong');
    }
  });

  feedback.className = 'feedback-msg show ' + (isCorrect ? 'correct-bg' : '');
  feedback.innerHTML = `
    <strong>${isCorrect ? '🎉 Excellent Choice!' : '💭 Think Deeper:'}</strong>
    <p style="margin-top: 0.3rem;">${sec2.options[index].feedback}</p>
    ${isCorrect ? `<p style="margin-top: 0.5rem; font-weight: 600; color: var(--accent-gold);">${sec2.takeaway}</p>` : ''}
  `;

  if (isCorrect) {
    SoundFX.playChime();
    addXP(50);
  }
}

// Render Checkpoint Quiz
function renderQuiz(quizList) {
  const container = document.getElementById('quiz-container');
  if (!quizList || quizList.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted);">No quiz available for this preview lesson yet.</p>`;
    return;
  }

  container.innerHTML = quizList.map((q, qIdx) => `
    <div class="quiz-question" id="quiz-q-${qIdx}">
      <div class="question-text">Q${qIdx + 1}: ${q.question}</div>
      <div class="quiz-options">
        ${q.options.map((opt, optIdx) => `
          <button class="quiz-opt-btn" onclick="selectQuizAnswer(${qIdx}, ${optIdx})">
            ${String.fromCharCode(65 + optIdx)}. ${opt}
          </button>
        `).join('')}
      </div>
      <div class="quiz-explanation" id="quiz-exp-${qIdx}" style="display:none; margin-top: 0.8rem; padding: 0.8rem; background: rgba(16,185,129,0.1); border-left: 3px solid var(--primary-emerald); border-radius: 4px; font-size: 0.85rem;"></div>
    </div>
  `).join('') + `
    <button class="reward-btn" style="width: 100%; margin-top: 1rem;" onclick="submitQuiz()">Submit Checkpoint Verification ➔</button>
  `;
}

function selectQuizAnswer(qIdx, optIdx) {
  userAnswers[qIdx] = optIdx;
  const qContainer = document.getElementById(`quiz-q-${qIdx}`);
  const btns = qContainer.querySelectorAll('.quiz-opt-btn');
  btns.forEach((btn, idx) => {
    btn.style.borderColor = (idx === optIdx) ? 'var(--accent-gold)' : 'rgba(255,255,255,0.08)';
    btn.style.background = (idx === optIdx) ? 'rgba(229,193,88,0.15)' : 'rgba(255,255,255,0.03)';
  });
}

function submitQuiz() {
  const lesson = curriculumData.lessons[currentLessonIndex];
  if (!lesson || !lesson.quiz) return;

  let correctCount = 0;
  const total = lesson.quiz.length;

  lesson.quiz.forEach((q, qIdx) => {
    const selected = userAnswers[qIdx];
    const qContainer = document.getElementById(`quiz-q-${qIdx}`);
    const btns = qContainer.querySelectorAll('.quiz-opt-btn');
    const expBox = document.getElementById(`quiz-exp-${qIdx}`);

    btns.forEach((btn, idx) => {
      if (idx === q.answer) {
        btn.classList.add('selected-correct');
      } else if (idx === selected) {
        btn.classList.add('selected-wrong');
      }
    });

    expBox.style.display = 'block';
    expBox.innerHTML = `<strong>Explanation:</strong> ${q.explanation}`;

    if (selected === q.answer) correctCount++;
  });

  if (correctCount >= Math.ceil(total / 2)) {
    SoundFX.playChime();
    addXP(100);
    lesson.status = 'completed';

    // Unlock next lesson if available
    if (curriculumData.lessons[currentLessonIndex + 1]) {
      curriculumData.lessons[currentLessonIndex + 1].status = 'unlocked';
    }

    renderQuestMap(curriculumData.lessons);
    showRewardModal(correctCount, total);
    updateKnowledgeLevel(2);
  } else {
    alert(`You scored ${correctCount}/${total}. Review the Socratic guide hints and try again!`);
  }
}

// Render Terminology 3D Flashcards
function renderFlashcards(cards) {
  const container = document.getElementById('flashcard-container');
  container.innerHTML = cards.map(c => `
    <div class="flashcard" onclick="this.classList.toggle('flipped')">
      <div class="flashcard-inner">
        <div class="flashcard-front">
          <div class="flashcard-term">${c.term}</div>
          <span style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">Click to Reveal Definition 🔄</span>
        </div>
        <div class="flashcard-back">
          <div class="flashcard-def">${c.definition}</div>
        </div>
      </div>
    </div>
  `).join('');
}

// Render Badge Vault
function renderBadges(badges) {
  const container = document.getElementById('badge-grid');
  container.innerHTML = badges.map(b => `
    <div class="badge-card ${b.unlocked ? 'unlocked' : 'locked'}">
      <div class="badge-icon">${b.icon}</div>
      <div class="badge-name">${b.name}</div>
      <div class="badge-desc">${b.desc}</div>
      <div style="margin-top: 0.5rem; font-size: 0.7rem; font-weight: 700; color: ${b.unlocked ? 'var(--primary-emerald)' : 'var(--text-muted)'};">
        ${b.unlocked ? '✓ UNLOCKED' : '🔒 LOCKED'}
      </div>
    </div>
  `).join('');
}

// XP & Gamification
function addXP(amount) {
  currentXP = Math.min(maxXP, currentXP + amount);
  document.getElementById('xp-counter').innerText = `${currentXP} / ${maxXP} XP`;
  document.getElementById('dash-xp').innerText = `${currentXP} XP`;
  const fillPct = (currentXP / maxXP) * 100;
  document.getElementById('xp-bar-fill').style.width = `${fillPct}%`;
}

function updateKnowledgeLevel(stepNum) {
  for (let i = 1; i <= 4; i++) {
    const step = document.getElementById(`step-${i}`);
    if (step) {
      if (i < stepNum) {
        step.className = 'level-step active';
      } else if (i === stepNum) {
        step.className = 'level-step active current';
      } else {
        step.className = 'level-step';
      }
    }
  }

  const rankNames = {
    1: "📜 Level 1: Ma'lumat",
    2: "📖 Level 2: 'Ilm",
    3: "🧠 Level 3: Fiqh",
    4: "🌟 Level 4: Fahm"
  };

  if (rankNames[stepNum]) {
    document.getElementById('current-rank').innerText = rankNames[stepNum];
  }
}

function showRewardModal(score, total) {
  const modal = document.getElementById('reward-modal');
  document.getElementById('reward-title').innerText = `Checkpoint Passed! (${score}/${total})`;
  document.getElementById('reward-desc').innerText = `MashaAllah! You unlocked +100 XP, unlocked Lesson 2 on your Quest Map, and earned Badge: Tawheed Guardian!`;
  modal.classList.add('active');
}

function closeRewardModal() {
  document.getElementById('reward-modal').classList.remove('active');
}

// Setup Event Listeners
function setupEventListeners() {
  const toggleAiBtn = document.getElementById('toggle-ai-btn');
  const closeAiBtn = document.getElementById('close-ai-btn');
  const aiDrawer = document.getElementById('ai-drawer');

  toggleAiBtn.addEventListener('click', () => {
    aiDrawer.classList.toggle('open');
  });

  closeAiBtn.addEventListener('click', () => {
    aiDrawer.classList.remove('open');
  });

  const gradeBtns = document.querySelectorAll('.grade-btn');
  gradeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      gradeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const selectedGrade = btn.dataset.grade;
      if (selectedGrade !== '6') {
        alert(`Grade ${selectedGrade} preview activated. Grade 6 Q1 is currently live.`);
      }
    });
  });
}

// AI Mode Selector
function setAiMode(mode, element) {
  currentAiMode = mode;
  document.querySelectorAll('.ai-mode-btn').forEach(btn => btn.classList.remove('active'));
  element.classList.add('active');
  appendChatMessage('ai', `<em>AI Socratic Mode switched to: <strong>${mode.toUpperCase()}</strong></em>`);
}

// Socratic AI Interaction
function handleUserMessage() {
  const input = document.getElementById('ai-user-input');
  const text = input.value.trim();
  if (!text) return;

  appendChatMessage('user', text);
  input.value = '';

  setTimeout(() => {
    const aiResponse = generateSocraticResponse(text, currentAiMode);
    appendChatMessage('ai', aiResponse);
    SoundFX.playChime();
  }, 700);
}

function sendSuggestedPrompt(promptText) {
  document.getElementById('ai-user-input').value = promptText;
  handleUserMessage();
}

function appendChatMessage(sender, text) {
  const messagesBox = document.getElementById('ai-messages');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;
  bubble.innerHTML = text;
  messagesBox.appendChild(bubble);
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

// Grade-Adaptive Socratic AI Engine
function generateSocraticResponse(userText, mode) {
  const query = userText.toLowerCase();

  if (mode === 'advanced') {
    return `[Grades 11–12 Analytical Mode]: You bring up a critical philosophical tension. How do classical scholars reconcile the limits of pure rationalism (*aql*) with authentic textual transmission (*naql*) when addressing questions of divine purpose?`;
  }

  if (mode === 'transition') {
    return `[Grades 9–10 Evidence Mode]: Excellent observation. What textual proof from the Qur'an or Sunnah directly supports this distinction, and how does it connect to Tawheed al-Asma wa Sifat?`;
  }

  // Foundational Mode (Grades 6–8)
  if (query.includes('intellect') || query.includes('alone') || query.includes('plato')) {
    return `A thoughtful reflection! Consider this: Can a painting explain why the painter created it, or can a smart watch explain why its engineer designed it? 
    <br><br>Since human intellect is itself <em>created</em>, where must we look to find our true, ultimate purpose?`;
  }

  if (query.includes('hint') || query.includes('q2') || query.includes('question')) {
    return `💡 <strong>Socratic Hint:</strong> Look closely at the story of Plato and the philosophers in Section 3. Did they lack brainpower, or were they searching in the wrong place without Divine Revelation?`;
  }

  if (query.includes('science') || query.includes('math') || query.includes('worship') || query.includes('ibadah')) {
    return `SubhanAllah! In Islam, 'Ibadah includes every beneficial action done with a sincere intention for Allah. 
    <br><br>If a student studies biology or mathematics to marvel at Allah's creation and serve humanity, how does that transform homework into worship? What intention would you make?`;
  }

  return `That is a deep question! In our Gen 3 Socratic method, we believe in earning wisdom. 
  <br><br>Based on what we studied in Lesson 1 about the <strong>Maker of the Tool</strong> and the <strong>Qur'an as the Instruction Manual</strong>, how would you begin answering that?`;
}

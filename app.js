/* ==========================================================================
   Generation 3 Academy - Application Logic & Socratic AI Engine
   Audited & Fully Compliant Version (P0-P3 Upgraded + Real MP3 Recitation)
   ========================================================================== */

let curriculumData = null;
let currentLessonIndex = 0;
let currentXP = 0;
let maxXP = 600;
let userAnswers = {};
let currentAiMode = 'foundations';
let selectedGradeNum = 6;
let streakDays = 1;

// Pedagogical Effort Tracking Flags (Gatekeeping Checkpoint)
let hasEngagedAI = false;
let hasCompletedAnalogy = false;

// Non-Tonal Acoustic UI Sound Generator (100% Permissible & Music-Free)
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
      
      // Non-tonal acoustic thud/pop (no musical melody or pitch progression)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch (e) {
      console.log('Audio playback prevented or unsupported');
    }
  }

  // Authentic Qari Per-Ayah Audio Recitation (EveryAyah.com High Quality MP3 Streaming)
  static playAyahAudio(url) {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
    }

    if (url) {
      this.currentAudio = new Audio(url);
      this.currentAudio.play().catch(e => {
        showToast('🔊 Press play again to start verse recitation');
      });
    } else {
      showToast('🔊 Authentic verse audio recitation loaded');
    }
  }
}

// In-UI Toast Notification System (Replaces raw native alert popups)
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerText = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Helper to get local date string YYYY-MM-DD (Prevents UTC timezone streak reset)
function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Real Date-Based Streak Calculation using Local Timezone
function calculateStreak(savedDate, savedStreak) {
  const today = getLocalDateString();
  if (!savedDate) return { streakDays: 1, lastVisitDate: today };

  const prevParts = savedDate.split('-').map(Number);
  const currParts = today.split('-').map(Number);

  const prevDate = new Date(prevParts[0], prevParts[1] - 1, prevParts[2]);
  const currDate = new Date(currParts[0], currParts[1] - 1, currParts[2]);

  const diffTime = currDate - prevDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  let streak = savedStreak || 1;

  if (diffDays === 1) {
    streak += 1;
  } else if (diffDays > 1) {
    streak = 1;
  }

  return { streakDays: streak, lastVisitDate: today };
}

// LocalStorage State Persistence Engine
function saveProgress() {
  const today = getLocalDateString();
  const state = {
    currentXP,
    userAnswers,
    currentLessonIndex,
    hasEngagedAI,
    hasCompletedAnalogy,
    streakDays,
    lastVisitDate: today,
    completedLessons: curriculumData ? curriculumData.lessons.map(l => l.status) : [],
    unlockedBadges: curriculumData ? curriculumData.badges.map(b => b.unlocked) : []
  };
  try {
    localStorage.setItem('gen3_academy_progress', JSON.stringify(state));
  } catch (e) {
    console.log('LocalStorage storage quota or privacy lock');
  }
}

function loadProgress() {
  try {
    const raw = localStorage.getItem('gen3_academy_progress');
    if (!raw) return;
    const state = JSON.parse(raw);

    if (typeof state.currentXP === 'number') currentXP = state.currentXP;
    if (state.hasEngagedAI) hasEngagedAI = state.hasEngagedAI;
    if (state.hasCompletedAnalogy) hasCompletedAnalogy = state.hasCompletedAnalogy;

    // Real streak calculation
    const streakResult = calculateStreak(state.lastVisitDate, state.streakDays);
    streakDays = streakResult.streakDays;

    if (curriculumData && curriculumData.badges && curriculumData.badges[2]) {
      curriculumData.badges[2].unlocked = (streakDays >= 3);
    }

    if (state.completedLessons && curriculumData) {
      curriculumData.lessons.forEach((l, idx) => {
        if (state.completedLessons[idx]) l.status = state.completedLessons[idx];
      });
    }

    if (state.unlockedBadges && curriculumData) {
      curriculumData.badges.forEach((b, idx) => {
        if (typeof state.unlockedBadges[idx] === 'boolean') {
          if (b.id === 'b3') {
            b.unlocked = (streakDays >= 3);
          } else {
            b.unlocked = state.unlockedBadges[idx];
          }
        }
      });
    }

    updateXPBar();
    updateStreakUI();
  } catch (e) {
    console.log('Error restoring saved progress');
  }
}

function updateStreakUI() {
  const counterNav = document.getElementById('streak-counter');
  const counterDash = document.getElementById('dash-streak');
  if (counterNav) counterNav.innerText = `${streakDays} Day Streak`;
  if (counterDash) counterDash.innerText = `${streakDays} Days`;
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('data/lessons.json');
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    curriculumData = await res.json();
    
    loadProgress();
    renderQuestMap(curriculumData.lessons);
    renderLesson(curriculumData.lessons[currentLessonIndex]);
    renderFlashcards(curriculumData.flashcards);
    renderBadges(curriculumData.badges);
    setupEventListeners();
  } catch (err) {
    console.error('Failed to load curriculum dataset:', err);
    const bodyContainer = document.getElementById('dynamic-lesson-body');
    if (bodyContainer) {
      bodyContainer.innerHTML = `
        <article class="lesson-card" style="border-color: #ef4444;">
          <h3 style="color: #ef4444;">⚠️ Curriculum Load Error</h3>
          <p style="color: var(--text-muted); margin-top: 0.5rem;">Could not fetch curriculum data. Please check your network connection or server endpoint.</p>
        </article>
      `;
    }
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

// Render Rihla Quest Map Nodes
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
    showToast(`🔒 Lesson ${lesson.lessonNumber} is locked. Complete previous missions first!`);
    return;
  }
  currentLessonIndex = index;
  renderQuestMap(curriculumData.lessons);
  renderLesson(lesson);
  saveProgress();
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
          <p class="analogy-story" style="white-space: pre-line;">${sec.story}</p>
          <div class="analogy-options">
            ${sec.options.map((opt, idx) => `
              <button class="analogy-btn" onclick="handleAnalogyChoice(${idx}, ${opt.correct})">
                <span>${opt.text}</span>
                <span style="font-size: 0.8rem; opacity: 0.6;">Select ➔</span>
              </button>
            `).join('')}
          </div>
          <div class="feedback-msg" id="analogy-feedback" aria-live="polite"></div>
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
        <p style="margin-bottom: 1rem; white-space: pre-line;">${sec.content}</p>
        <div style="background: rgba(14, 32, 25, 0.7); border: 1px solid var(--glass-border); padding: 1.25rem; border-radius: 12px; margin-bottom: 1rem;">
          <h4 style="color: var(--primary-emerald); margin-bottom: 0.5rem;">Why Intellect Needs Guidance:</h4>
          <p style="font-size: 0.9rem; color: var(--text-muted); white-space: pre-line;">${sec.explanation}</p>
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
              <div class="verse-header-row">
                <div class="verse-surah">📜 ${v.surah}</div>
                <button class="verse-audio-btn" onclick="SoundFX.playAyahAudio('${v.audioUrl || ''}')">
                  🔊 Recite Verse (Qari Alafasy)
                </button>
              </div>
              <div class="arabic-text" lang="ar" dir="rtl">${v.arabic}</div>
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
        <p style="margin-bottom: 1rem; color: var(--text-muted); white-space: pre-line;">${sec.intro}</p>
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
    ${isCorrect ? `<p style="margin-top: 0.5rem; font-weight: 600; color: var(--accent-gold); white-space: pre-line;">${sec2.takeaway}</p>` : ''}
  `;

  if (isCorrect) {
    SoundFX.playChime();
    addXP(50);
    hasCompletedAnalogy = true;
    checkQuizUnlock();
  }
}

// Check & Unlock Quiz Checkpoint
function checkQuizUnlock() {
  if (hasEngagedAI || hasCompletedAnalogy) {
    const quizContainer = document.getElementById('quiz-container');
    const gateNotice = document.getElementById('quiz-gatekeep-notice');
    const statusTag = document.getElementById('checkpoint-status-tag');

    if (quizContainer) {
      quizContainer.style.opacity = '1';
      quizContainer.style.pointerEvents = 'auto';
    }
    if (gateNotice) gateNotice.style.display = 'none';
    if (statusTag) {
      statusTag.innerText = '🔓 Unlocked (Ready for Verification)';
      statusTag.style.background = 'rgba(16, 185, 129, 0.2)';
      statusTag.style.color = 'var(--primary-emerald)';
      statusTag.style.borderColor = 'var(--primary-emerald)';
    }
    saveProgress();
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

  checkQuizUnlock();
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

  const total = lesson.quiz.length;
  const answeredKeys = Object.keys(userAnswers);

  if (answeredKeys.length < total) {
    showToast(`⚠️ Please answer all ${total} questions before submitting.`);
    return;
  }

  let correctCount = 0;

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
    expBox.innerHTML = `
      <strong>📜 Source Verification (Dalil):</strong> ${q.dalil || 'Authentic Quranic Proof'}<br>
      <strong>Explanation:</strong> ${q.explanation}
    `;

    if (selected === q.answer) correctCount++;
  });

  const accuracyPct = Math.round((correctCount / total) * 100);
  document.getElementById('dash-accuracy').innerText = `${accuracyPct}%`;

  if (correctCount >= Math.ceil(total / 2)) {
    SoundFX.playChime();
    addXP(100);
    lesson.status = 'completed';

    // Unlock badges upon actual completion
    if (curriculumData.badges[0]) curriculumData.badges[0].unlocked = true; // Seeker of Truth
    if (accuracyPct === 100 && curriculumData.badges[1]) curriculumData.badges[1].unlocked = true; // Tawheed Guardian

    // Check 3-Day streak badge condition (only unlock if streakDays >= 3)
    if (streakDays >= 3 && curriculumData.badges[2]) {
      curriculumData.badges[2].unlocked = true;
    }

    renderBadges(curriculumData.badges);

    if (curriculumData.lessons[currentLessonIndex + 1]) {
      curriculumData.lessons[currentLessonIndex + 1].status = 'unlocked';
    }

    renderQuestMap(curriculumData.lessons);
    showRewardModal(correctCount, total);
    updateKnowledgeLevel(2);
    saveProgress();
  } else {
    showToast(`You scored ${correctCount}/${total}. Review the Socratic guide hints and try again!`);
  }
}

// Render Terminology 3D Flashcards
function renderFlashcards(cards) {
  const container = document.getElementById('flashcard-container');
  container.innerHTML = cards.map(c => `
    <div class="flashcard" tabindex="0" role="button" aria-label="Flashcard: ${c.term}" onclick="this.classList.toggle('flipped')" onkeypress="if(event.key==='Enter'||event.key===' ') this.classList.toggle('flipped')">
      <div class="flashcard-inner">
        <div class="flashcard-front">
          <div class="flashcard-term">${c.term}</div>
          <span style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">Click or Press Enter to Flip 🔄</span>
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

// XP & Gamification Functions
function addXP(amount) {
  currentXP = Math.min(maxXP, currentXP + amount);
  updateXPBar();
  saveProgress();
}

function updateXPBar() {
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
    document.getElementById('dash-rank').innerText = rankNames[stepNum].split(':')[1].trim();
  }
}

function showRewardModal(score, total) {
  const modal = document.getElementById('reward-modal');
  document.getElementById('reward-title').innerText = `Checkpoint Passed! (${score}/${total})`;
  document.getElementById('reward-desc').innerText = `MashaAllah! You earned +100 XP, unlocked Lesson 2 on your Rihla Quest Map, and unlocked Badge: Tawheed Guardian!`;
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

  // Grade Selector & Dynamic Quarter / AI Mode Alignment
  const gradeBtns = document.querySelectorAll('.grade-btn');
  gradeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      gradeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const selectedGrade = parseInt(btn.dataset.grade);
      selectedGradeNum = selectedGrade;
      
      updateGradeAiMode(selectedGrade);
      updateQuarterTabs(selectedGrade);
    });
  });
}

// Update AI Mode & Badge automatically based on selected grade (Fixed Pluralization Bug)
function updateGradeAiMode(gradeNum) {
  const aiBadge = document.getElementById('ai-mode-badge');
  const aiDesc = document.getElementById('ai-mode-desc');

  if (gradeNum === 6) {
    currentAiMode = 'foundations';
    if (aiBadge) aiBadge.innerText = 'Grade 6 (Foundations)';
    if (aiDesc) aiDesc.innerText = '🤖 AI Mode: Guided discovery, vocabulary recall & foundational principles';
  } else if (gradeNum >= 7 && gradeNum <= 8) {
    currentAiMode = 'evidence';
    if (aiBadge) aiBadge.innerText = `Grade ${gradeNum} (Evidence)`;
    if (aiDesc) aiDesc.innerText = '🤖 AI Mode: Guided inquiry, textual proofs & prophetic narrations';
  } else if (gradeNum >= 9 && gradeNum <= 11) {
    currentAiMode = 'application';
    if (aiBadge) aiBadge.innerText = `Grade ${gradeNum} (Application)`;
    if (aiDesc) aiDesc.innerText = '🤖 AI Mode: Guided critical thinking, comparative proofs & practical real-world application';
  } else if (gradeNum === 12) {
    currentAiMode = 'sciences';
    if (aiBadge) aiBadge.innerText = 'Grade 12 (Sciences Behind Scholarship)';
    if (aiDesc) aiDesc.innerText = "🤖 AI Mode: Advanced 'Ulum al-Qur'an, Hadith methodology & Usul al-Fiqh reasoning";
  }
}

// Update Quarter Tabs dynamically for Grade 12 vs Grades 6-11
function updateQuarterTabs(gradeNum) {
  const container = document.getElementById('quarter-tabs-container');
  if (!container) return;

  if (gradeNum === 12) {
    container.innerHTML = `
      <div class="quarter-item active" data-quarter="1">
        <div class="quarter-info">
          <h4>Q1: 'Ulum al-Qur'an</h4>
          <p>Qur'anic Sciences & Exegesis</p>
        </div>
        <span class="quarter-status">Current</span>
      </div>
      <div class="quarter-item" data-quarter="2">
        <div class="quarter-info">
          <h4>Q2: 'Ulum al-Hadith</h4>
          <p>Hadith Sciences & Preservation</p>
        </div>
        <span class="quarter-status" style="background: rgba(255,255,255,0.05); color: var(--text-muted);">Locked</span>
      </div>
      <div class="quarter-item" data-quarter="3">
        <div class="quarter-info">
          <h4>Q3: Usul al-Fiqh</h4>
          <p>Principles of Jurisprudence</p>
        </div>
        <span class="quarter-status" style="background: rgba(255,255,255,0.05); color: var(--text-muted);">Locked</span>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="quarter-item active" data-quarter="1">
        <div class="quarter-info">
          <h4>Q1: Aqidah & Tawheed</h4>
          <p>Islamic Beliefs & Foundations</p>
        </div>
        <span class="quarter-status">Current</span>
      </div>
      <div class="quarter-item" data-quarter="2">
        <div class="quarter-info">
          <h4>Q2: Fiqh</h4>
          <p>Practical Law & Action</p>
        </div>
        <span class="quarter-status" style="background: rgba(255,255,255,0.05); color: var(--text-muted);">Locked</span>
      </div>
      <div class="quarter-item" data-quarter="3">
        <div class="quarter-info">
          <h4>Q3: Seerah & History</h4>
          <p>Prophetic Life & Civilization</p>
        </div>
        <span class="quarter-status" style="background: rgba(255,255,255,0.05); color: var(--text-muted);">Locked</span>
      </div>
      <div class="quarter-item" data-quarter="4">
        <div class="quarter-info">
          <h4>Q4: Adab & Character</h4>
          <p>Manners, Leadership & Ethics</p>
        </div>
        <span class="quarter-status" style="background: rgba(255,255,255,0.05); color: var(--text-muted);">Locked</span>
      </div>
    `;
  }
}

// Socratic AI Interaction with XSS Protection
function handleUserMessage() {
  const input = document.getElementById('ai-user-input');
  const text = input.value.trim();
  if (!text) return;

  appendChatMessage('user', text);
  input.value = '';

  if (text.length >= 3) {
    hasEngagedAI = true;
    checkQuizUnlock();
  }

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

// XSS Protection: textContent for user input, innerHTML only for trusted AI HTML
function appendChatMessage(sender, text) {
  const messagesBox = document.getElementById('ai-messages');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;
  
  if (sender === 'user') {
    bubble.textContent = text;
  } else {
    bubble.innerHTML = text;
  }

  messagesBox.appendChild(bubble);
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

// Grade-Adaptive Socratic AI Engine
function generateSocraticResponse(userText, mode) {
  const query = userText.toLowerCase();

  if (mode === 'sciences') {
    return `[Grade 12 Sciences Mode]: In Usul al-Fiqh and 'Ulum al-Qur'an, how do scholars analyze the textual evidence (*dalil*) for human purpose? How does understanding divine attributes (*Asma wa Sifat*) safeguard scholarly derivation?`;
  }

  if (mode === 'application') {
    return `[Grades 9–11 Application Mode]: A thoughtful query. How do you apply the principle that 'the maker determines the purpose' when navigating modern career choices, social media expectations, and ethics?`;
  }

  if (mode === 'evidence') {
    return `[Grades 7–8 Evidence Mode]: Excellent question! What textual evidence from Surah Al-Mulk (67:2) or Surah Adh-Dhariyat (51:56) directly supports your response?`;
  }

  // Foundational Mode (Grade 6)
  if (query.includes('intellect') || query.includes('alone') || query.includes('plato')) {
    return `A thoughtful reflection! Consider this: Can a painting explain why the painter created it, or can a smart watch explain why its engineer designed it? 
    <br><br>Since human intellect is itself <em>created</em>, where must we look to find our true, ultimate purpose?`;
  }

  if (query.includes('hint') || query.includes('q2') || query.includes('question')) {
    return `💡 <strong>Socratic Hint:</strong> Look closely at the story of Plato and the philosophers in Section 4. Did they lack brainpower, or were they searching in the wrong place without Divine Revelation?`;
  }

  if (query.includes('science') || query.includes('math') || query.includes('worship') || query.includes('ibadah')) {
    return `SubhanAllah! In Islam, 'Ibadah includes every beneficial action done with a sincere intention for Allah. 
    <br><br>If a student studies biology or mathematics to marvel at Allah's creation and serve humanity, how does that transform homework into worship? What intention would you make?`;
  }

  return `That is a deep question! In our Gen 3 Socratic method, we believe in earning wisdom. 
  <br><br>Based on what we studied in Lesson 1 about the <strong>Maker of the Tool</strong> and the <strong>Qur'an as the Instruction Manual</strong>, how would you begin answering that?`;
}

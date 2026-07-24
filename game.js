/* ==========================================================================
   Gen 3 Academy — The Journey (Game Mode) logic
   Celestial Rihla: winding node-path map, animated transitions.
   Vanilla JS, no framework. Reads content from data/lessons.json.
   ========================================================================== */

const SAVE_KEY = 'gen3_journey_v1';
const UNIFIED_KEY = 'gen3_academy_progress';
const SCORE_PER_Q = 20;
const REGION_BONUS = 50;
const MAX_TRIES = 3;

// --- Socratic discussion checkpoints -------------------------------------
// Each checkpoint station is a DISCUSSION with the AI teacher instead of a
// multiple-choice question. The student earns the station by explaining the
// idea in their own words. If the AI is unreachable (offline / quota spent),
// we fall back to the old multiple-choice so the game never breaks.
const WORKER_URL = 'https://gen3-ai.gwassimdragon.workers.dev';
const DISCUSSION_ENABLED = true;
const FREE_TURNS = 2;   // master it within this many replies = full points
const HELP_TURNS = 6;   // after this many, the teacher gently explains

const COLORS = { gold:'#e5c158', emerald:'#34d399', cyan:'#38bdf8', rose:'#e879a6', violet:'#8b7bf0' };

const RANKS = [
  { name: "Ma'lumat", label: 'Information',   icon: '📜', min: 0 },
  { name: "'Ilm",     label: 'Knowledge',     icon: '📖', min: 100 },
  { name: 'Fiqh',     label: 'Understanding', icon: '🗝️', min: 250 },
  { name: 'Fahm',     label: 'Wisdom',        icon: '🌟', min: 450 },
];

const DECOS = {
  rings: [
    { id:'none',    label:'None',         cls:'',            rank:0 },
    { id:'gold',    label:'Gold Ring',    cls:'ring-gold',   rank:0 },
    { id:'emerald', label:'Emerald Ring', cls:'ring-emerald',rank:1 },
    { id:'double',  label:'Double Halo',  cls:'ring-double', rank:2 },
  ],
  tags: [
    { id:'none',    label:'None',          text:'',             rank:0 },
    { id:'seeker',  label:'the Seeker',    text:'the Seeker',   rank:0 },
    { id:'talib',   label:"Talib al-'Ilm", text:"Talib al-'Ilm",rank:1 },
    { id:'devoted', label:'the Devoted',   text:'the Devoted',  rank:2 },
    { id:'wise',    label:'the Wise',      text:'the Wise',     rank:3 },
  ],
  themes: [
    { id:'starry',  label:'Celestial',    rank:0 },
    { id:'emerald', label:'Emerald',      rank:1 },
    { id:'desert',  label:'Desert',       rank:2 },
  ],
};

const HINTS = [
  "Peace be upon you. Do not hurry — return to the passage and read it slowly. The answer rests within what you have already studied.",
  "A wise student eliminates first. Which choices clearly contradict what the lesson taught? Set those aside, and look closer at what remains.",
  "Ask yourself the deeper question: what did the Creator — the Maker — intend here? Let the lesson's main principle steer your heart to the answer.",
];
const TUTOR_GREETING = "As-salamu 'alaykum, dear student. I am here to guide your reflection. Knowledge that is earned is knowledge that endures.";

// Non-Tonal Acoustic UI Sound Generator
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
}

// In-UI Toast Notification System
function showToast(message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  
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

const Game = {
  data: null,
  state: null,
  draft: { emblem:'lantern', color:'gold', name:'' },
  nodes: [],
  stages: [],
  currentRegionIdx: 0,
  currentStageIdx: 0,
  currentNodeIdx: 0,
  currentQ: null,
  tries: MAX_TRIES,
  hintIdx: 0,
  returnScreen: 'map',
  celebrateCb: null,
  audio: null,

  async init() {
    try {
      const res = await fetch('data/lessons.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      this.data = await res.json();
    } catch (e) {
      document.body.innerHTML = '<div style="padding:2rem;color:#fca5a5;font-family:sans-serif">⚠️ Could not load lessons. Please run this on a web server or live host.</div>';
      return;
    }
    this.state = this.load();
    if (this.state) {
      this.applyLook();
      this.showScreen('map');
      this.renderMap();
      this.updateTopbar();
    } else {
      this.setupCreate();
      this.showScreen('create');
    }
  },

  /* ---------------- persistence ---------------- */
  load() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; } },
  save() { 
    try { 
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state)); 
      this.syncPortalState();
    } catch {} 
  },

  syncPortalState() {
    try {
      let portalState = JSON.parse(localStorage.getItem(UNIFIED_KEY) || '{}');
      portalState.currentXP = Math.max(portalState.currentXP || 0, this.state.score);
      portalState.streakDays = Math.max(portalState.streakDays || 1, 1);
      localStorage.setItem(UNIFIED_KEY, JSON.stringify(portalState));
    } catch {}
  },

  playVerseAudio(url) {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    if (url) {
      this.audio = new Audio(url);
      this.audio.play().catch(e => {
        showToast('🔊 Press play again to start verse recitation');
      });
    }
  },

  /* ---------------- create screen ---------------- */
  setupCreate() {
    document.querySelectorAll('#emblem-picker .emblem-opt').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('#emblem-picker .emblem-opt').forEach(x => x.classList.remove('selected'));
        b.classList.add('selected'); this.draft.emblem = b.dataset.emblem; this.updateCreatePreview();
      });
    });
    document.querySelectorAll('#color-picker .color-opt').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('#color-picker .color-opt').forEach(x => x.classList.remove('selected'));
        b.classList.add('selected'); this.draft.color = b.dataset.color;
        document.documentElement.style.setProperty('--accent', COLORS[this.draft.color]); this.updateCreatePreview();
      });
    });
    this.updateCreatePreview();
  },
  onNameType() {
    this.draft.name = document.getElementById('name-input').value;
    document.getElementById('calli-preview').textContent = (this.draft.name.trim().charAt(0) || 'أ');
    this.updateCreatePreview();
  },
  updateCreatePreview() {
    document.getElementById('preview-emblem').innerHTML = this.emblemGlyph(this.draft);
    document.getElementById('preview-name').textContent = this.draft.name.trim() || 'Seeker';
  },
  createProfile() {
    const name = (document.getElementById('name-input').value || '').trim().slice(0, 18) || 'Seeker';
    this.state = {
      name, emblem: this.draft.emblem, color: this.draft.color,
      score: 0, progress: {}, done: {},
      deco: { ring: this.draft.color === 'gold' ? 'gold' : 'none', tag: 'seeker', theme: 'starry' },
      createdAt: Date.now(),
    };
    this.save(); this.applyLook(); this.showScreen('intro');
  },

  /* ---------------- look / theme ---------------- */
  applyLook() {
    document.documentElement.style.setProperty('--accent', COLORS[this.state.color] || COLORS.gold);
    const t = this.state.deco.theme;
    document.body.className = (t && t !== 'starry') ? ('theme-' + t) : '';
  },
  emblemGlyph(s) {
    if (s.emblem === 'calligraphy') return '<span class="calli">' + this.esc((s.name || 'أ').trim().charAt(0) || 'أ') + '</span>';
    return s.emblem === 'crest' ? '🛡️' : '🏮';
  },
  ringClass(id) { const r = DECOS.rings.find(x => x.id === id); return r ? r.cls : ''; },
  tagText(id) { const t = DECOS.tags.find(x => x.id === id); return t ? t.text : ''; },

  /* ---------------- screens ---------------- */
  showScreen(id) {
    ['create','intro','map','stage','profile'].forEach(s => {
      document.getElementById('screen-' + s).classList.toggle('hidden', s !== id);
    });
    const bare = (id === 'create' || id === 'intro');
    document.getElementById('topbar').classList.toggle('hidden', bare);
    document.getElementById('tutor-fab').classList.toggle('hidden', bare);
    if (bare) this.closeTutor();
    const el = document.getElementById('screen-' + id);
    el.classList.remove('screen-enter'); void el.offsetWidth; el.classList.add('screen-enter');
    window.scrollTo(0, 0);
  },

  goMap() {
    this.showScreen('map');
    this.renderMap();
    this.updateTopbar();
  },

  updateTopbar() {
    document.getElementById('tb-emblem').innerHTML = this.emblemGlyph(this.state);
    document.getElementById('tb-name').textContent = this.state.name;
    const r = this.rank();
    document.getElementById('tb-rank').textContent = r.icon + ' ' + r.name;
    document.getElementById('tb-score').textContent = '⭐ ' + this.state.score;
  },

  /* ---------------- rank & score ---------------- */
  rankIndex() { let i = 0; for (let k = 0; k < RANKS.length; k++) if (this.state.score >= RANKS[k].min) i = k; return i; },
  rank() { return RANKS[this.rankIndex()]; },
  addScore(n) {
    const before = this.rankIndex();
    this.state.score += n; this.save(); this.updateTopbar();
    return this.rankIndex() > before;
  },

  /* ---------------- stage/node model ---------------- */
  buildStages(lesson) {
    const sections = lesson.sections || [];
    const quiz = lesson.quiz || [];
    const stages = [];
    if (!sections.length && !quiz.length) return stages;
    if (!quiz.length) { sections.forEach(s => stages.push({ type:'read', sections:[s] })); return stages; }
    const per = Math.max(1, Math.ceil(sections.length / quiz.length));
    let si = 0;
    for (let q = 0; q < quiz.length; q++) {
      const chunk = sections.slice(si, si + per); si += per;
      if (chunk.length) stages.push({ type:'read', sections: chunk });
      stages.push({ type:'question', question: quiz[q] });
    }
    if (si < sections.length) stages.push({ type:'read', sections: sections.slice(si) });
    return stages;
  },

  buildNodes() {
    const nodes = [];
    (this.data.lessons || []).forEach((lesson, ri) => {
      const stages = this.buildStages(lesson);
      if (!stages.length) { nodes.push({ comingSoon:true, regionIdx:ri, title:lesson.title }); return; }
      stages.forEach((st, si) => nodes.push({
        regionIdx:ri, stageIdx:si, type:st.type, regionId:lesson.id,
        firstInRegion:si===0, title:lesson.title, num:lesson.lessonNumber,
      }));
    });

    let frontier = -1;
    nodes.forEach((n, i) => {
      n.completed = !n.comingSoon && (n.stageIdx < (this.state.progress[n.regionId] || 0));
      if (frontier === -1 && !n.comingSoon && !n.completed) frontier = i;
    });
    nodes.forEach((n, i) => {
      if (n.comingSoon) { n.status = 'soon'; }
      else if (n.completed) { n.status = 'completed'; }
      else if (i === frontier) { n.status = 'current'; }
      else { n.status = 'locked'; }
      n.enterable = (n.status === 'completed' || n.status === 'current');
    });
    this._frontier = frontier;
    return nodes;
  },

  /* ---------------- map / trail ---------------- */
  renderMap() {
    document.getElementById('map-sub').textContent =
      'Grade ' + (this.data.grade || 6) + ' · Quarter ' + (this.data.quarter || 1) + ' · ' + (this.data.domain || '');
    this.nodes = this.buildNodes();
    const N = this.nodes.length;
    const trail = document.getElementById('trail');
    const W = trail.clientWidth || 340;
    const stepY = 118, padY = 70;
    const amp = Math.min(120, (W / 2) - 46);
    const cx = W / 2;
    const pos = this.nodes.map((_, i) => ({ x: +(cx + amp * Math.sin(i * 0.9)).toFixed(1), y: padY + i * stepY }));
    const H = padY * 2 + Math.max(0, N - 1) * stepY;
    trail.style.height = H + 'px';

    const svg = document.getElementById('trail-svg');
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    const d = this.smoothPath(pos);

    const baseEl = document.getElementById('trail-base');
    const fillEl = document.getElementById('trail-fill');

    if (baseEl) {
      baseEl.setAttribute('d', d);
      baseEl.setAttribute('fill', 'none');
      baseEl.style.fill = 'none';
    }

    if (fillEl) {
      fillEl.setAttribute('d', d);
      fillEl.setAttribute('fill', 'none');
      fillEl.style.fill = 'none';
    }

    document.getElementById('nodes').innerHTML = this.nodes.map((n, i) => {
      const p = pos[i];
      const icon = n.status === 'completed' ? '✓'
        : n.status === 'locked' ? '🔒'
        : n.status === 'soon' ? '🌙'
        : (n.type === 'question' ? '❓' : '📖');
      const banner = (n.firstInRegion || n.comingSoon)
        ? '<span class="node-region" onclick="Game.clickNode(' + i + ')">' + (n.comingSoon ? '🔒 ' : '') + 'Lesson ' + (n.num || (n.regionIdx+1)) + (n.comingSoon ? ' · soon' : '') + '</span>' : '';
      return '<div class="node ' + n.status + '" style="left:' + p.x + 'px;top:' + p.y + 'px; z-index:20;" onclick="Game.clickNode(' + i + ')">' +
        banner +
        '<button class="node-btn" type="button" onclick="event.stopPropagation(); Game.clickNode(' + i + ')" aria-label="' + this.esc(n.title) + '">' + icon + '</button></div>';
    }).join('');

    const pct = N <= 1 ? 0 : Math.min(1, Math.max(0, (this._frontier === -1 ? N : this._frontier) / (N - 1)));
    const pathLen = fillEl && fillEl.getTotalLength ? fillEl.getTotalLength() : 1000;
    if (fillEl) {
      fillEl.style.strokeDasharray = pathLen;
      fillEl.style.strokeDashoffset = pathLen * (1 - pct);
    }
  },

  clickNode(nodeIdx) {
    const node = this.nodes[nodeIdx];
    if (!node) return;

    if (node.status === 'soon' || node.comingSoon) {
      showToast(`🔒 Lesson ${node.num || (node.regionIdx+1)} is coming soon! Complete Lesson 1 Checkpoint first.`);
      return;
    }

    if (node.status === 'locked') {
      showToast(`🔒 Station ${nodeIdx + 1} is locked. Complete previous stations along the trail first!`);
      return;
    }

    this.enterStage(nodeIdx);
  },

  smoothPath(pts) {
    if (!pts.length) return '';
    if (pts.length === 1) return 'M' + pts[0].x + ',' + pts[0].y;
    let d = 'M' + pts[0].x + ',' + pts[0].y;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i], p1 = pts[i + 1];
      const mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2;
      d += ' Q' + p0.x + ',' + my + ' ' + mx + ',' + my + ' T' + p1.x + ',' + p1.y;
    }
    return d;
  },

  /* ---------------- stage execution ---------------- */
  enterStage(nodeIdx) {
    const node = this.nodes[nodeIdx];
    if (!node || !node.enterable) return;
    this.currentNodeIdx = nodeIdx;
    this.currentRegionIdx = node.regionIdx;
    this.currentStageIdx = node.stageIdx;
    const lesson = this.data.lessons[node.regionIdx];
    this.stages = this.buildStages(lesson);
    this.showScreen('stage');
    this.renderStage();
  },

  regionId() { return this.data.lessons[this.currentRegionIdx].id; },

  renderStage() {
    const stage = this.stages[this.currentStageIdx];
    const card = document.getElementById('stage-card');
    const lesson = this.data.lessons[this.currentRegionIdx];
    const totalS = this.stages.length;
    const header = '<div class="stage-hdr">' +
      '<span class="stage-tag">Lesson ' + lesson.lessonNumber + ' · Station ' + (this.currentStageIdx+1) + '/' + totalS + '</span>' +
      '<button class="stage-close" onclick="Game.goMap()">&times;</button></div>';

    if (stage.type === 'read') {
      const body = (stage.sections || []).map(s => this.renderSection(s)).join('');
      card.innerHTML = header + body +
        '<div class="stage-actions"><button class="btn btn-primary btn-full" onclick="Game.completeStage()">Continue ➔</button></div>';
    } else if (stage.type === 'question') {
      this.currentQ = stage.question;
      this.tries = MAX_TRIES;
      this.hintIdx = 0;
      this._header = header;
      if (DISCUSSION_ENABLED) this.renderDiscussion();
      else this.renderMCQ();
    }
  },

  /* ---------------- checkpoint: multiple-choice (fallback) ---------------- */
  renderMCQ(note) {
    document.getElementById('stage-card').innerHTML = this._header +
      (note ? '<div class="disc-note">' + this.esc(note) + '</div>' : '') +
      '<div class="q-box">' +
        '<div class="q-text">❓ ' + this.esc(this.currentQ.question) + '</div>' +
        '<div class="q-opts" id="q-opts">' +
        this.currentQ.options.map((opt, i) =>
          '<button class="q-opt" onclick="Game.answerQ(' + i + ')"><span>' + String.fromCharCode(65+i) + '.</span> ' + this.esc(opt) + '</button>'
        ).join('') +
        '</div>' +
        '<div id="q-feedback" class="q-feedback hidden"></div>' +
      '</div>';
  },

  /* ---------------- checkpoint: Socratic discussion ---------------- */
  renderDiscussion() {
    this.disc = { turns: 0, history: [], done: false, busy: false };
    document.getElementById('stage-card').innerHTML = this._header +
      '<div class="disc">' +
        '<div class="disc-tag">✦ Discuss with the Teacher — explain it in your own words to pass this station</div>' +
        '<div class="disc-msgs" id="disc-msgs"></div>' +
        '<div class="disc-composer" id="disc-composer">' +
          '<textarea id="disc-input" class="disc-input" rows="1" placeholder="Type what you think…"></textarea>' +
          '<button class="disc-send" id="disc-send" onclick="Game.sendDiscussion()">➔</button>' +
        '</div>' +
      '</div>';
    // The teacher opens with the checkpoint question (no API call needed).
    this.pushDisc('ai', this.currentQ.question);
    const input = document.getElementById('disc-input');
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendDiscussion(); }
    });
    input.focus();
  },

  pushDisc(role, text, cls) {
    const box = document.getElementById('disc-msgs');
    if (!box) return null;
    const d = document.createElement('div');
    d.className = 'disc-msg ' + role + (cls ? ' ' + cls : '');
    const av = role === 'ai' ? '✦' : this.emblemGlyph(this.state);
    d.innerHTML = '<span class="disc-av">' + av + '</span><span class="disc-txt">' + this.esc(text) + '</span>';
    box.appendChild(d); box.scrollTop = box.scrollHeight;
    return d;
  },

  // What the student must reach, built from the existing checkpoint data.
  checkpointGoal() {
    const q = this.currentQ;
    const correct = (q.options && q.options[q.answer] != null) ? q.options[q.answer] : '';
    return q.question +
      (correct ? ' | Understanding to reach: ' + correct + '.' : '') +
      (q.explanation ? ' | Because: ' + q.explanation : '') +
      (q.dalil ? ' | Evidence: ' + q.dalil : '');
  },

  // Vetted lesson text — the AI's only permitted source.
  lessonTextForAI() {
    const l = this.data.lessons[this.currentRegionIdx];
    let out = 'Lesson ' + l.lessonNumber + ': ' + l.title + '\n' + (l.subtitle || '') + '\n';
    if ((l.objectives || []).length) {
      out += '\nLearning objectives for this lesson:\n' + l.objectives.map(o => '- ' + o).join('\n') + '\n';
    }
    (l.sections || []).forEach(s => {
      out += '## ' + (s.title || '') + '\n';
      ['content', 'story', 'takeaway', 'explanation', 'solution', 'intro'].forEach(k => { if (s[k]) out += s[k] + '\n'; });
      if (s.callout) out += s.callout.title + ': ' + s.callout.text + '\n';
      (s.verses || []).forEach(v => {
        out += 'VERSE ' + v.surah + ' — "' + v.translation + '" (' + v.arabic + ')' + (v.note ? ' — ' + v.note : '') + '\n';
      });
      (s.categories || []).forEach(c => { out += c.name + ': ' + (c.examples || []).join(', ') + '\n'; });
    });
    return out.slice(0, 18000);
  },

  async sendDiscussion() {
    if (!this.disc || this.disc.done || this.disc.busy) return;
    const input = document.getElementById('disc-input');
    const text = (input.value || '').trim();
    if (!text) return;

    input.value = '';
    this.pushDisc('user', text);
    this.disc.history.push({ role: 'user', text });
    this.disc.turns++;
    this.disc.busy = true;
    const sendBtn = document.getElementById('disc-send');
    if (sendBtn) sendBtn.disabled = true;
    const typing = this.pushDisc('ai', '…', 'typing');

    try {
      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'checkpoint',
          message: text,
          goal: this.checkpointGoal(),
          lesson: this.lessonTextForAI(),
          history: this.disc.history.slice(-8, -1),
          turns: this.disc.turns,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (typing) typing.remove();
      if (!res.ok || !data.reply) throw new Error(data.error || 'no reply');

      this.pushDisc('ai', data.reply);
      this.disc.history.push({ role: 'ai', text: data.reply });

      if (data.mastered === true) this.masteredDiscussion();
      else if (this.disc.turns >= HELP_TURNS) this.offerReRead();

    } catch (e) {
      if (typing) typing.remove();
      if (this.disc.turns <= 1) {
        // AI unreachable on the very first try -> fall back so the game never breaks
        showToast('⚠️ AI teacher unavailable — switching to the classic checkpoint.');
        this.renderMCQ('The teacher could not be reached, so here is the multiple-choice checkpoint instead.');
      } else {
        this.pushDisc('ai', 'I could not reply just now. Please try once more.', 'err');
      }
    } finally {
      if (this.disc) this.disc.busy = false;
      const s = document.getElementById('disc-send');
      if (s) s.disabled = false;
    }
  },

  masteredDiscussion() {
    this.disc.done = true;
    const t = this.disc.turns;
    const pts = t <= FREE_TURNS ? SCORE_PER_Q : Math.max(5, SCORE_PER_Q - (t - FREE_TURNS) * 5);
    const isReplay = this.currentStageIdx < (this.state.progress[this.regionId()] || 0);
    const rankUp = isReplay ? false : this.addScore(pts);
    SoundFX.playChime();

    const box = document.getElementById('disc-msgs');
    const win = document.createElement('div');
    win.className = 'disc-win';
    win.innerHTML = '<strong>🎉 You worked it out yourself!</strong>' +
      (isReplay
        ? '<p>Station already completed — no new points.</p>'
        : '<p>+' + pts + ' points' + (t <= FREE_TURNS ? ' — full marks, you barely needed help!' : '') + '</p>') +
      '<button class="btn btn-primary" onclick="Game.onQSuccess(' + rankUp + ')">Continue ➔</button>';
    box.appendChild(win);
    box.scrollTop = box.scrollHeight;
    const comp = document.getElementById('disc-composer');
    if (comp) comp.classList.add('hidden');
  },

  offerReRead() {
    const box = document.getElementById('disc-msgs');
    const d = document.createElement('div');
    d.className = 'disc-note';
    d.innerHTML = 'Still tricky? Go back over the passage, then return and explain it in your own words.' +
      '<button class="btn btn-secondary" style="margin-top:.6rem" onclick="Game.reReadStation()">Re-read the lesson ➔</button>';
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
  },

  reReadStation() {
    for (let i = this.currentStageIdx - 1; i >= 0; i--) {
      if (this.stages[i].type === 'read') { this.currentStageIdx = i; this.renderStage(); return; }
    }
    this.renderStage();
  },

  answerQ(idx) {
    const q = this.currentQ;
    const correct = (idx === q.answer);
    const fb = document.getElementById('q-feedback');
    fb.classList.remove('hidden', 'correct', 'wrong');

    if (correct) {
      SoundFX.playChime();
      fb.classList.add('correct');
      const pts = (this.tries === MAX_TRIES) ? SCORE_PER_Q : Math.max(5, SCORE_PER_Q - (MAX_TRIES - this.tries) * 5);
      const isReplay = this.currentStageIdx < (this.state.progress[this.regionId()] || 0);
      let rankUp = false;
      if (!isReplay) rankUp = this.addScore(pts);

      fb.innerHTML = '<strong>🎉 Correct!</strong>' +
        (isReplay ? '<p style="margin-top:0.3rem">Completed station (replay awards no new score).</p>' : '<p style="margin-top:0.3rem">+' + pts + ' points earned!</p>') +
        '<p style="margin-top:0.5rem;font-size:0.85rem"><strong>Dalil:</strong> ' + this.esc(q.dalil || q.explanation) + '</p>' +
        '<button class="btn btn-primary" style="margin-top:1rem" onclick="Game.onQSuccess(' + rankUp + ')">Continue ➔</button>';
    } else {
      this.tries--;
      fb.classList.add('wrong');
      if (this.tries > 0) {
        fb.innerHTML = '<strong>💭 Not quite right.</strong><p>You have ' + this.tries + ' tries left. The Socratic Tutor is providing a hint!</p>';
        this.autoHint();
      } else {
        fb.innerHTML = '<strong>📜 Explanation:</strong><p>' + this.esc(q.explanation) + '</p>' +
          '<p style="margin-top:0.5rem;font-size:0.85rem">Return to the passage, review carefully, and try again.</p>' +
          '<button class="btn btn-secondary" style="margin-top:1rem" onclick="Game.renderStage()">Re-read Station ➔</button>';
      }
    }
  },

  onQSuccess(rankUp) {
    if (rankUp) {
      this.celebrateRank(() => this.completeStage());
    } else {
      this.completeStage();
    }
  },

  completeStage() {
    SoundFX.playChime();
    const regId = this.regionId();
    const cur = this.state.progress[regId] || 0;
    if (this.currentStageIdx >= cur) {
      this.state.progress[regId] = this.currentStageIdx + 1;
      this.save();
    }
    const totalS = this.stages.length;
    if (this.currentStageIdx + 1 < totalS) {
      this.currentStageIdx++;
      this.renderStage();
    } else {
      this.completeRegion();
    }
  },

  completeRegion() {
    const id = this.regionId();
    const lesson = this.data.lessons[this.currentRegionIdx];
    if (!this.state.done[id]) {
      this.state.done[id] = true;
      this.addScore(REGION_BONUS);
      this.save();
      const next = this.data.lessons[this.currentRegionIdx + 1];
      const nextMsg = next && this.buildStages(next).length ? ' The next region is now open!' :
                      next ? ' (More regions coming soon, in shaa Allah.)' : ' You have completed the available journey!';
      this.showCelebrate('🌟', 'Region Complete!',
        'MashaAllah, ' + this.state.name + '! You finished “' + lesson.title + '” and earned +' + REGION_BONUS + ' points.' + nextMsg,
        () => this.goMap());
    } else {
      this.goMap();
    }
  },

  celebrateRank(cb) {
    const r = this.rank();
    this.showCelebrate(r.icon, 'You reached ' + r.name + '!',
      'Your knowledge has grown to the level of ' + r.name + ' (' + r.label + '). New decorations may be unlocked in your Profile 🎨.', cb);
  },

  /* ---------------- section rendering ---------------- */
  renderSection(sec) {
    const t = sec.type, title = '<h2>' + this.esc(sec.title || '') + '</h2>';
    if (t === 'narrative') return '<div class="lesson-card">' + title + '<p>' + this.esc(sec.content) + '</p>' +
      (sec.callout ? '<div class="callout"><strong>' + this.esc(sec.callout.title) + ':</strong> ' + this.esc(sec.callout.text) + '</div>' : '') + '</div>';
    if (t === 'analogy') return '<div class="lesson-card">' + title + '<p>' + this.esc(sec.story) + '</p>' +
      (sec.takeaway ? '<div class="callout"><strong>Takeaway:</strong> ' + this.esc(sec.takeaway) + '</div>' : '') + '</div>';
    if (t === 'socratic_inquiry') return '<div class="lesson-card">' + title + '<p>' + this.esc(sec.content) + '</p>' +
      (sec.explanation ? '<div class="support-box"><h4>Reflection</h4><p>' + this.esc(sec.explanation) + '</p></div>' : '') +
      (sec.solution ? '<div class="solution-box"><strong>🌟 The Answer:</strong> ' + this.esc(sec.solution) + '</div>' : '') + '</div>';
    if (t === 'verses') return '<div class="lesson-card">' + title + (sec.verses || []).map(v =>
      '<div class="verse-card"><div class="verse-surah">📜 ' + this.esc(v.surah) + '</div>' +
      '<div class="arabic" lang="ar" dir="rtl">' + this.esc(v.arabic) + '</div>' +
      '<div class="verse-tr">“' + this.esc(v.translation) + '”</div>' +
      (v.audioUrl ? '<button class="btn btn-secondary" style="margin-top:0.5rem;font-size:0.8rem;padding:0.3rem 0.6rem;" onclick="Game.playVerseAudio(\'' + v.audioUrl + '\')">🔊 Recite Verse (Qari Alafasy)</button>' : '') +
      (v.note ? '<div class="verse-note">💡 ' + this.esc(v.note) + '</div>' : '') + '</div>').join('') + '</div>';
    if (t === 'concept_map') return '<div class="lesson-card">' + title + (sec.intro ? '<p>' + this.esc(sec.intro) + '</p>' : '') +
      '<div class="concept-grid">' + (sec.categories || []).map(c =>
        '<div class="concept-card"><h4>✨ ' + this.esc(c.name) + '</h4><ul>' +
        (c.examples || []).map(e => '<li>' + this.esc(e) + '</li>').join('') + '</ul></div>').join('') + '</div></div>';
    return '';
  },

  /* ---------------- tutor ---------------- */
  openTutor() {
    const drawer = document.getElementById('tutor-drawer');
    if (drawer) drawer.classList.remove('hidden');
    const msgs = document.getElementById('tutor-body');
    if (msgs && !msgs.children.length) this.pushBubble(TUTOR_GREETING);
  },
  closeTutor() { 
    const drawer = document.getElementById('tutor-drawer');
    if (drawer) drawer.classList.add('hidden');
  },
  openTutorDirect() {
    this.openTutor();
  },

  // Static "How to Play" guide. Deliberately NOT an AI: the teacher lives inside
  // the checkpoint discussions, so this can't become a back door to the answers.
  openGuide() {
    const title = document.getElementById('tutor-title');
    if (title) title.textContent = '📖 How to Play';
    const body = document.getElementById('tutor-body');
    if (body) {
      body.innerHTML =
        '<div class="guide">' +
          '<h4>🗺️ Walk the trail</h4>' +
          '<p>Follow the golden path. Tap the <strong>glowing station</strong> — stations open one at a time, in order.</p>' +

          '<h4>📖 Reading stations</h4>' +
          '<p>Read the passage all the way to the end, then press <strong>Continue</strong>.</p>' +

          '<h4>✦ Checkpoint stations</h4>' +
          '<p>Here you <strong>discuss with the Teacher</strong>. It will never hand you the answer — ' +
          'it asks questions until you work it out. Explain the idea <strong>in your own words</strong> to pass.</p>' +

          '<h4>⭐ Earning points</h4>' +
          '<p>The less help you need, the more points you earn. Work it out quickly for full marks. ' +
          'Stuck? Keep talking it through — or re-read the lesson and try again.</p>' +

          '<h4>📜 Rising in rank</h4>' +
          '<p>Points raise you through the four levels of knowledge:<br>' +
          '<strong>Ma\'lumat → \'Ilm → Fiqh → Fahm</strong></p>' +

          '<h4>🎨 Your emblem</h4>' +
          '<p>Tap the paint icon at the top to change your name and unlock rings, titles and themes as you rise.</p>' +

          '<p class="guide-note">“Knowledge that is earned is knowledge that endures.”</p>' +
        '</div>';
    }
    const drawer = document.getElementById('tutor-drawer');
    if (drawer) drawer.classList.remove('hidden');
  },
  autoHint() {
    // Used only by the multiple-choice fallback. Swap the drawer out of guide mode.
    const title = document.getElementById('tutor-title');
    if (title) title.textContent = "✨ Teacher's Hint";
    const body = document.getElementById('tutor-body');
    if (body && body.querySelector('.guide')) body.innerHTML = '';
    this.openTutor();
    this.pushBubble(HINTS[this.hintIdx % HINTS.length]); this.hintIdx++;
  },
  nextHint() { this.pushBubble(HINTS[this.hintIdx % HINTS.length]); this.hintIdx++; },
  pushBubble(text) {
    const msgs = document.getElementById('tutor-body');
    if (!msgs) return;
    const b = document.createElement('div'); b.className = 'tutor-msg tutor-ai'; b.textContent = text;
    msgs.appendChild(b); msgs.scrollTop = msgs.scrollHeight;
  },

  /* ---------------- profile & identity customization ---------------- */
  openProfileModal() {
    this.openProfile();
    setTimeout(() => {
      const nameInput = document.getElementById('prof-name-input');
      if (nameInput) {
        nameInput.focus();
        nameInput.select();
      }
    }, 100);
  },
  openProfile() {
    this.returnScreen = document.getElementById('screen-stage').classList.contains('hidden') ? 'map' : 'stage';
    this.showScreen('profile');
    this.renderProfile();
  },
  closeProfile() {
    if (this.returnScreen === 'stage') { this.showScreen('stage'); this.renderStage(); }
    else this.goMap();
  },
  updateStudentName() {
    const input = document.getElementById('prof-name-input');
    if (!input) return;
    const newName = input.value.trim().slice(0, 18);
    if (!newName) {
      showToast('⚠️ Please enter a valid student name.');
      return;
    }
    this.state.name = newName;
    this.save();
    this.renderProfile();
    this.updateTopbar();
    showToast(`✨ Student name updated to "${newName}"!`);
  },
  renderProfile() {
    const s = this.state;
    const emblem = document.getElementById('prof-avatar');
    if (emblem) {
      emblem.className = 'profile-avatar ' + this.ringClass(s.deco.ring);
      emblem.innerHTML = this.emblemGlyph(s);
    }
    const tag = this.tagText(s.deco.tag);
    const profName = document.getElementById('prof-name');
    if (profName) profName.innerHTML = this.esc(s.name) + (tag ? ' <span class="name-title">“' + this.esc(tag) + '”</span>' : '');
    const r = this.rank();
    const profRank = document.getElementById('prof-rank');
    if (profRank) profRank.textContent = r.icon + ' Level ' + (this.rankIndex()+1) + ': ' + r.name + ' (' + r.label + ')';
    const profScore = document.getElementById('prof-score');
    if (profScore) profScore.textContent = '⭐ ' + s.score + ' points';

    const nameInput = document.getElementById('prof-name-input');
    if (nameInput) nameInput.value = s.name;

    this.renderDecoRow('opt-rings', 'rings', 'ring');
    this.renderDecoRow('opt-tags', 'tags', 'tag');
    this.renderDecoRow('opt-themes', 'themes', 'theme');
  },
  renderDecoRow(elId, key, slot) {
    const rankIdx = this.rankIndex(), cur = this.state.deco[slot];
    const container = document.getElementById(elId);
    if (!container) return;
    container.innerHTML = DECOS[key].map(d => {
      const locked = rankIdx < d.rank, sel = cur === d.id;
      return '<button class="deco-opt ' + (sel ? 'selected ' : '') + (locked ? 'locked' : '') + '"' +
        (locked ? '' : ' onclick="Game.setDeco(\'' + slot + '\',\'' + d.id + '\')"') + '>' +
        this.esc(d.label) + (locked ? '<span class="deco-lock">🔒 Reach ' + RANKS[d.rank].name + '</span>' : '') + '</button>';
    }).join('');
  },
  setDeco(slot, id) {
    this.state.deco[slot] = id; this.save();
    if (slot === 'theme') this.applyLook();
    this.renderProfile(); this.updateTopbar();
  },

  /* ---------------- celebration modal ---------------- */
  showCelebrate(icon, title, desc, cb) {
    const iconEl = document.getElementById('celeb-icon');
    const titleEl = document.getElementById('celeb-title');
    const descEl = document.getElementById('celeb-sub');
    const modal = document.getElementById('celeb-modal');

    if (iconEl) iconEl.textContent = icon;
    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = desc;
    if (modal) modal.classList.remove('hidden');
    this.celebrateCb = cb;
  },
  closeCeleb() {
    const modal = document.getElementById('celeb-modal');
    if (modal) modal.classList.add('hidden');
    const cb = this.celebrateCb; this.celebrateCb = null; if (cb) cb();
  },

  /* ---------------- util ---------------- */
  esc(str) { return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); },
};

document.addEventListener('DOMContentLoaded', () => Game.init());

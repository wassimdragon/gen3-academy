/* ==========================================================================
   Gen 3 Academy — The Journey (Game Mode) logic
   Celestial Rihla: winding node-path map, animated transitions.
   Vanilla JS, no framework. Reads content from data/lessons.json.
   ========================================================================== */

const SAVE_KEY = 'gen3_journey_v1';
const SCORE_PER_Q = 20;
const REGION_BONUS = 50;
const MAX_TRIES = 3;

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
const TUTOR_GREETING = "As-salamu 'alaykum, dear student. I am here to guide you, not to hand you the answer — for knowledge that is earned is knowledge that is treasured. Read with care, reflect deeply, and understanding will come, in shaa Allah.";

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

  async init() {
    try {
      const res = await fetch('data/lessons.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      this.data = await res.json();
    } catch (e) {
      document.body.innerHTML = '<div style="padding:2rem;color:#fca5a5;font-family:sans-serif">⚠️ Could not load lessons. Please run this on a local server (see project notes), not by opening the file directly.</div>';
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
  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.state)); } catch {} },

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
    // compute completion / frontier
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
    document.getElementById('trail-base').setAttribute('d', d);
    const fill = document.getElementById('trail-fill');
    fill.setAttribute('d', d);

    // nodes
    document.getElementById('nodes').innerHTML = this.nodes.map((n, i) => {
      const p = pos[i];
      const icon = n.status === 'completed' ? '✓'
        : n.status === 'locked' ? '🔒'
        : n.status === 'soon' ? '🌙'
        : (n.type === 'question' ? '❓' : '📖');
      const cap = n.comingSoon ? '' : (n.type === 'question' ? 'Checkpoint' : 'Lesson');
      const banner = (n.firstInRegion || n.comingSoon)
        ? '<span class="node-region">' + (n.comingSoon ? '🔒 ' : '') + 'Lesson ' + (n.num || (n.regionIdx+1)) + (n.comingSoon ? ' · soon' : '') + '</span>' : '';
      return '<div class="node ' + n.status + '" style="left:' + p.x + 'px;top:' + p.y + 'px">' +
        banner +
        '<button class="node-btn"' + (n.enterable ? ' onclick="Game.enterStage(' + i + ')"' : ' disabled') +
          ' aria-label="' + this.esc(n.title) + '">' + icon + '</button>' +
        (cap ? '<span class="node-cap">' + cap + '</span>' : '') +
      '</div>';
    }).join('');

    // animate the golden progress path up to the current frontier
    requestAnimationFrame(() => {
      const len = fill.getTotalLength ? fill.getTotalLength() : 0;
      const reveal = N <= 1 ? 1 : (this._frontier < 0 ? 1 : this._frontier / (N - 1));
      fill.style.strokeDasharray = len;
      fill.style.strokeDashoffset = len; // start hidden
      requestAnimationFrame(() => { fill.style.strokeDashoffset = len * (1 - reveal); });
    });
  },

  smoothPath(pts) {
    if (!pts.length) return '';
    let d = 'M ' + pts[0].x + ' ' + pts[0].y;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i-1], b = pts[i], my = (a.y + b.y) / 2;
      d += ' C ' + a.x + ' ' + my + ', ' + b.x + ' ' + my + ', ' + b.x + ' ' + b.y;
    }
    return d;
  },

  goMap() { this.showScreen('map'); this.renderMap(); this.updateTopbar(); },

  /* ---------------- stage flow ---------------- */
  enterStage(nodeIdx) {
    const n = this.nodes[nodeIdx];
    if (!n || n.comingSoon || !n.enterable) return;
    this.currentNodeIdx = nodeIdx;
    this.currentRegionIdx = n.regionIdx;
    this.stages = this.buildStages(this.data.lessons[n.regionIdx]);
    this.currentStageIdx = n.stageIdx;
    this.currentQ = null;
    this.showScreen('stage');
    this.renderStage();
  },

  regionId() { return this.data.lessons[this.currentRegionIdx].id; },

  renderStage() {
    const stage = this.stages[this.currentStageIdx];
    const total = this.stages.length;
    document.getElementById('stage-progress').innerHTML =
      '<span style="width:' + Math.round(100 * (this.currentStageIdx + 1) / total) + '%"></span>';
    if (!stage) { this.finishNode(); return; }
    if (stage.type === 'read') this.renderRead(stage);
    else this.renderQuestion(stage);
  },

  renderRead(stage) {
    const body = document.getElementById('stage-body');
    body.innerHTML =
      '<div class="read-scroll" id="read-scroll">' + stage.sections.map(s => this.renderSection(s)).join('') + '</div>' +
      '<p class="read-hint" id="read-hint">📖 Read to the end to continue…</p>' +
      '<button class="btn-primary btn-block" id="read-continue" disabled onclick="Game.finishNode()">Continue ➔</button>';
    const scroll = document.getElementById('read-scroll');
    const enable = () => { document.getElementById('read-continue').disabled = false; const h = document.getElementById('read-hint'); if (h) h.textContent = '✓ Ready — continue when you are.'; };
    if (scroll.scrollHeight <= scroll.clientHeight + 8) enable();
    else scroll.addEventListener('scroll', function onScroll() {
      if (scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 24) { enable(); scroll.removeEventListener('scroll', onScroll); }
    });
  },

  renderQuestion(stage) {
    if (this.currentQ !== this.currentStageIdx) { this.tries = MAX_TRIES; this.hintIdx = 0; this.currentQ = this.currentStageIdx; }
    const q = stage.question;
    document.getElementById('stage-body').innerHTML =
      '<div class="question-card">' +
        '<div class="q-kicker">Checkpoint Question</div>' +
        '<div class="q-text">' + this.esc(q.question) + '</div>' +
        '<div class="q-options" id="q-options">' +
          q.options.map((o, idx) => '<button class="q-opt" onclick="Game.answer(' + idx + ')">' +
            String.fromCharCode(65 + idx) + '. ' + this.esc(o) + '</button>').join('') +
        '</div>' +
        '<div class="q-tries" id="q-tries">Attempts left: ' + this.tries + '</div>' +
      '</div>';
  },

  answer(idx) {
    const q = this.stages[this.currentStageIdx].question;
    const opts = document.querySelectorAll('#q-options .q-opt');
    if (!opts.length) return;
    if (idx === q.answer) {
      opts.forEach((b, i) => { b.disabled = true; if (i === idx) b.classList.add('correct'); });
      const award = this.currentStageIdx >= (this.state.progress[this.regionId()] || 0);
      const rankedUp = award ? this.addScore(SCORE_PER_Q) : false;
      document.getElementById('q-tries').innerHTML = '<span style="color:var(--emerald)">✓ Correct!' + (award ? ' +' + SCORE_PER_Q + ' points' : '') + '</span>';
      setTimeout(() => {
        if (rankedUp) this.celebrateRank(() => this.finishNode());
        else this.finishNode();
      }, 900);
    } else {
      opts[idx].classList.add('wrong'); opts[idx].disabled = true;
      this.tries--;
      if (this.tries > 0) {
        document.getElementById('q-tries').textContent = 'Not quite. Attempts left: ' + this.tries;
        this.autoHint();
      } else {
        opts.forEach(b => b.disabled = true);
        this.showWhy(q);
      }
    }
  },

  showWhy(q) {
    const readStageIdx = this.precedingReadIdx();
    const globalReadNode = this.currentNodeIdx - (this.currentStageIdx - readStageIdx);
    const div = document.createElement('div');
    div.className = 'why-box';
    div.innerHTML = '<strong>Let us understand why.</strong><br>' + this.esc(q.explanation || '') +
      '<br><br><button class="btn-primary" onclick="Game.enterStage(' + globalReadNode + ')">Re-read the lesson ➔</button>';
    document.querySelector('.question-card').appendChild(div);
  },
  precedingReadIdx() {
    for (let i = this.currentStageIdx - 1; i >= 0; i--) if (this.stages[i].type === 'read') return i;
    return this.currentStageIdx;
  },

  finishNode() {
    const id = this.regionId();
    const np = this.currentStageIdx + 1;
    if (np > (this.state.progress[id] || 0)) { this.state.progress[id] = np; this.save(); }
    if (np >= this.stages.length) this.completeRegion();
    else this.goMap();
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
      (v.note ? '<div class="verse-note">💡 ' + this.esc(v.note) + '</div>' : '') + '</div>').join('') + '</div>';
    if (t === 'concept_map') return '<div class="lesson-card">' + title + (sec.intro ? '<p>' + this.esc(sec.intro) + '</p>' : '') +
      '<div class="concept-grid">' + (sec.categories || []).map(c =>
        '<div class="concept-card"><h4>✨ ' + this.esc(c.name) + '</h4><ul>' +
        (c.examples || []).map(e => '<li>' + this.esc(e) + '</li>').join('') + '</ul></div>').join('') + '</div></div>';
    return '';
  },

  /* ---------------- tutor ---------------- */
  openTutor() {
    document.getElementById('tutor').classList.remove('hidden');
    const msgs = document.getElementById('tutor-msgs');
    if (!msgs.children.length) this.pushBubble(TUTOR_GREETING);
    const onQ = this.stages[this.currentStageIdx] && this.stages[this.currentStageIdx].type === 'question'
      && !document.getElementById('screen-stage').classList.contains('hidden');
    document.getElementById('tutor-hint-btn').disabled = !onQ;
  },
  closeTutor() { document.getElementById('tutor').classList.add('hidden'); },
  autoHint() {
    document.getElementById('tutor').classList.remove('hidden');
    document.getElementById('tutor-hint-btn').disabled = false;
    this.pushBubble(HINTS[this.hintIdx % HINTS.length]); this.hintIdx++;
  },
  nextHint() { this.pushBubble(HINTS[this.hintIdx % HINTS.length]); this.hintIdx++; },
  pushBubble(text) {
    const msgs = document.getElementById('tutor-msgs');
    const b = document.createElement('div'); b.className = 'bubble teacher'; b.textContent = text;
    msgs.appendChild(b); msgs.scrollTop = msgs.scrollHeight;
  },

  /* ---------------- profile ---------------- */
  openProfile() {
    this.returnScreen = document.getElementById('screen-stage').classList.contains('hidden') ? 'map' : 'stage';
    this.showScreen('profile'); this.renderProfile();
  },
  closeProfile() {
    if (this.returnScreen === 'stage') { this.showScreen('stage'); this.renderStage(); }
    else this.goMap();
  },
  renderProfile() {
    const s = this.state;
    const emblem = document.getElementById('profile-emblem');
    emblem.className = 'preview-emblem big ' + this.ringClass(s.deco.ring);
    emblem.innerHTML = this.emblemGlyph(s);
    const tag = this.tagText(s.deco.tag);
    document.getElementById('profile-name').innerHTML = this.esc(s.name) + (tag ? ' <span class="name-title">“' + this.esc(tag) + '”</span>' : '');
    const r = this.rank();
    document.getElementById('profile-rank').textContent = r.icon + ' Level ' + (this.rankIndex()+1) + ': ' + r.name + ' (' + r.label + ')';
    document.getElementById('profile-score').textContent = '⭐ ' + s.score + ' points';
    this.renderDecoRow('deco-rings', 'rings', 'ring');
    this.renderDecoRow('deco-tags', 'tags', 'tag');
    this.renderDecoRow('deco-themes', 'themes', 'theme');
  },
  renderDecoRow(elId, key, slot) {
    const rankIdx = this.rankIndex(), cur = this.state.deco[slot];
    document.getElementById(elId).innerHTML = DECOS[key].map(d => {
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
    document.getElementById('celebrate-ic').textContent = icon;
    document.getElementById('celebrate-title').textContent = title;
    document.getElementById('celebrate-desc').textContent = desc;
    document.getElementById('celebrate').classList.remove('hidden');
    this.celebrateCb = cb;
  },
  closeCelebrate() {
    document.getElementById('celebrate').classList.add('hidden');
    const cb = this.celebrateCb; this.celebrateCb = null; if (cb) cb();
  },

  /* ---------------- util ---------------- */
  esc(str) { return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); },
};

document.addEventListener('DOMContentLoaded', () => Game.init());

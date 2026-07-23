/* ==========================================================================
   Gen 3 Academy — Socratic AI Teacher
   Talks to the Cloudflare Worker (which holds the API key — never the browser).
   ========================================================================== */

const WORKER_URL = 'https://gen3-ai.gwassimdragon.workers.dev';
const MAX_HISTORY = 10;   // turns sent for context

const STARTERS = [
  "I don't really know where to start — help me think.",
  "Why can't we just work out our purpose with our own minds?",
  "What does the lesson mean by life being a 'test'?",
  "Can everyday things like studying count as worship?",
];

const AI = {
  data: null,
  lessonIdx: 0,
  history: [],     // [{role:'user'|'ai', text}]
  busy: false,

  async init() {
    try {
      const res = await fetch('data/lessons.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      this.data = await res.json();
    } catch (e) {
      document.getElementById('messages').innerHTML =
        '<div class="msg ai"><div class="msg-av">!</div><div class="msg-bub msg-err">Could not load the lesson content. Please run this from a web server (not by opening the file directly).</div></div>';
      return;
    }

    // Only lessons that actually have content are useful to discuss
    const sel = document.getElementById('lesson-select');
    this.data.lessons.forEach((l, i) => {
      const has = (l.sections || []).length > 0;
      const o = document.createElement('option');
      o.value = i;
      o.textContent = 'Lesson ' + l.lessonNumber + ' — ' + l.title + (has ? '' : ' (coming soon)');
      o.disabled = !has;
      sel.appendChild(o);
    });
    const firstReady = this.data.lessons.findIndex(l => (l.sections || []).length > 0);
    this.lessonIdx = firstReady >= 0 ? firstReady : 0;
    sel.value = this.lessonIdx;
    sel.addEventListener('change', () => {
      this.lessonIdx = parseInt(sel.value, 10);
      this.newSession();
    });

    this.renderStarters();
    this.updateHeader();
    this.wireComposer();
  },

  lesson() { return this.data.lessons[this.lessonIdx]; },

  updateHeader() {
    const l = this.lesson();
    document.getElementById('hdr-lesson').textContent =
      'Lesson ' + l.lessonNumber + ' · ' + l.title;
  },

  renderStarters() {
    document.getElementById('starters').innerHTML = STARTERS
      .map((s, i) => '<button class="starter" onclick="AI.useStarter(' + i + ')">' + this.esc(s) + '</button>')
      .join('');
  },
  useStarter(i) {
    document.getElementById('input').value = STARTERS[i];
    this.send();
  },

  wireComposer() {
    const input = document.getElementById('input');
    const send = document.getElementById('send');
    send.addEventListener('click', () => this.send());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
    });
    // auto-grow the textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 140) + 'px';
    });
    document.getElementById('finish-btn').addEventListener('click', () => this.finish());
  },

  /* ---------- turning the lesson JSON into plain text for grounding ---------- */
  lessonText() {
    const l = this.lesson();
    let out = 'Lesson ' + l.lessonNumber + ': ' + l.title + '\n' + (l.subtitle || '') + '\n\n';
    if ((l.objectives || []).length) out += 'Objectives:\n' + l.objectives.map(o => '- ' + o).join('\n') + '\n\n';
    (l.sections || []).forEach(s => {
      out += '## ' + (s.title || '') + '\n';
      if (s.content)     out += s.content + '\n';
      if (s.story)       out += s.story + '\n';
      if (s.takeaway)    out += 'Takeaway: ' + s.takeaway + '\n';
      if (s.explanation) out += s.explanation + '\n';
      if (s.solution)    out += 'Conclusion: ' + s.solution + '\n';
      if (s.callout)     out += s.callout.title + ': ' + s.callout.text + '\n';
      if (s.intro)       out += s.intro + '\n';
      (s.verses || []).forEach(v => {
        out += 'VERSE — ' + v.surah + ' — Arabic: ' + v.arabic +
               ' — Translation: "' + v.translation + '"' + (v.note ? ' — Note: ' + v.note : '') + '\n';
      });
      (s.categories || []).forEach(c => {
        out += c.name + ': ' + (c.examples || []).join(', ') + '\n';
      });
      out += '\n';
    });
    return out;
  },

  /* ---------- talking to the worker ---------- */
  async ask(payload) {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.reply) {
      throw new Error(data.error ? (data.error + (data.detail ? ': ' + data.detail : '')) : 'Request failed');
    }
    return data.reply;
  },

  async send() {
    if (this.busy) return;
    const input = document.getElementById('input');
    const text = input.value.trim();
    if (!text) return;

    document.getElementById('welcome').classList.add('hidden');
    input.value = '';
    input.style.height = 'auto';

    this.addMessage('user', text);
    this.history.push({ role: 'user', text });
    this.setBusy(true);
    const typing = this.addTyping();

    try {
      const reply = await this.ask({
        message: text,
        lesson: this.lessonText(),
        history: this.history.slice(-MAX_HISTORY - 1, -1),
      });
      typing.remove();
      this.addMessage('ai', reply);
      this.history.push({ role: 'ai', text: reply });
      document.getElementById('finish-btn').disabled = this.history.length < 4;
    } catch (err) {
      typing.remove();
      this.addMessage('ai', 'Sorry — I could not reach the teacher just now. Please try again in a moment.', true);
      console.error(err);
    } finally {
      this.setBusy(false);
      input.focus();
    }
  },

  async finish() {
    if (this.busy || this.history.length < 2) return;
    this.setBusy(true);
    const typing = this.addTyping();
    try {
      const reply = await this.ask({
        mode: 'summary',
        message: '',
        lesson: this.lessonText(),
        history: this.history.slice(-MAX_HISTORY),
      });
      typing.remove();
      document.getElementById('report-body').innerHTML = this.md(reply);
      document.getElementById('screen-chat').classList.add('hidden');
      document.getElementById('screen-report').classList.remove('hidden');
      window.scrollTo(0, 0);
    } catch (err) {
      typing.remove();
      this.addMessage('ai', 'I could not put your summary together just now. Please try again.', true);
      console.error(err);
    } finally {
      this.setBusy(false);
    }
  },

  backToChat() {
    document.getElementById('screen-report').classList.add('hidden');
    document.getElementById('screen-chat').classList.remove('hidden');
    this.scrollDown();
  },

  newSession() {
    this.history = [];
    document.getElementById('messages').innerHTML = '';
    document.getElementById('welcome').classList.remove('hidden');
    document.getElementById('finish-btn').disabled = true;
    document.getElementById('screen-report').classList.add('hidden');
    document.getElementById('screen-chat').classList.remove('hidden');
    this.updateHeader();
  },

  /* ---------- rendering ---------- */
  addMessage(role, text, isError) {
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + role;
    wrap.innerHTML =
      '<div class="msg-av">' + (role === 'ai' ? '✦' : 'You'.charAt(0)) + '</div>' +
      '<div class="msg-bub' + (isError ? ' msg-err' : '') + '">' +
        (role === 'ai' ? this.md(text) : this.esc(text)) +
      '</div>';
    document.getElementById('messages').appendChild(wrap);
    this.scrollDown();
    return wrap;
  },

  addTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'msg ai';
    wrap.innerHTML = '<div class="msg-av">✦</div><div class="msg-bub"><span class="dots"><span></span><span></span><span></span></span></div>';
    document.getElementById('messages').appendChild(wrap);
    this.scrollDown();
    return wrap;
  },

  setBusy(v) {
    this.busy = v;
    document.getElementById('send').disabled = v;
    document.getElementById('finish-btn').disabled = v || this.history.length < 4;
  },

  scrollDown() {
    const el = document.getElementById('chat-scroll');
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  },

  /* Small, safe markdown renderer (escapes first, then formats). */
  md(text) {
    const lines = this.esc(text).split('\n');
    let html = '', inList = false;
    const inline = (s) => s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(?:^|\s)\*([^*\n]+)\*(?=\s|$|[.,!?])/g, ' <em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

    for (const raw of lines) {
      const line = raw.trimEnd();
      const bullet = line.match(/^\s*[-*]\s+(.*)$/);
      const head = line.match(/^\s*(#{1,4})\s+(.*)$/);

      if (bullet) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += '<li>' + inline(bullet[1]) + '</li>';
        continue;
      }
      if (inList) { html += '</ul>'; inList = false; }

      if (head) { const lv = Math.min(4, head[1].length + 1); html += '<h' + lv + '>' + inline(head[2]) + '</h' + lv + '>'; continue; }
      if (!line.trim()) continue;
      html += '<p>' + inline(line) + '</p>';
    }
    if (inList) html += '</ul>';
    return html;
  },

  esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
};

document.addEventListener('DOMContentLoaded', () => AI.init());

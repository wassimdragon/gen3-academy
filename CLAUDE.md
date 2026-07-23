# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Gen 3 Academy" — a static, front-end-only prototype of an AI-gamified Islamic Studies platform for
grades 6–12 (Aqidah & Tawheed, Fiqh, Seerah, Adab). It's a single HTML page with vanilla JS and CSS;
there is no build step, package manager, framework, or backend.

## Running it locally

There is no dev server, task runner, or `package.json`. Because `app.js` loads lesson content via
`fetch('data/lessons.json')`, opening `index.html` directly with a `file://` URL will fail (blocked by
browser CORS rules for local files). Serve the directory instead, e.g.:

```
python -m http.server 8000
```

then open `http://localhost:8000/`. There are no linters, formatters, or automated tests configured.

## Architecture

**Three files drive the whole app**, plus one JSON data file:

- `index.html` — static shell for both views (Student Portal and Parent/Teacher Dashboard), plus the
  AI tutor drawer and reward modal. Most content areas (`#quest-map`, `#dynamic-lesson-body`,
  `#quiz-container`, `#flashcard-container`, `#badge-grid`, etc.) are empty containers populated at
  runtime by `app.js`.
- `app.js` — all application logic, no framework. On `DOMContentLoaded` it fetches
  `data/lessons.json` into the global `curriculumData` and renders everything from there. All
  gamification state (`currentXP`, `maxXP`, `hasEngagedAI`, `hasCompletedAnalogy`,
  `currentLessonIndex`) lives in plain module-level JS variables — nothing is persisted, so a page
  reload resets all progress.
- `styles.css` — single stylesheet; the entire visual design system (colors, fonts, radii, shadows,
  transitions) is defined as CSS custom properties on `:root`. No preprocessor, no CSS framework.
- `data/lessons.json` — the **only** data file actually loaded by the app. Top-level shape is
  `{ grade, quarter, domain, lessons[], flashcards[], badges[] }`. Only `lessons[0]` (Lesson 1) has
  real content; lessons 2–4 are stubs (`sections: []`, `status: "locked"` or `"unlocked"` with no
  body) used to preview the quest-map progression.
- `data/lesson1.json` is a **standalone earlier draft** of Lesson 1 only. `app.js` never fetches it —
  don't assume edits there affect the running app; treat `data/lessons.json` as the single source of
  truth and port any wanted changes into it.

**Content rendering is data-driven.** Each lesson section in `lessons.json` has a `type` discriminator
(`narrative`, `analogy`, `socratic_inquiry`, `verses`, `concept_map`), and `renderSectionCard()` in
`app.js` has one branch per type. To add a new kind of lesson content, add a case there and a matching
shape in the JSON — don't special-case content by lesson/section id.

**Checkpoint quiz gating**: the Mission Verification Checkpoint quiz starts locked
(`#quiz-container` dimmed + non-interactive) and is unlocked by `checkQuizUnlock()` only after the
student either sends a message to the AI tutor (`hasEngagedAI`) or picks the correct option in the
Strange Tool analogy (`hasCompletedAnalogy`). This gate is intentional pedagogy (see below), not a bug.

**The Socratic "AI" tutor is a rule-based stub**, not a real model call. `generateSocraticResponse()`
branches first on `currentAiMode` (set by grade band) and then, in foundations mode, on keyword
matching against the user's input. If this is ever wired up to a real LLM, the guiding-not-answering
behavior and the grade-based mode split below must be preserved.

**Grade-band AI modes** (set by `updateGradeAiMode()`) map directly to the four-stage pedagogical
progression documented in `1. Curriculum Philosophy .docx`:
- Grade 6 → `foundations`: guided discovery, vocabulary/recall.
- Grades 7–8 → `evidence`: textual proofs, Qur'anic/Prophetic evidence.
- Grades 9–11 → `application`: critical thinking, comparative reasoning, real-world application.
- Grade 12 → `sciences`: 'Ulum al-Qur'an, 'Ulum al-Hadith, Usul al-Fiqh methodology.

This is a separate axis from the **four "ascending knowledge levels"** shown in the sidebar
(`updateKnowledgeLevel()`): Level 1 Ma'lumat (information) → Level 2 'Ilm (knowledge) → Level 3 Fiqh
(deep understanding) → Level 4 Fahm (wisdom/insight). Don't conflate grade-band AI mode with knowledge
level — they're tracked and updated independently.

## Design constraints from the source planning docs

`1. Curriculum Philosophy .docx` and `2. Project Proposal_...docx` (gitignored — see below) set hard
constraints on this project that aren't obvious from the code alone:

- **No music.** `SoundFX` in `app.js` deliberately generates a non-tonal percussive "thud" (a single
  oscillator with a pitch ramp, no melody/chord progression) rather than a musical chime, per the
  proposal's ban on music. If audio is extended, keep it non-melodic (nasheed without instruments is
  the only acceptable musical-adjacent alternative called out in the proposal).
- **No drawn/animated depictions of living beings.** The proposal explicitly avoids illustrated
  characters or animated depictions of humans/animals for Islamic-sensitivity reasons; photographic
  images are allowed only when educationally necessary (e.g. historical context). The current UI uses
  emoji/icons instead of character art — preserve that pattern rather than introducing mascot-style
  illustrations.
- **The AI must guide, not answer.** Per the pedagogy ("knowledge that is earned becomes valued"), any
  AI tutor behavior should offer hints, ask guiding questions, and redirect to Qur'an/Sunnah sources —
  never hand over the checkpoint quiz answers directly.

## Repo housekeeping

- `.gitignore` excludes `*.docx`/`*.doc` ("Sensitive source files (DO NOT COMMIT)"). The three `.docx`
  files at the repo root (curriculum philosophy, project proposal, Lesson 1 source doc) are reference
  material for the pedagogy and content — read them for context, but they're intentionally untracked;
  don't try to commit them.
- There is a stray `.git_old/` directory at the repo root — leave it alone, it's not part of the active
  git tooling.

/* ============================================================
   progress.js — front-end-only progress tracking.
   Stores state per lesson id in localStorage under one key.
   Designed so a future backend can replace getStore/setStore
   with real API calls without touching call sites elsewhere.
   ============================================================ */

const PROGRESS_KEY = "yaoguai:progress:v1";

function getStore() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; }
  catch (e) { return {}; }
}
function setStore(obj) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(obj));
}

const Progress = {
  /** status: "locked" | "available" | "in_progress" | "done" */
  getLesson(id) {
    const store = getStore();
    return store[id] || { status: "available", sections: {}, challenge: false, pct: 0 };
  },
  setSectionSeen(id, sectionId) {
    const store = getStore();
    const entry = store[id] || { status: "available", sections: {}, challenge: false, pct: 0 };
    entry.sections[sectionId] = true;
    entry.status = "in_progress";
    store[id] = entry;
    setStore(store);
  },
  setChallengeSolved(id) {
    const store = getStore();
    const entry = store[id] || { status: "in_progress", sections: {}, challenge: false, pct: 0 };
    entry.challenge = true;
    store[id] = entry;
    setStore(store);
  },
  markComplete(id, totalSections) {
    const store = getStore();
    const entry = store[id] || { status: "in_progress", sections: {}, challenge: false, pct: 0 };
    entry.status = "done";
    entry.pct = 100;
    store[id] = entry;
    setStore(store);
  },
  computePct(id, totalSections) {
    const entry = this.getLesson(id);
    if (entry.status === "done") return 100;
    const seen = Object.keys(entry.sections || {}).length;
    return totalSections ? Math.round((seen / totalSections) * 100) : 0;
  },
  overall(allIds) {
    const store = getStore();
    const done = allIds.filter((id) => (store[id] || {}).status === "done").length;
    return { done, total: allIds.length };
  },
  reset() { localStorage.removeItem(PROGRESS_KEY); },
};

window.Progress = Progress;

/* ============================================================
   progress.js — progress tracking with JWT authenticated sync.
   Stores state per lesson id in localStorage, and automatically
   syncs with the YAOGUAI backend database for logged-in users.
   ============================================================ */

const PROGRESS_KEY = "yaoguai:progress:v1";

function getStore() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; }
  catch (e) { return {}; }
}

function setStore(obj) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(obj)); } catch (_) {}
  // Sync to server if authenticated
  if (window.CryptoAPI && window.CryptoAPI.auth && window.CryptoAPI.auth.isLoggedIn()) {
    window.CryptoAPI.auth.saveProgress(obj).catch(() => {});
  }
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
    entry.sections = entry.sections || {};
    entry.sections[sectionId] = true;
    if (entry.status !== "done") entry.status = "in_progress";
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
  syncFromServer(serverProgress) {
    if (!serverProgress || typeof serverProgress !== "object") return;
    const store = getStore();
    const merged = Object.assign({}, store, serverProgress);
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(merged)); } catch (_) {}
    window.dispatchEvent(new CustomEvent("yaoguai:progress-synced", { detail: merged }));
  },
  async loadFromServer() {
    if (window.CryptoAPI && window.CryptoAPI.auth && window.CryptoAPI.auth.isLoggedIn()) {
      try {
        const res = await window.CryptoAPI.auth.getProgress();
        if (res && res.progress) {
          this.syncFromServer(res.progress);
        }
      } catch (_) {}
    }
  },
  reset() {
    try { localStorage.removeItem(PROGRESS_KEY); } catch (_) {}
  },
};

window.Progress = Progress;

// Auto-sync on page load if logged in
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    Progress.loadFromServer();
  });
}

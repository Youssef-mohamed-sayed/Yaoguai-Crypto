/* ============================================================
   progress.js — progress tracking with JWT authenticated sync.
   Stores state per lesson id in localStorage, and automatically
   syncs with the YAOGUAI backend database for logged-in users.
   ============================================================ */

const LEGACY_PROGRESS_KEY = "yaoguai:progress:v1";
let progressRevision = 0;

function progressOwner() {
  const auth = window.CryptoAPI && window.CryptoAPI.auth;
  const user = auth && auth.isLoggedIn() && auth.getUser();
  return user && user.id ? String(user.id) : null;
}

function progressKey() {
  const owner = progressOwner();
  return owner ? `yaoguai:progress:v2:${owner}` : null;
}

// The shared legacy cache has no trustworthy owner and must never be imported.
try { localStorage.removeItem(LEGACY_PROGRESS_KEY); } catch (_) {}

function getStore() {
  const key = progressKey();
  if (!key) return {};
  try { return JSON.parse(localStorage.getItem(key)) || {}; }
  catch (e) { return {}; }
}

function setStore(obj) {
  const key = progressKey();
  if (!key) return;
  progressRevision++;
  try { localStorage.setItem(key, JSON.stringify(obj)); } catch (_) {}
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
  syncFromServer(serverProgress, userId) {
    if (!progressOwner() || String(userId) !== progressOwner()) return;
    if (!serverProgress || typeof serverProgress !== "object" || Array.isArray(serverProgress)) return;
    // Replace, never merge account data with an unidentified browser cache.
    try { localStorage.setItem(progressKey(), JSON.stringify(serverProgress)); } catch (_) {}
    window.dispatchEvent(new CustomEvent("yaoguai:progress-synced"));
  },
  async loadFromServer() {
    const owner = progressOwner();
    if (!owner) return;
    const token = window.CryptoAPI.auth.getToken();
    const revision = progressRevision;
    try {
      const res = await window.CryptoAPI.auth.getProgress();
      if (res && res.progress && owner === progressOwner()
          && token === window.CryptoAPI.auth.getToken() && revision === progressRevision) {
        this.syncFromServer(res.progress, owner);
      }
    } catch (_) {}
  },
  reset() {
    progressRevision++;
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith("yaoguai:progress:")) localStorage.removeItem(key);
      }
    } catch (_) {}
    window.dispatchEvent(new CustomEvent("yaoguai:progress-synced"));
  },
};

window.Progress = Progress;

// Auto-sync on page load if logged in
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    Progress.loadFromServer();
  });
}

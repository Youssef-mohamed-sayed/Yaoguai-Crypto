/* ============================================================
   auth-ui.js — Topbar auth widgets, Login/Register modal,
   avatar upload (.png & .jpg strictly enforced), and guest
   interaction prompts for YAOGUAI.
   ============================================================ */

(function () {
  const DEFAULT_AVATAR = "/assets/images/default-avatar.svg";

  function getAvatarUrl(user) {
    if (!user || !user.avatar_url) return DEFAULT_AVATAR;
    let url = user.avatar_url;
    if (url.startsWith("/")) return url;
    return "/" + url;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  const AuthUI = {
    isLoggedIn() {
      return Boolean(window.CryptoAPI && window.CryptoAPI.auth && window.CryptoAPI.auth.isLoggedIn());
    },

    getUser() {
      return (window.CryptoAPI && window.CryptoAPI.auth && window.CryptoAPI.auth.getUser()) || null;
    },

    init() {
      this.injectStyles();
      this.ensureModalDOM();
      this.renderTopbar();
      this.checkLessonGuestBanner();

      // Refresh fresh profile from server if token exists
      if (this.isLoggedIn() && window.CryptoAPI) {
        window.CryptoAPI.auth.me().then(res => {
          if (res && res.user) {
            this.renderTopbar();
            this.checkLessonGuestBanner();
          }
        }).catch((err) => {
          if (err.status !== 401) return;
          // If token expired or invalid, log out cleanly
          if (window.CryptoAPI && window.CryptoAPI.auth) {
            window.CryptoAPI.auth.logout().catch(() => {});
            this.resetSessionUI();
            this.renderTopbar();
            this.checkLessonGuestBanner();
          }
        });
      }

      window.addEventListener("yaoguai:progress-synced", () => {
        this.renderTopbar();
      });
    },

    injectStyles() {
      if (document.getElementById("auth-ui-styles")) return;
      const style = document.createElement("style");
      style.id = "auth-ui-styles";
      style.textContent = `
        /* User capsule in topbar */
        .auth-topbar-wrap { display: flex; align-items: center; gap: 10px; }
        .user-chip {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 3px 10px 3px 4px;
          border: 1px solid var(--line);
          background: var(--ink-raise);
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .user-chip:hover { border-color: var(--red); background: var(--red-wash); }
        .user-avatar-sm {
          width: 24px; height: 24px; border-radius: 50%;
          object-fit: cover; border: 1px solid var(--red-bright);
          background: #000; display: block;
        }
        .user-name {
          font-family: var(--mono); font-size: 12.5px;
          color: var(--paper); font-weight: 500;
        }
        .auth-btn {
          font-family: var(--mono); font-size: 12px;
          padding: 5px 12px; cursor: pointer;
          background: var(--ink-card); border: 1px solid var(--line);
          color: var(--paper); transition: all 0.15s ease;
        }
        .auth-btn:hover { border-color: var(--red); color: var(--paper); background: var(--red-wash); }
        .auth-btn.primary { background: var(--red); border-color: var(--red); color: #fff; }
        .auth-btn.primary:hover { background: var(--red-bright); }

        /* Auth Modal Overlay & Box */
        .auth-modal-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(5, 5, 5, 0.85);
          backdrop-filter: blur(8px);
          display: none; align-items: center; justify-content: center;
          padding: 20px;
        }
        .auth-modal-overlay.active { display: flex; }
        .auth-modal-card {
          width: 100%; max-width: 440px;
          max-height: calc(100dvh - 40px); overflow-y: auto;
          overflow-wrap: anywhere;
          background: var(--ink-card);
          border: 1px solid var(--line);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8), 0 0 0 1px var(--red-deep);
          display: flex; flex-direction: column;
          animation: authPop 0.18s ease-out;
        }
        @keyframes authPop {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .auth-modal-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; border-bottom: 1px solid var(--line);
        }
        .auth-modal-head h3 {
          margin: 0; font-family: var(--serif); font-size: 20px;
          color: var(--paper); display: flex; align-items: center; gap: 8px;
        }
        .auth-modal-close {
          background: none; border: 0; color: var(--paper-faint);
          font-size: 22px; line-height: 1; cursor: pointer; padding: 4px 8px;
        }
        .auth-modal-close:hover { color: var(--paper); }

        .auth-prompt-banner {
          background: var(--red-wash); border-bottom: 1px solid var(--red-deep);
          padding: 10px 18px; font-size: 13px; color: #e8b0b2;
          display: flex; align-items: center; gap: 10px;
        }
        .auth-prompt-banner .icon { font-size: 16px; flex: none; }

        .auth-tabs {
          display: flex; border-bottom: 1px solid var(--line);
          background: var(--ink-raise);
        }
        .auth-tab-btn {
          flex: 1; background: none; border: 0; border-bottom: 2px solid transparent;
          color: var(--paper-faint); font-family: var(--mono); font-size: 12.5px;
          padding: 12px 10px; cursor: pointer; text-align: center;
          transition: all 0.15s ease;
        }
        .auth-tab-btn:hover { color: var(--paper); }
        .auth-tab-btn.active {
          color: var(--paper); border-color: var(--red); background: var(--ink-card); font-weight: 600;
        }

        .auth-modal-body { padding: 22px 24px; }
        .auth-form-group { margin-bottom: 16px; }
        .auth-form-group label {
          display: block; font-family: var(--mono); font-size: 11.5px;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--paper-dim); margin-bottom: 6px;
        }
        .auth-form-group input[type="text"],
        .auth-form-group input[type="password"] {
          width: 100%; background: #000; border: 1px solid var(--line);
          color: var(--paper); font-family: var(--mono); font-size: 13.5px;
          padding: 10px 12px; outline: none; transition: border-color 0.15s;
        }
        .auth-form-group input:focus { border-color: var(--red); }
        .auth-help {
          display: block; font-size: 11.5px; color: var(--paper-faint);
          margin-top: 5px; font-family: var(--sans);
        }

        /* Avatar Picker & Preview */
        .avatar-picker-wrap {
          display: flex; flex-wrap: wrap; align-items: center; gap: 16px;
          padding: 12px; background: var(--ink-raise); border: 1px solid var(--line);
        }
        .avatar-preview-box {
          width: 54px; height: 54px; border-radius: 50%;
          border: 2px solid var(--red); object-fit: cover;
          background: #000; flex: none;
        }
        .avatar-file-input { display: none; }
        .avatar-choose-btn {
          font-family: var(--mono); font-size: 12px; padding: 6px 12px;
          background: var(--ink-card); border: 1px solid var(--line);
          color: var(--paper); cursor: pointer; display: inline-block;
        }
        .avatar-choose-btn:hover { border-color: var(--red); }

        .auth-msg {
          min-height: 20px; font-size: 13px; margin-bottom: 14px;
          display: none; padding: 8px 12px; white-space: pre-line;
        }
        .auth-msg.error {
          display: block; background: var(--red-wash);
          border: 1px solid var(--red-deep); color: #f28b82;
        }
        .auth-msg.success {
          display: block; background: rgba(90, 127, 98, 0.15);
          border: 1px solid var(--ok); color: #a8d5b1;
        }

        .auth-submit-btn {
          width: 100%; padding: 11px; font-family: var(--mono);
          font-size: 13px; font-weight: 600; cursor: pointer;
          background: var(--red); border: 1px solid var(--red);
          color: #fff; transition: background 0.15s ease;
        }
        .auth-submit-btn:hover { background: var(--red-bright); }
        .auth-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .auth-switch-link {
          margin-top: 14px; text-align: center; font-size: 12.5px; color: var(--paper-faint);
        }
        .auth-switch-link a { color: var(--paper-dim); text-decoration: underline; cursor: pointer; }
        .auth-switch-link a:hover { color: var(--red-bright); }

        /* Profile pane */
        .profile-card { text-align: center; padding: 10px 0; }
        .profile-avatar-lg {
          width: 80px; height: 80px; border-radius: 50%;
          border: 3px solid var(--red); object-fit: cover;
          margin: 0 auto 12px; background: #000; display: block;
        }
        .profile-username {
          font-family: var(--serif); font-size: 22px; color: var(--paper); margin: 0 0 6px;
        }
        .profile-stat {
          font-family: var(--mono); font-size: 13px; color: var(--paper-dim); margin-bottom: 18px;
        }
        .profile-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }

        /* Lesson Guest Banner */
        .lesson-guest-banner {
          background: linear-gradient(90deg, rgba(142, 42, 46, 0.18), var(--ink-card));
          border: 1px solid var(--red-deep);
          border-left: 4px solid var(--red);
          padding: 14px 18px; margin-bottom: 30px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 16px; flex-wrap: wrap;
        }
        .guest-banner-left { display: flex; align-items: center; gap: 14px; }
        .guest-banner-icon { font-size: 22px; flex: none; line-height: 1; }
        .guest-banner-text strong { display: block; font-size: 14px; color: var(--paper); }
        .guest-banner-text span { font-size: 12.5px; color: var(--paper-dim); }
        .guest-banner-btn {
          font-family: var(--mono); font-size: 12px; padding: 6px 14px;
          background: var(--red); border: 1px solid var(--red); color: #fff;
          cursor: pointer; flex: none;
        }
        .guest-banner-btn:hover { background: var(--red-bright); }

        @media (max-width: 600px) {
          .lesson-guest-banner { flex-direction: column; align-items: flex-start; }
          .guest-banner-btn { width: 100%; text-align: center; }
        }
      `;
      document.head.appendChild(style);
    },

    ensureModalDOM() {
      if (document.getElementById("auth-modal")) return;
      const overlay = document.createElement("div");
      overlay.id = "auth-modal";
      overlay.className = "auth-modal-overlay";
      overlay.innerHTML = `
        <div class="auth-modal-card" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
          <div class="auth-modal-head">
            <h3 id="auth-modal-title"><span style="color:var(--red-bright)">妖怪</span> YAOGUAI AUTH</h3>
            <button class="auth-modal-close" onclick="AuthUI.closeModal()" title="Close">&times;</button>
          </div>
          <div id="auth-prompt-banner" class="auth-prompt-banner" style="display:none;">
            <span class="icon">🔒</span>
            <span id="auth-prompt-text"></span>
          </div>
          <div class="auth-tabs" id="auth-tabs-bar">
            <button class="auth-tab-btn active" id="tab-btn-login" onclick="AuthUI.switchTab('login')">LOG IN</button>
            <button class="auth-tab-btn" id="tab-btn-register" onclick="AuthUI.switchTab('register')">REGISTER</button>
            <button class="auth-tab-btn" id="tab-btn-profile" style="display:none;" onclick="AuthUI.switchTab('profile')">PROFILE</button>
          </div>
          <div class="auth-modal-body">
            <!-- LOGIN TAB -->
            <form novalidate id="auth-form-login" onsubmit="AuthUI.handleLogin(event)">
              <div role="alert" aria-live="polite" class="auth-msg" id="login-msg"></div>
              <div class="auth-form-group">
                <label for="login-username">Username</label>
                <input type="text" id="login-username" autocomplete="username" required spellcheck="false">
              </div>
              <div class="auth-form-group">
                <label for="login-password">Password</label>
                <input type="password" id="login-password" autocomplete="current-password" required>
              </div>
              <button type="submit" class="auth-submit-btn" id="login-submit-btn">Log In</button>
              <div class="auth-switch-link">
                Don't have an account? <a onclick="AuthUI.switchTab('register')">Register here</a>
              </div>
            </form>

            <!-- REGISTER TAB -->
            <form novalidate id="auth-form-register" style="display:none;" onsubmit="AuthUI.handleRegister(event)">
              <div role="alert" aria-live="polite" class="auth-msg" id="reg-msg"></div>
              <div class="auth-form-group">
                <label for="reg-username">Username</label>
                <input type="text" id="reg-username" autocomplete="username" required minlength="3" maxlength="30" spellcheck="false">
                <span class="auth-help">3–30 characters (letters, numbers, hyphens, underscores).</span>
              </div>
              <div class="auth-form-group">
                <label for="reg-password">Password</label>
                <input type="password" id="reg-password" autocomplete="new-password" required minlength="8" aria-describedby="reg-password-help">
                <span class="auth-help" id="reg-password-help">At least 8 characters; no more than 72 UTF-8 bytes.</span>
              </div>
              <div class="auth-form-group">
                <label>Profile Avatar (Optional)</label>
                <div class="avatar-picker-wrap">
                  <img id="reg-avatar-preview" class="avatar-preview-box" src="${DEFAULT_AVATAR}" alt="Avatar Preview">
                  <div>
                    <label class="avatar-choose-btn" for="reg-avatar-file">Choose Image</label>
                    <input type="file" id="reg-avatar-file" class="avatar-file-input" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onchange="AuthUI.onAvatarSelect(this, 'reg-avatar-preview', 'reg-msg')">
                    <span class="auth-help" style="margin-top:4px;">Strictly <strong>.png</strong> or <strong>.jpg</strong> only (max 2 MB).</span>
                  </div>
                </div>
              </div>
              <button type="submit" class="auth-submit-btn" id="reg-submit-btn">Create Account</button>
              <div class="auth-switch-link">
                Already registered? <a onclick="AuthUI.switchTab('login')">Log in here</a>
              </div>
            </form>

            <!-- PROFILE TAB -->
            <div id="auth-panel-profile" style="display:none;">
              <div role="alert" aria-live="polite" class="auth-msg" id="profile-msg"></div>
              <div class="profile-card">
                <img id="profile-avatar-img" class="profile-avatar-lg" src="${DEFAULT_AVATAR}" alt="User Avatar">
                <h4 id="profile-username-val" class="profile-username">User</h4>
                <div class="profile-stat" id="profile-progress-stat">Loading progress…</div>
                <div class="profile-actions">
                  <label class="auth-btn" for="change-avatar-file" style="text-align:center;">Change Avatar (.png / .jpg only)</label>
                  <input type="file" id="change-avatar-file" class="avatar-file-input" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onchange="AuthUI.onAvatarUpdate(this)">
                  <button type="button" class="auth-btn" onclick="AuthUI.handleLogout()" style="color:#f28b82;border-color:var(--red-deep);">Log Out</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) AuthUI.closeModal();
      });
      document.body.appendChild(overlay);
    },

    openModal(tab = "login", promptText = "") {
      this.ensureModalDOM();
      const overlay = document.getElementById("auth-modal");
      const banner = document.getElementById("auth-prompt-banner");
      const bannerText = document.getElementById("auth-prompt-text");

      if (promptText) {
        bannerText.textContent = promptText;
        banner.style.display = "flex";
      } else {
        banner.style.display = "none";
      }

      overlay.classList.add("active");

      if (this.isLoggedIn()) {
        this.switchTab("profile");
      } else {
        this.switchTab(tab === "register" ? "register" : "login");
      }
    },

    closeModal() {
      const overlay = document.getElementById("auth-modal");
      if (overlay) overlay.classList.remove("active");
    },

    promptAuth(message) {
      this.openModal("login", message || "🔒 Login required: Please log in or create an account to interact with lessons and record your progress.");
    },

    switchTab(tab) {
      const isLogged = this.isLoggedIn();
      const loginTabBtn = document.getElementById("tab-btn-login");
      const regTabBtn = document.getElementById("tab-btn-register");
      const profTabBtn = document.getElementById("tab-btn-profile");

      const formLogin = document.getElementById("auth-form-login");
      const formReg = document.getElementById("auth-form-register");
      const panelProf = document.getElementById("auth-panel-profile");

      // Hide all msgs
      ["login-msg", "reg-msg", "profile-msg"].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.display = "none"; el.textContent = ""; }
      });

      if (isLogged) {
        loginTabBtn.style.display = "none";
        regTabBtn.style.display = "none";
        profTabBtn.style.display = "block";
        profTabBtn.classList.add("active");
        formLogin.style.display = "none";
        formReg.style.display = "none";
        panelProf.style.display = "block";
        this.loadProfileData();
        return;
      }

      profTabBtn.style.display = "none";
      loginTabBtn.style.display = "block";
      regTabBtn.style.display = "block";

      if (tab === "register") {
        loginTabBtn.classList.remove("active");
        regTabBtn.classList.add("active");
        formLogin.style.display = "none";
        formReg.style.display = "block";
        const unInput = document.getElementById("reg-username");
        if (unInput) setTimeout(() => unInput.focus(), 50);
      } else {
        regTabBtn.classList.remove("active");
        loginTabBtn.classList.add("active");
        formReg.style.display = "none";
        formLogin.style.display = "block";
        const unInput = document.getElementById("login-username");
        if (unInput) setTimeout(() => unInput.focus(), 50);
      }
    },

    onAvatarSelect(inputEl, previewId, msgId) {
      const file = inputEl.files && inputEl.files[0];
      const preview = document.getElementById(previewId);
      const msgEl = document.getElementById(msgId);

      if (!file) {
        if (preview) preview.src = DEFAULT_AVATAR;
        return;
      }

      // STRICT VALIDATION: .png, .jpg, .jpeg
      const fname = file.name.toLowerCase();
      const isPngOrJpg = fname.endsWith(".png") || fname.endsWith(".jpg") || fname.endsWith(".jpeg");
      if (!isPngOrJpg) {
        if (msgEl) {
          msgEl.style.display = "block";
          msgEl.className = "auth-msg error";
          msgEl.textContent = "Invalid avatar file type. Strictly only .png and .jpg files are allowed.";
        }
        inputEl.value = "";
        if (preview) preview.src = DEFAULT_AVATAR;
        return;
      }

      if (file.size === 0 || file.size > 2 * 1024 * 1024) {
        if (msgEl) {
          msgEl.style.display = "block";
          msgEl.className = "auth-msg error";
          msgEl.textContent = "Avatar file must not be empty and must be no more than 2 MB.";
        }
        inputEl.value = "";
        if (preview) preview.src = DEFAULT_AVATAR;
        return;
      }

      if (msgEl) msgEl.style.display = "none";

      const reader = new FileReader();
      reader.onload = (e) => {
        if (preview) preview.src = e.target.result;
      };
      reader.onerror = () => {
        msgEl.style.display = "block";
        msgEl.className = "auth-msg error";
        msgEl.textContent = "Could not read the avatar file. Please select it again.";
        inputEl.value = "";
      };
      reader.readAsDataURL(file);
    },

    validateForm(username, password, registering, msgEl) {
      const errors = [];
      if (!username) errors.push("Username is required.");
      else if (registering && (username.length < 3 || username.length > 30))
        errors.push("Username must be between 3 and 30 characters.");
      else if (registering && !/^[a-zA-Z0-9_-]+$/.test(username))
        errors.push("Username can only contain letters, numbers, hyphens, and underscores.");
      if (!password) errors.push("Password is required.");
      else if (registering && Array.from(password).length < 8)
        errors.push("Password must be at least 8 characters long.");
      else if (registering && new TextEncoder().encode(password).length > 72)
        errors.push("Password must be no more than 72 UTF-8 bytes.");
      if (errors.length) {
        msgEl.style.display = "block";
        msgEl.className = "auth-msg error";
        msgEl.textContent = errors.join("\n");
        return false;
      }
      return true;
    },

    async handleLogin(event) {
      event.preventDefault();
      const msgEl = document.getElementById("login-msg");
      const btn = document.getElementById("login-submit-btn");
      const username = document.getElementById("login-username").value.trim();
      const password = document.getElementById("login-password").value;

      if (!this.validateForm(username, password, false, msgEl)) return;
      msgEl.style.display = "none";
      btn.disabled = true;
      btn.textContent = "Logging in…";

      try {
        const res = await window.CryptoAPI.auth.login(username, password);
        msgEl.style.display = "block";
        msgEl.className = "auth-msg success";
        msgEl.textContent = "Login successful! Welcome back.";
        const sessionToken = window.CryptoAPI.auth.getToken();
        setTimeout(() => {
          if (!sessionToken || sessionToken !== window.CryptoAPI.auth.getToken()) return;
          this.closeModal();
          this.renderTopbar();
          this.checkLessonGuestBanner();
          if (typeof bootTopbarChip === "function") bootTopbarChip();
          if (typeof updateProgressUI === "function") updateProgressUI();
          if (typeof renderDashboard === "function") renderDashboard();
        }, 500);
      } catch (err) {
        msgEl.style.display = "block";
        msgEl.className = "auth-msg error";
        msgEl.textContent = err.message || "Login failed. Check your credentials.";
      } finally {
        btn.disabled = false;
        btn.textContent = "Log In";
      }
    },

    async handleRegister(event) {
      event.preventDefault();
      const msgEl = document.getElementById("reg-msg");
      const btn = document.getElementById("reg-submit-btn");
      const username = document.getElementById("reg-username").value.trim();
      const password = document.getElementById("reg-password").value;
      const avatarInput = document.getElementById("reg-avatar-file");
      const avatarFile = avatarInput.files && avatarInput.files[0];

      if (avatarFile) {
        const fname = avatarFile.name.toLowerCase();
        if (!fname.endsWith(".png") && !fname.endsWith(".jpg") && !fname.endsWith(".jpeg")) {
          msgEl.style.display = "block";
          msgEl.className = "auth-msg error";
          msgEl.textContent = "Profile avatar must be a .png or .jpg file.";
          return;
        }
        if (avatarFile.size === 0 || avatarFile.size > 2 * 1024 * 1024) {
          msgEl.style.display = "block";
          msgEl.className = "auth-msg error";
          msgEl.textContent = "Avatar file must not be empty and must be no more than 2 MB.";
          return;
        }
      }

      if (!this.validateForm(username, password, true, msgEl)) return;
      msgEl.style.display = "none";
      btn.disabled = true;
      btn.textContent = "Creating account…";

      try {
        const res = await window.CryptoAPI.auth.register(username, password, avatarFile);
        msgEl.style.display = "block";
        msgEl.className = "auth-msg success";
        msgEl.textContent = "Account created successfully! Welcome to YAOGUAI.";
        const sessionToken = window.CryptoAPI.auth.getToken();
        setTimeout(() => {
          if (!sessionToken || sessionToken !== window.CryptoAPI.auth.getToken()) return;
          this.closeModal();
          this.renderTopbar();
          this.checkLessonGuestBanner();
          if (typeof bootTopbarChip === "function") bootTopbarChip();
          if (typeof updateProgressUI === "function") updateProgressUI();
          if (typeof renderDashboard === "function") renderDashboard();
        }, 600);
      } catch (err) {
        msgEl.style.display = "block";
        msgEl.className = "auth-msg error";
        msgEl.textContent = err.message || "Registration failed.";
      } finally {
        btn.disabled = false;
        btn.textContent = "Create Account";
      }
    },

    async onAvatarUpdate(inputEl) {
      const file = inputEl.files && inputEl.files[0];
      const msgEl = document.getElementById("profile-msg");
      if (!file) return;

      const fname = file.name.toLowerCase();
      if (!fname.endsWith(".png") && !fname.endsWith(".jpg") && !fname.endsWith(".jpeg")) {
        msgEl.style.display = "block";
        msgEl.className = "auth-msg error";
        msgEl.textContent = "Avatar must be a .png or .jpg image.";
        inputEl.value = "";
        return;
      }

      if (file.size === 0 || file.size > 2 * 1024 * 1024) {
        msgEl.style.display = "block";
        msgEl.className = "auth-msg error";
        msgEl.textContent = "Avatar file must not be empty and must be no more than 2 MB.";
        inputEl.value = "";
        return;
      }

      msgEl.style.display = "block";
      msgEl.className = "auth-msg success";
      msgEl.textContent = "Uploading avatar…";

      try {
        const res = await window.CryptoAPI.auth.updateAvatar(file);
        msgEl.style.display = "block";
        msgEl.className = "auth-msg success";
        msgEl.textContent = "Avatar updated successfully!";
        this.renderTopbar();
        this.loadProfileData();
      } catch (err) {
        msgEl.style.display = "block";
        msgEl.className = "auth-msg error";
        msgEl.textContent = err.message || "Failed to upload avatar.";
      } finally {
        inputEl.value = "";
      }
    },

    resetSessionUI() {
      ["auth-form-login", "auth-form-register"].forEach(id => {
        const form = document.getElementById(id);
        if (form) form.reset();
      });
      ["profile-avatar-img", "reg-avatar-preview"].forEach(id => {
        const image = document.getElementById(id);
        if (image) image.src = DEFAULT_AVATAR;
      });
      const username = document.getElementById("profile-username-val");
      const stats = document.getElementById("profile-progress-stat");
      if (username) username.textContent = "";
      if (stats) stats.textContent = "";
      const complete = document.getElementById("complete-btn");
      if (complete) {
        complete.disabled = false;
        complete.textContent = "Mark lesson complete";
      }
      this.switchTab("login");
    },

    async handleLogout() {
      const request = window.CryptoAPI.auth.logout();
      this.closeModal();
      this.resetSessionUI();
      this.renderTopbar();
      this.checkLessonGuestBanner();
      try {
        await request;
      } catch (_) {
        // Local logout still completes when the network is unavailable.
      } finally {
        window.location.replace("/");
      }
    },

    loadProfileData() {
      const user = this.getUser();
      if (!user) return;
      const avatarImg = document.getElementById("profile-avatar-img");
      const nameEl = document.getElementById("profile-username-val");
      const statEl = document.getElementById("profile-progress-stat");

      if (avatarImg) avatarImg.src = getAvatarUrl(user);
      if (nameEl) nameEl.textContent = user.username || "User";

      if (statEl) {
        let done = 0;
        let total = 0;
        if (typeof courseOrdered === "function" && window.Progress) {
          const all = courseOrdered().filter(c => c.implemented).map(c => c.id);
          const o = window.Progress.overall(all);
          done = o.done;
          total = o.total;
        } else if (user.progress) {
          done = Object.values(user.progress).filter(p => p && p.status === "done").length;
        }
        statEl.textContent = total ? `${done} of ${total} modules completed` : `${done} modules completed`;
      }
    },

    renderTopbar() {
      const toolsContainer = document.querySelector(".topbar-tools");
      if (!toolsContainer) return;

      // Retain existing progress-chip or api-status element
      let authWrap = toolsContainer.querySelector(".auth-topbar-wrap");
      if (!authWrap) {
        authWrap = document.createElement("div");
        authWrap.className = "auth-topbar-wrap";
        toolsContainer.appendChild(authWrap);
      }

      const isLogged = this.isLoggedIn();
      const user = this.getUser();

      if (isLogged && user) {
        const avatarSrc = getAvatarUrl(user);
        authWrap.innerHTML = `
          <div class="user-chip" onclick="AuthUI.openModal('profile')" title="View profile & avatar">
            <img class="user-avatar-sm" src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(user.username)}">
            <span class="user-name">${escapeHtml(user.username)}</span>
          </div>
        `;
      } else {
        authWrap.innerHTML = `
          <button class="auth-btn" onclick="AuthUI.openModal('login')">Log In / Register</button>
        `;
      }
    },

    checkLessonGuestBanner() {
      const isLesson = Boolean(document.body && document.body.dataset && document.body.dataset.lesson);
      if (!isLesson) return;

      const existing = document.querySelector(".lesson-guest-banner");
      if (this.isLoggedIn()) {
        if (existing) existing.remove();
        return;
      }

      if (existing) return; // Banner already in place

      const main = document.querySelector(".lesson-main");
      const head = document.querySelector(".lesson-head");
      if (!main || !head) return;

      const banner = document.createElement("div");
      banner.className = "lesson-guest-banner";
      banner.innerHTML = `
        <div class="guest-banner-left">
          <span class="guest-banner-icon">🔒</span>
          <div class="guest-banner-text">
            <strong>Guest Mode (Read-Only)</strong>
            <span>Viewing as guest. Log in or create an account to solve tasks, submit flags, and track progress.</span>
          </div>
        </div>
        <button class="guest-banner-btn" onclick="AuthUI.openModal('login')">Log In / Register</button>
      `;

      head.insertAdjacentElement("afterend", banner);
    }
  };

  window.AuthUI = AuthUI;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => AuthUI.init());
  } else {
    AuthUI.init();
  }
})();

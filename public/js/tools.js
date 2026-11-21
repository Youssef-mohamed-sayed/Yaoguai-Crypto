/* ============================================================
   tools.js — CyberChef-style workbench. Every operation calls the
   Flask API through CryptoAPI (js/api.js); nothing is computed here.
   ============================================================ */

const T = CryptoAPI;
const KEY  = { id: "key",  label: "Key",  placeholder: "secret key" };
const asText = (v) => Array.isArray(v) ? v.join(", ") : (typeof v === "boolean" ? String(v) : v);

/* Each tool: modes[] with run(input, params) -> API promise, and endpoint text. */
const TOOLS = [
  { group: "Encoding" },
  { id: "hex", name: "Hexadecimal", desc: "Bytes as base-16 text. Encoding only — no secret.",
    modes: [
      { name: "Encode", endpoint: "/api/encoding/hex/encode", run: (i) => T.encoding.hexEncode(i) },
      { name: "Decode", endpoint: "/api/encoding/hex/decode", run: (i) => T.encoding.hexDecode(i.replace(/\s+/g, "")) } ] },
  { id: "base64", name: "Base64", desc: "Binary-safe text encoding. Encoding only — no secret.",
    modes: [
      { name: "Encode", endpoint: "/api/encoding/base64/encode", run: (i) => T.encoding.b64Encode(i) },
      { name: "Decode", endpoint: "/api/encoding/base64/decode", run: (i) => T.encoding.b64Decode(i.trim()) } ] },
  { id: "ascii", name: "ASCII codes", desc: "Characters as decimal codes, e.g. 72, 105.",
    modes: [
      { name: "Encode", endpoint: "/api/encoding/ascii/encode", run: (i) => T.encoding.asciiEncode(i) },
      { name: "Decode", endpoint: "/api/encoding/ascii/decode", run: (i) => T.encoding.asciiDecode(i.trim().split(/[\s,]+/).filter(Boolean).join(",")) } ] },
  { id: "url", name: "URL encoding", desc: "Percent-encoding used in web addresses.",
    modes: [
      { name: "Encode", endpoint: "/api/encoding/url/encode", run: (i) => T.encoding.urlEncode(i) },
      { name: "Decode", endpoint: "/api/encoding/url/decode", run: (i) => T.encoding.urlDecode(i) } ] },

  { group: "Encryption" },
  { id: "xor", name: "XOR", desc: "Repeating-key XOR. Ciphertext is Base64.", params: [KEY],
    modes: [
      { name: "Encrypt", endpoint: "/api/encryption/xor", run: (i, p) => T.encryption.xor(i, p.key) },
      { name: "Decrypt", endpoint: "/api/decryption/xor", run: (i, p) => T.decryption.xor(i.trim(), p.key) } ] },
  { id: "rc4", name: "RC4", desc: "Stream cipher. Ciphertext is Base64.", params: [KEY],
    modes: [
      { name: "Encrypt", endpoint: "/api/encryption/rc4", run: (i, p) => T.encryption.rc4(i, p.key) },
      { name: "Decrypt", endpoint: "/api/decryption/rc4", run: (i, p) => T.decryption.rc4(i.trim(), p.key) } ] },
  { id: "des", name: "DES", desc: "56-bit block cipher. The key is padded or cut to 8 bytes. Ciphertext is Base64.", params: [KEY],
    modes: [
      { name: "Encrypt", endpoint: "/api/encryption/des", run: (i, p) => T.encryption.des(i, p.key) },
      { name: "Decrypt", endpoint: "/api/decryption/des", run: (i, p) => T.decryption.des(i.trim(), p.key) } ] },
  { id: "3des", name: "Triple DES", desc: "DES applied three times. Leave key 3 empty to reuse key 1.",
    params: [ { id: "key1", label: "Key 1", placeholder: "first key" }, { id: "key2", label: "Key 2", placeholder: "second key" }, { id: "key3", label: "Key 3 (optional)", placeholder: "third key", optional: true } ],
    modes: [
      { name: "Encrypt", endpoint: "/api/encryption/3des", run: (i, p) => T.encryption.des3(i, p.key1, p.key2, p.key3 || undefined) },
      { name: "Decrypt", endpoint: "/api/decryption/3des", run: (i, p) => T.decryption.des3(i.trim(), p.key1, p.key2, p.key3 || undefined) } ] },
  { id: "aes", name: "AES-128", desc: "Modern block cipher. The key is padded or cut to 16 bytes. Ciphertext is Base64.", params: [KEY],
    modes: [
      { name: "Encrypt", endpoint: "/api/encryption/aes", run: (i, p) => T.encryption.aes(i, p.key) },
      { name: "Decrypt", endpoint: "/api/decryption/aes", run: (i, p) => T.decryption.aes(i.trim(), p.key) } ] },
  { id: "rsa", name: "RSA", desc: "Public-key demo. Generate a key pair, then encrypt with (e, n) and decrypt with (d, n). Keep messages short.",
    custom: "rsa",
    params: [ { id: "n", label: "n (modulus)", placeholder: "click Generate keys", area: true }, { id: "e", label: "e (public exponent)", placeholder: "65537" }, { id: "d", label: "d (private exponent)", placeholder: "needed to decrypt", area: true } ],
    modes: [
      { name: "Encrypt", endpoint: "/api/encryption/rsa", run: (i, p) => T.encryption.rsa(i, p.e, p.n) },
      { name: "Decrypt", endpoint: "/api/decryption/rsa", run: (i, p) => T.decryption.rsa(i.trim(), p.d, p.n) } ] },

  { group: "Hashing" },
  { id: "md5", name: "MD5", desc: "128-bit digest. Broken for security — fine for learning.",
    modes: [ { name: "Hash", endpoint: "/api/hashing/md5", run: (i) => T.hashing.md5(i) } ] },
  { id: "sha1", name: "SHA-1", desc: "160-bit digest. Deprecated.",
    modes: [ { name: "Hash", endpoint: "/api/hashing/sha1", run: (i) => T.hashing.sha1(i) } ] },
  { id: "sha256", name: "SHA-256", desc: "256-bit digest used by TLS, Git and Bitcoin.",
    modes: [ { name: "Hash", endpoint: "/api/hashing/sha256", run: (i) => T.hashing.sha256(i) } ] },
  { id: "bcrypt", name: "bcrypt", desc: "Slow, salted password hashing. Use Verify to check a password against a hash.",
    modes: [
      { name: "Hash", endpoint: "/api/hashing/bcrypt", params: [ { id: "rounds", label: "Cost (4–14)", placeholder: "12", type: "number", value: "10", min: 4, max: 14 } ],
        run: (i, p) => T.hashing.bcryptHash(i, parseInt(p.rounds || "10", 10)) },
      { name: "Verify", endpoint: "/api/hashing/bcrypt/verify", params: [ { id: "hash", label: "bcrypt hash", placeholder: "$2b$10$…", area: true } ],
        run: (i, p) => T.hashing.bcryptVerify(i, (p.hash || "").trim()).then(ok => ok ? "✓ match — the password fits this hash" : "✗ no match") } ] },

  { group: "Cracking" },
  { id: "crack", name: "Crack a hash", custom: "crack",
    desc: "Tries every word in this app's small sample wordlist against the hash, looks it up in Hashes.com's crowd-sourced database, or identifies the hash algorithm — all via the official Hashes.com API (hashes.com/en/api).",
    params: [ { id: "hash_type", label: "Hash type", type: "select", options: [["md5","MD5"],["sha1","SHA-1"],["sha256","SHA-256"]] } ],
    modes: [
      { name: "Crack (sample wordlist)", endpoint: "/api/crack/wordlist", run: (i, p) => T.crack.wordlist(i.trim(), p.hash_type)
        .then(r => r.cracked
          ? `✓ cracked after trying ${r.tried} word${r.tried === 1 ? "" : "s"}\n\npassword: ${r.password}`
          : `✗ not in this app's ${r.tried}-word sample list.\nTry the Hashes.com mode above, or a full wordlist with John/Hashcat.`) },
      { name: "Crack (Hashes.com)", endpoint: "/api/hashescom",
        params: [ { id: "hashescom_key", label: "Hashes.com API key", placeholder: "from hashes.com/en/api", persist: true } ],
        run: (i, p) => T.crack.hashescom(i.trim(), p.hashescom_key)
          .then(r => r.cracked
            ? `✓ found in Hashes.com's database\n\npassword: ${r.password}\nalgorithm: ${r.algorithm}${r.salt ? `\nsalt: ${r.salt}` : ""}`
            : "✗ not found in Hashes.com's database.\nThat only rules out hashes someone has already cracked before — it says nothing about a genuinely strong, never-leaked password.") },
      { name: "Identify algorithm", endpoint: "/api/hashescom/identify",
        params: [ { id: "identify_extended", label: "Extended results", type: "select", options: [["false","No (common algorithms)"],["true","Yes (all possible algorithms)"]] } ],
        run: (i, p) => T.crack.hashescomIdentify(i.trim(), p.identify_extended === "true")
          .then(r => r.algorithms && r.algorithms.length
            ? `Possible algorithm(s):\n\n${r.algorithms.map((a, idx) => `  ${idx + 1}. ${a}`).join("\n")}`
            : "Could not identify algorithm — hash format unrecognised by Hashes.com.") },
    ] },

  { group: "File Crypto" },
  { id: "file-encrypt", name: "File Encrypt", custom: "file-encrypt",
    desc: "Upload a .txt file and encrypt it. DES: download the encrypted file and remember your key. Hybrid RSA+DES: a random session key is generated, encrypted with your RSA public key, and bundled separately — you need your private key (d) to decrypt later.",
    modes: [] },
  { id: "file-decrypt", name: "File Decrypt", custom: "file-decrypt",
    desc: "Upload an encrypted file and recover the original. DES: provide the same key used to encrypt. Hybrid: provide the encrypted session key, your RSA private exponent d, and modulus n.",
    modes: [] },
];

const $ = (id) => document.getElementById(id);
const els = { list: $("tools-list"), title: $("tool-title"), desc: $("tool-desc"), modes: $("mode-switch"),
  input: $("input"), output: $("output"), params: $("params"), msg: $("msg"), endpoint: $("endpoint"), run: $("run-btn") };
const state = { tool: null, mode: 0, values: {} };
const byId = (id) => TOOLS.find(t => t.id === id);

function setMsg(text, kind){ els.msg.textContent = text || ""; els.msg.className = "tool-msg" + (kind ? " " + kind : ""); }

function buildList(){
  els.list.innerHTML = "";
  TOOLS.forEach(t => {
    if (t.group){ const h = document.createElement("div"); h.className = "tools-group"; h.textContent = t.group; els.list.appendChild(h); return; }
    const a = document.createElement("a"); a.href = "#" + t.id; a.textContent = t.name; a.dataset.id = t.id;
    els.list.appendChild(a);
  });
}

function currentParams(){
  const t = state.tool;
  if (!t) return [];
  const m = (t.modes && t.modes.length) ? t.modes[state.mode] : null;
  return [...(t.params || []), ...(m && m.params ? m.params : [])];
}

function renderFileEncryptUI() {
  els.params.innerHTML = "";
  els.params.style.display = "";

  const algo = state.fileEncryptAlgo || "des";

  const container = document.createElement("div");
  container.className = "param-full";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "16px";
  container.style.width = "100%";

  // 1. Algorithm tabs
  const tabWrap = document.createElement("div");
  const tabLabel = document.createElement("label");
  tabLabel.textContent = "Encryption Algorithm";
  tabLabel.style.display = "block";
  tabLabel.style.marginBottom = "6px";
  tabLabel.style.fontSize = "12.5px";
  tabLabel.style.color = "var(--paper-dim)";

  const modeSwitch = document.createElement("div");
  modeSwitch.className = "mode-switch";
  modeSwitch.setAttribute("role", "tablist");

  const btnDes = document.createElement("button");
  btnDes.type = "button";
  btnDes.textContent = "DES";
  btnDes.className = algo === "des" ? "on" : "";

  const btnHybrid = document.createElement("button");
  btnHybrid.type = "button";
  btnHybrid.textContent = "Hybrid RSA+DES";
  btnHybrid.className = algo === "hybrid" ? "on" : "";

  btnDes.addEventListener("click", () => {
    state.fileEncryptAlgo = "des";
    renderFileEncryptUI();
  });
  btnHybrid.addEventListener("click", () => {
    state.fileEncryptAlgo = "hybrid";
    renderFileEncryptUI();
  });

  modeSwitch.append(btnDes, btnHybrid);
  tabWrap.append(tabLabel, modeSwitch);
  container.appendChild(tabWrap);

  // 2. File input
  const fileWrap = document.createElement("div");
  const fileLabel = document.createElement("label");
  fileLabel.textContent = "Select .txt file to encrypt (max 1 MB)";
  fileLabel.style.display = "block";
  fileLabel.style.marginBottom = "6px";
  fileLabel.style.fontSize = "12.5px";
  fileLabel.style.color = "var(--paper-dim)";

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.id = "file-upload";
  fileInput.accept = ".txt";

  const fileInfo = document.createElement("div");
  fileInfo.style.fontSize = "13px";
  fileInfo.style.marginTop = "4px";
  fileInfo.style.color = "var(--paper-dim)";

  fileInput.addEventListener("change", () => {
    const f = fileInput.files[0];
    if (f) {
      fileInfo.textContent = `Selected: ${f.name} (${(f.size / 1024).toFixed(1)} KB)`;
      fileInfo.style.color = f.name.toLowerCase().endsWith(".txt") ? "var(--ok, #4ade80)" : "var(--bad, #f87171)";
    } else {
      fileInfo.textContent = "";
    }
  });

  fileWrap.append(fileLabel, fileInput, fileInfo);
  container.appendChild(fileWrap);

  // 3. Algorithm-specific inputs
  if (algo === "des") {
    const keyWrap = document.createElement("div");
    const keyLabel = document.createElement("label");
    keyLabel.textContent = "Secret Key (DES 8-byte key)";
    keyLabel.style.display = "block";
    keyLabel.style.marginBottom = "6px";
    keyLabel.style.fontSize = "12.5px";
    keyLabel.style.color = "var(--paper-dim)";

    const keyInp = document.createElement("input");
    keyInp.type = "text";
    keyInp.id = "file-des-key";
    keyInp.placeholder = "e.g. secret8k";
    keyInp.spellcheck = false;
    keyInp.value = state.fileDesKey || "";
    keyInp.addEventListener("input", () => { state.fileDesKey = keyInp.value; });

    keyWrap.append(keyLabel, keyInp);
    container.appendChild(keyWrap);
  } else {
    // Hybrid: n and e
    const nWrap = document.createElement("div");
    const nLabel = document.createElement("label");
    nLabel.textContent = "RSA Modulus (n) — generate with RSA tool";
    nLabel.style.display = "block";
    nLabel.style.marginBottom = "6px";
    nLabel.style.fontSize = "12.5px";
    nLabel.style.color = "var(--paper-dim)";

    const nInp = document.createElement("textarea");
    nInp.id = "file-rsa-n";
    nInp.rows = 2;
    nInp.placeholder = "paste RSA modulus n (decimal integer)";
    nInp.spellcheck = false;
    nInp.value = state.fileRsaN || "";
    nInp.addEventListener("input", () => { state.fileRsaN = nInp.value; });

    nWrap.append(nLabel, nInp);
    container.appendChild(nWrap);

    const eWrap = document.createElement("div");
    const eLabel = document.createElement("label");
    eLabel.textContent = "RSA Public Exponent (e)";
    eLabel.style.display = "block";
    eLabel.style.marginBottom = "6px";
    eLabel.style.fontSize = "12.5px";
    eLabel.style.color = "var(--paper-dim)";

    const eInp = document.createElement("input");
    eInp.type = "text";
    eInp.id = "file-rsa-e";
    eInp.placeholder = "65537";
    eInp.spellcheck = false;
    eInp.value = state.fileRsaE || "65537";
    eInp.addEventListener("input", () => { state.fileRsaE = eInp.value; });

    const tip = document.createElement("div");
    tip.style.fontSize = "12px";
    tip.style.marginTop = "4px";
    tip.style.color = "var(--paper-dim)";
    tip.textContent = "💡 Tip: Switch to the RSA tool in the sidebar to generate a 256-bit or 512-bit key pair.";

    eWrap.append(eLabel, eInp, tip);
    container.appendChild(eWrap);
  }

  // 4. Action button & status
  const actionRow = document.createElement("div");
  actionRow.style.display = "flex";
  actionRow.style.alignItems = "center";
  actionRow.style.gap = "14px";
  actionRow.style.flexWrap = "wrap";
  actionRow.style.marginTop = "6px";

  const runBtn = document.createElement("button");
  runBtn.type = "button";
  runBtn.className = "btn btn-primary";
  runBtn.textContent = "Encrypt & Download";

  const statusSpan = document.createElement("span");
  statusSpan.className = "tool-msg";

  actionRow.append(runBtn, statusSpan);
  container.appendChild(actionRow);

  // 5. Success / Session key output card
  const resultCard = document.createElement("div");
  resultCard.id = "file-result-card";
  resultCard.style.display = "none";
  resultCard.style.flexDirection = "column";
  resultCard.style.gap = "8px";
  resultCard.style.padding = "14px";
  resultCard.style.border = "1px solid var(--line)";
  resultCard.style.marginTop = "10px";

  container.appendChild(resultCard);

  // Run handler
  runBtn.addEventListener("click", async () => {
    resultCard.style.display = "none";
    resultCard.innerHTML = "";
    statusSpan.textContent = "";
    statusSpan.className = "tool-msg";

    const file = fileInput.files[0];
    if (!file) {
      statusSpan.textContent = "Choose a file first.";
      statusSpan.className = "tool-msg bad";
      return;
    }
    if (!file.name.toLowerCase().endsWith(".txt")) {
      statusSpan.textContent = "Only .txt files are supported.";
      statusSpan.className = "tool-msg bad";
      return;
    }
    if (file.size > 1024 * 1024) {
      statusSpan.textContent = "File too large (max 1 MB).";
      statusSpan.className = "tool-msg bad";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    if (algo === "des") {
      const key = (state.fileDesKey || "").trim();
      if (!key) {
        statusSpan.textContent = "Fill in: Key";
        statusSpan.className = "tool-msg bad";
        return;
      }
      formData.append("key", key);

      runBtn.disabled = true;
      statusSpan.textContent = "Encrypting…";
      statusSpan.className = "tool-msg";

      try {
        const res = await T.file.encryptDES(formData);
        statusSpan.textContent = `✓ File encrypted and downloaded: ${res.filename || file.name + ".des.enc"}`;
        statusSpan.className = "tool-msg ok";
      } catch (err) {
        statusSpan.textContent = err.message || "Encryption failed.";
        statusSpan.className = "tool-msg bad";
      } finally {
        runBtn.disabled = false;
      }
    } else {
      // Hybrid
      const n = (state.fileRsaN || "").trim();
      const e = (state.fileRsaE || "65537").trim();
      if (!n || !e) {
        statusSpan.textContent = "Fill in: n and e";
        statusSpan.className = "tool-msg bad";
        return;
      }
      formData.append("n", n);
      formData.append("e", e);

      runBtn.disabled = true;
      statusSpan.textContent = "Encrypting…";
      statusSpan.className = "tool-msg";

      try {
        const res = await T.file.encryptHybrid(formData);
        const blob = new Blob([res.encrypted_file_b64], { type: "text/plain;charset=utf-8" });
        const downloadName = (res.original_filename || file.name) + ".hybrid.enc";
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = downloadName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);

        statusSpan.textContent = `✓ File encrypted and downloaded: ${downloadName}`;
        statusSpan.className = "tool-msg ok";

        resultCard.style.display = "flex";
        resultCard.innerHTML = `
          <div style="font-size:12.5px; color:var(--paper-dim); font-weight:600;">
            Encrypted session key (RSA-wrapped DES key):
          </div>
          <div style="font-size:12px; color:var(--paper-dim);">
            Save this key! You will need it along with your private exponent <code>d</code> and modulus <code>n</code> to decrypt the file.
          </div>
          <textarea id="file-hybrid-key-out" readonly rows="2" style="font-family:monospace; font-size:13px;"></textarea>
          <div>
            <button type="button" class="btn btn-ghost btn-sm" id="copy-session-key-btn">Copy key</button>
          </div>
        `;
        const keyArea = resultCard.querySelector("#file-hybrid-key-out");
        keyArea.value = res.encrypted_key;
        resultCard.querySelector("#copy-session-key-btn").addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(res.encrypted_key);
            statusSpan.textContent = "✓ Encrypted session key copied to clipboard.";
            statusSpan.className = "tool-msg ok";
          } catch (_) {
            keyArea.select();
            document.execCommand("copy");
            statusSpan.textContent = "✓ Encrypted session key copied.";
            statusSpan.className = "tool-msg ok";
          }
        });
      } catch (err) {
        statusSpan.textContent = err.message || "Hybrid encryption failed.";
        statusSpan.className = "tool-msg bad";
      } finally {
        runBtn.disabled = false;
      }
    }
  });

  els.params.appendChild(container);
}

function renderFileDecryptUI() {
  els.params.innerHTML = "";
  els.params.style.display = "";

  const algo = state.fileDecryptAlgo || "des";

  const container = document.createElement("div");
  container.className = "param-full";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "16px";
  container.style.width = "100%";

  // 1. Algorithm tabs
  const tabWrap = document.createElement("div");
  const tabLabel = document.createElement("label");
  tabLabel.textContent = "Decryption Algorithm";
  tabLabel.style.display = "block";
  tabLabel.style.marginBottom = "6px";
  tabLabel.style.fontSize = "12.5px";
  tabLabel.style.color = "var(--paper-dim)";

  const modeSwitch = document.createElement("div");
  modeSwitch.className = "mode-switch";
  modeSwitch.setAttribute("role", "tablist");

  const btnDes = document.createElement("button");
  btnDes.type = "button";
  btnDes.textContent = "DES";
  btnDes.className = algo === "des" ? "on" : "";

  const btnHybrid = document.createElement("button");
  btnHybrid.type = "button";
  btnHybrid.textContent = "Hybrid RSA+DES";
  btnHybrid.className = algo === "hybrid" ? "on" : "";

  btnDes.addEventListener("click", () => {
    state.fileDecryptAlgo = "des";
    renderFileDecryptUI();
  });
  btnHybrid.addEventListener("click", () => {
    state.fileDecryptAlgo = "hybrid";
    renderFileDecryptUI();
  });

  modeSwitch.append(btnDes, btnHybrid);
  tabWrap.append(tabLabel, modeSwitch);
  container.appendChild(tabWrap);

  // 2. File input
  const fileWrap = document.createElement("div");
  const fileLabel = document.createElement("label");
  fileLabel.textContent = "Select encrypted file (.des.enc or .hybrid.enc)";
  fileLabel.style.display = "block";
  fileLabel.style.marginBottom = "6px";
  fileLabel.style.fontSize = "12.5px";
  fileLabel.style.color = "var(--paper-dim)";

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.id = "file-upload-dec";
  fileInput.accept = ".enc,.des.enc,.hybrid.enc,*/*";

  const fileInfo = document.createElement("div");
  fileInfo.style.fontSize = "13px";
  fileInfo.style.marginTop = "4px";
  fileInfo.style.color = "var(--paper-dim)";

  fileInput.addEventListener("change", () => {
    const f = fileInput.files[0];
    if (f) {
      fileInfo.textContent = `Selected: ${f.name} (${(f.size / 1024).toFixed(1)} KB)`;
      const origInp = document.getElementById("file-dec-orig-name");
      if (origInp && !origInp.value.trim()) {
        let suggested = f.name;
        if (suggested.endsWith(".des.enc")) suggested = suggested.slice(0, -8);
        else if (suggested.endsWith(".hybrid.enc")) suggested = suggested.slice(0, -11);
        else if (suggested.endsWith(".enc")) suggested = suggested.slice(0, -4);
        origInp.value = suggested;
        state.fileDecOrigName = suggested;
      }
    } else {
      fileInfo.textContent = "";
    }
  });

  fileWrap.append(fileLabel, fileInput, fileInfo);
  container.appendChild(fileWrap);

  // 3. Algorithm-specific inputs
  if (algo === "des") {
    const keyWrap = document.createElement("div");
    const keyLabel = document.createElement("label");
    keyLabel.textContent = "Secret Key (same key used for encryption)";
    keyLabel.style.display = "block";
    keyLabel.style.marginBottom = "6px";
    keyLabel.style.fontSize = "12.5px";
    keyLabel.style.color = "var(--paper-dim)";

    const keyInp = document.createElement("input");
    keyInp.type = "text";
    keyInp.id = "file-dec-des-key";
    keyInp.placeholder = "e.g. secret8k";
    keyInp.spellcheck = false;
    keyInp.value = state.fileDecDesKey || "";
    keyInp.addEventListener("input", () => { state.fileDecDesKey = keyInp.value; });

    keyWrap.append(keyLabel, keyInp);
    container.appendChild(keyWrap);
  } else {
    // Hybrid: encrypted session key, d, n
    const keyWrap = document.createElement("div");
    const keyLabel = document.createElement("label");
    keyLabel.textContent = "Encrypted Session Key (decimal string from encrypt)";
    keyLabel.style.display = "block";
    keyLabel.style.marginBottom = "6px";
    keyLabel.style.fontSize = "12.5px";
    keyLabel.style.color = "var(--paper-dim)";

    const keyInp = document.createElement("textarea");
    keyInp.id = "file-dec-session-key";
    keyInp.rows = 2;
    keyInp.placeholder = "paste encrypted session key";
    keyInp.spellcheck = false;
    keyInp.value = state.fileDecSessionKey || "";
    keyInp.addEventListener("input", () => { state.fileDecSessionKey = keyInp.value; });

    keyWrap.append(keyLabel, keyInp);
    container.appendChild(keyWrap);

    const dWrap = document.createElement("div");
    const dLabel = document.createElement("label");
    dLabel.textContent = "RSA Private Exponent (d)";
    dLabel.style.display = "block";
    dLabel.style.marginBottom = "6px";
    dLabel.style.fontSize = "12.5px";
    dLabel.style.color = "var(--paper-dim)";

    const dInp = document.createElement("textarea");
    dInp.id = "file-dec-d";
    dInp.rows = 2;
    dInp.placeholder = "paste RSA private exponent d";
    dInp.spellcheck = false;
    dInp.value = state.fileDecD || "";
    dInp.addEventListener("input", () => { state.fileDecD = dInp.value; });

    dWrap.append(dLabel, dInp);
    container.appendChild(dWrap);

    const nWrap = document.createElement("div");
    const nLabel = document.createElement("label");
    nLabel.textContent = "RSA Modulus (n)";
    nLabel.style.display = "block";
    nLabel.style.marginBottom = "6px";
    nLabel.style.fontSize = "12.5px";
    nLabel.style.color = "var(--paper-dim)";

    const nInp = document.createElement("textarea");
    nInp.id = "file-dec-n";
    nInp.rows = 2;
    nInp.placeholder = "paste RSA modulus n";
    nInp.spellcheck = false;
    nInp.value = state.fileDecN || "";
    nInp.addEventListener("input", () => { state.fileDecN = nInp.value; });

    nWrap.append(nLabel, nInp);
    container.appendChild(nWrap);
  }

  // Original filename input
  const origWrap = document.createElement("div");
  const origLabel = document.createElement("label");
  origLabel.textContent = "Original Filename (to save as)";
  origLabel.style.display = "block";
  origLabel.style.marginBottom = "6px";
  origLabel.style.fontSize = "12.5px";
  origLabel.style.color = "var(--paper-dim)";

  const origInp = document.createElement("input");
  origInp.type = "text";
  origInp.id = "file-dec-orig-name";
  origInp.placeholder = "notes.txt";
  origInp.spellcheck = false;
  origInp.value = state.fileDecOrigName || "";
  origInp.addEventListener("input", () => { state.fileDecOrigName = origInp.value; });

  origWrap.append(origLabel, origInp);
  container.appendChild(origWrap);

  // Action button & status
  const actionRow = document.createElement("div");
  actionRow.style.display = "flex";
  actionRow.style.alignItems = "center";
  actionRow.style.gap = "14px";
  actionRow.style.flexWrap = "wrap";
  actionRow.style.marginTop = "6px";

  const runBtn = document.createElement("button");
  runBtn.type = "button";
  runBtn.className = "btn btn-primary";
  runBtn.textContent = "Decrypt & Download";

  const statusSpan = document.createElement("span");
  statusSpan.className = "tool-msg";

  actionRow.append(runBtn, statusSpan);
  container.appendChild(actionRow);

  // Decrypt handler
  runBtn.addEventListener("click", async () => {
    statusSpan.textContent = "";
    statusSpan.className = "tool-msg";

    const file = fileInput.files[0];
    if (!file) {
      statusSpan.textContent = "Choose a file first.";
      statusSpan.className = "tool-msg bad";
      return;
    }
    if (file.size > 1024 * 1024) {
      statusSpan.textContent = "File too large (max 1 MB).";
      statusSpan.className = "tool-msg bad";
      return;
    }

    const origName = (origInp.value || "").trim() || "decrypted.txt";

    if (algo === "des") {
      const key = (state.fileDecDesKey || "").trim();
      if (!key) {
        statusSpan.textContent = "Fill in: Key";
        statusSpan.className = "tool-msg bad";
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("key", key);
      formData.append("original_filename", origName);

      runBtn.disabled = true;
      statusSpan.textContent = "Decrypting…";
      statusSpan.className = "tool-msg";

      try {
        const res = await T.file.decryptDES(formData);
        statusSpan.textContent = `✓ File decrypted and downloaded: ${res.filename || origName}`;
        statusSpan.className = "tool-msg ok";
      } catch (err) {
        statusSpan.textContent = err.message || "Decryption failed.";
        statusSpan.className = "tool-msg bad";
      } finally {
        runBtn.disabled = false;
      }
    } else {
      // Hybrid
      const encKey = (state.fileDecSessionKey || "").trim();
      const d = (state.fileDecD || "").trim();
      const n = (state.fileDecN || "").trim();
      if (!encKey || !d || !n) {
        statusSpan.textContent = "Fill in: Encrypted session key, d, and n";
        statusSpan.className = "tool-msg bad";
        return;
      }

      runBtn.disabled = true;
      statusSpan.textContent = "Decrypting…";
      statusSpan.className = "tool-msg";

      try {
        const fileText = await file.text();
        let b64 = fileText.trim();
        try {
          atob(b64);
        } catch (_) {
          const buf = await file.arrayBuffer();
          let binary = "";
          const bytes = new Uint8Array(buf);
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          b64 = btoa(binary);
        }

        const payload = {
          encrypted_file_b64: b64,
          encrypted_key: encKey,
          d: d,
          n: n,
          original_filename: origName,
        };

        const res = await T.file.decryptHybrid(payload);
        statusSpan.textContent = `✓ File decrypted and downloaded: ${res.filename || origName}`;
        statusSpan.className = "tool-msg ok";
      } catch (err) {
        statusSpan.textContent = err.message || "Hybrid decryption failed.";
        statusSpan.className = "tool-msg bad";
      } finally {
        runBtn.disabled = false;
      }
    }
  });

  els.params.appendChild(container);
}

function renderParams(){
  const defs = currentParams();
  els.params.innerHTML = "";
  els.params.style.display = defs.length || state.tool.custom ? "" : "none";
  defs.forEach(p => {
    const wrap = document.createElement("div"); wrap.className = "param";
    const lab = document.createElement("label"); lab.textContent = p.label; lab.htmlFor = "p-" + p.id;
    let inp;
    if (p.type === "select"){
      inp = document.createElement("select"); inp.id = "p-" + p.id;
      p.options.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; inp.appendChild(o); });
      inp.value = state.values[p.id] != null ? state.values[p.id] : p.options[0][0];
      state.values[p.id] = inp.value;
      inp.addEventListener("change", () => { state.values[p.id] = inp.value; });
    } else {
      inp = document.createElement(p.area ? "textarea" : "input");
      inp.id = "p-" + p.id; inp.placeholder = p.placeholder || ""; inp.spellcheck = false;
      if (!p.area) inp.type = p.type || "text";
      if (p.min != null) inp.min = p.min; if (p.max != null) inp.max = p.max;
      if (p.area) inp.rows = 2;
      // "persist" params (e.g. a Hashes.com API key) are remembered in this
      // browser between visits, so the person doesn't retype it every time.
      const stored = p.persist ? localStorage.getItem("yaoguai_" + p.id) : null;
      inp.value = state.values[p.id] != null ? state.values[p.id] : (stored || p.value || "");
      if (stored != null) state.values[p.id] = stored;
      inp.addEventListener("input", () => {
        state.values[p.id] = inp.value;
        if (p.persist) localStorage.setItem("yaoguai_" + p.id, inp.value);
      });
    }
    wrap.append(lab, inp); els.params.appendChild(wrap);
  });
  if (state.tool.custom === "rsa"){
    const row = document.createElement("div"); row.className = "param param-full";
    const bits = document.createElement("select"); bits.id = "rsa-bits";
    [[128, "128-bit (instant)"], [256, "256-bit"], [512, "512-bit"], [1024, "1024-bit (slow)"]].forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; if (v === 256) o.selected = true; bits.appendChild(o); });
    const b = document.createElement("button"); b.className = "btn btn-ghost btn-sm"; b.type = "button"; b.textContent = "Generate keys";
    b.addEventListener("click", async () => {
      b.disabled = true; setMsg("Generating keys…");
      try {
        const k = await T.encryption.rsaGenerateKeys(parseInt(bits.value, 10));
        ["n", "e", "d"].forEach(f => { state.values[f] = String(k[f]); const el = $("p-" + f); if (el) el.value = String(k[f]); });
        setMsg("Key pair generated.", "ok");
      } catch (err){ setMsg(err.message, "bad"); }
      b.disabled = false;
    });
    row.append(bits, b); els.params.appendChild(row);
  }
}

function renderModes(){
  els.modes.innerHTML = "";
  els.modes.style.display = state.tool.modes.length > 1 ? "" : "none";
  state.tool.modes.forEach((m, i) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = m.name;
    b.className = i === state.mode ? "on" : ""; b.setAttribute("role", "tab");
    b.addEventListener("click", () => { state.mode = i; renderModes(); renderParams(); renderMeta(); });
    els.modes.appendChild(b);
  });
}

function renderMeta(){
  const m = state.tool.modes[state.mode];
  els.endpoint.textContent = "POST " + m.endpoint;
  els.run.textContent = m.name === "Hash" ? "Hash" : m.name;
  $("input-label").textContent = (state.tool.id === "bcrypt" && m.name === "Verify") ? "Password"
    : state.tool.id === "crack" ? "Hash to crack" : "Input";
  els.input.placeholder = state.tool.id === "crack" ? "paste a hash, e.g. 5f4dcc3b5aa765d61d8327deb882cf99" : "Type or paste text here…";
}

function selectTool(id){
  const t = byId(id) || byId("hex");
  state.tool = t; state.mode = 0; state.values = {};
  els.title.textContent = t.name; els.desc.textContent = t.desc;
  els.list.querySelectorAll("a").forEach(a => a.classList.toggle("current", a.dataset.id === t.id));
  els.output.value = ""; setMsg("");

  const isFileTool = t.id === "file-encrypt" || t.id === "file-decrypt";
  els.input.style.display = isFileTool ? "none" : "";
  const inLab = $("input-label");
  if (inLab) inLab.style.display = isFileTool ? "none" : "";
  const actions = document.querySelector(".tool-actions");
  if (actions) actions.style.display = isFileTool ? "none" : "";
  const outHead = document.querySelector(".out-head");
  if (outHead) outHead.style.display = isFileTool ? "none" : "";
  els.output.style.display = isFileTool ? "none" : "";

  if (t.id === "file-encrypt") {
    els.modes.style.display = "none";
    renderFileEncryptUI();
  } else if (t.id === "file-decrypt") {
    els.modes.style.display = "none";
    renderFileDecryptUI();
  } else {
    renderModes();
    renderParams();
    renderMeta();
  }
}

async function run(){
  if (!state.tool || state.tool.id === "file-encrypt" || state.tool.id === "file-decrypt") return;
  const t = state.tool, m = t.modes[state.mode];
  if (!m) return;
  const input = els.input.value;
  if (!input){ setMsg("Enter some input first.", "bad"); return; }
  const params = {};
  currentParams().forEach(p => { params[p.id] = (state.values[p.id] != null ? state.values[p.id] : (p.value || "")).toString(); });
  const missing = currentParams().filter(p => !p.optional && p.id !== "rounds" && !params[p.id].trim());
  if (missing.length){ setMsg("Fill in: " + missing.map(p => p.label).join(", "), "bad"); return; }
  els.run.disabled = true; setMsg("Working…");
  try {
    const res = await m.run(input, params);
    els.output.value = asText(res); setMsg("Done.", "ok");
  } catch (err){
    els.output.value = ""; setMsg(err.message || "Request failed.", "bad");
  }
  els.run.disabled = false;
}

async function checkApi(){
  const chip = $("api-status");
  try { await T.hashing.md5("ping"); chip.textContent = "API: online"; }
  catch (e){ chip.textContent = "API: offline"; }
}

buildList();
selectTool(location.hash.slice(1));
window.addEventListener("hashchange", () => selectTool(location.hash.slice(1)));
els.run.addEventListener("click", run);
els.input.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") run(); });
$("use-btn").addEventListener("click", () => { if (els.output.value){ els.input.value = els.output.value; els.output.value = ""; setMsg("Output moved to input."); } });
$("clear-btn").addEventListener("click", () => { els.input.value = ""; els.output.value = ""; setMsg(""); });
$("copy-btn").addEventListener("click", async () => {
  if (!els.output.value) return;
  try { await navigator.clipboard.writeText(els.output.value); setMsg("Copied.", "ok"); }
  catch (e){ els.output.select(); document.execCommand("copy"); setMsg("Copied.", "ok"); }
});
checkApi();

document.querySelectorAll(".continue-link[data-copy]").forEach(a => {
  a.addEventListener("click", async () => {
    const text = els.input.value;
    if (!text) return;
    try { await navigator.clipboard.writeText(text); } catch (e) { /* clipboard not available — link still opens */ }
  });
});

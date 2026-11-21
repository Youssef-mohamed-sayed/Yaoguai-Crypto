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
  const t = state.tool, m = t.modes[state.mode];
  return [...(t.params || []), ...(m.params || [])];
}

function renderParams(){
  const defs = currentParams();
  els.params.innerHTML = "";
  els.params.style.display = defs.length || state.tool.custom ? "" : "none";
  defs.forEach(p => {
    const wrap = document.createElement("div"); wrap.className = "param";
    const lab = document.createElement("label"); lab.textContent = p.label; lab.htmlFor = "p-" + p.id;
    const inp = document.createElement(p.area ? "textarea" : "input");
    inp.id = "p-" + p.id; inp.placeholder = p.placeholder || ""; inp.spellcheck = false;
    if (!p.area) inp.type = p.type || "text";
    if (p.min != null) inp.min = p.min; if (p.max != null) inp.max = p.max;
    if (p.area) inp.rows = 2;
    inp.value = state.values[p.id] != null ? state.values[p.id] : (p.value || "");
    inp.addEventListener("input", () => { state.values[p.id] = inp.value; });
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
  $("input-label").textContent = (state.tool.id === "bcrypt" && m.name === "Verify") ? "Password" : "Input";
}

function selectTool(id){
  const t = byId(id) || byId("hex");
  state.tool = t; state.mode = 0; state.values = {};
  els.title.textContent = t.name; els.desc.textContent = t.desc;
  els.list.querySelectorAll("a").forEach(a => a.classList.toggle("current", a.dataset.id === t.id));
  els.output.value = ""; setMsg("");
  renderModes(); renderParams(); renderMeta();
}

async function run(){
  const t = state.tool, m = t.modes[state.mode];
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

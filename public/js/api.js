/* ============================================================
   api.js — thin service layer over the Flask crypto API
   (app.py / encoding.py / encryption.py / hashing.py / crack.py).
   Swap API_BASE_URL (or set window.CRYPTO_API_BASE before this
   script loads) to point at a real deployment — nothing else
   changes. Every request body key is "data" (plus algorithm-
   specific keys like "key"/"e"/"n"), matching app.py exactly;
   every response is {"result": ...} or {"error": ...}.
   ============================================================ */

const API_BASE_URL = window.CRYPTO_API_BASE || window.location.origin;

async function apiPost(path, body) {
  const res = await fetch(API_BASE_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  let json;
  try { json = await res.json(); } catch (e) { json = null; }
  if (!res.ok || !json || json.error) {
    throw new Error((json && json.error) || `Request failed (${res.status})`);
  }
  return json.result !== undefined ? json.result : json;
}

// apiFetch — for multipart file uploads or endpoints that stream file downloads
async function apiFetch(path, bodyOrFormData, isJson = false) {
  const headers = {};
  let body = bodyOrFormData;
  if (isJson) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(bodyOrFormData || {});
  }
  const res = await fetch(API_BASE_URL + path, {
    method: "POST",
    headers,
    body,
  });
  const disposition = res.headers.get("Content-Disposition");
  if (disposition) {
    if (!res.ok) {
      let msg = `Error ${res.status}`;
      try { const j = await res.json(); msg = j.error || msg; } catch (_) {}
      throw new Error(msg);
    }
    const blob = await res.blob();
    const filenameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    const filename = filenameMatch ? filenameMatch[1].replace(/['"]/g, "").trim() : "download";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    return { downloaded: true, filename };
  }
  let json;
  try { json = await res.json(); } catch (e) { json = null; }
  if (!res.ok || !json || json.error) {
    throw new Error((json && json.error) || `Request failed (${res.status})`);
  }
  return json.result !== undefined ? json.result : json;
}

const CryptoAPI = {
  encoding: {
    hexEncode:   (data) => apiPost("/api/encoding/hex/encode",    { data }),
    hexDecode:   (data) => apiPost("/api/encoding/hex/decode",    { data }),
    b64Encode:   (data) => apiPost("/api/encoding/base64/encode", { data }),
    b64Decode:   (data) => apiPost("/api/encoding/base64/decode", { data }),
    asciiEncode: (data) => apiPost("/api/encoding/ascii/encode",  { data }),
    asciiDecode: (data) => apiPost("/api/encoding/ascii/decode",  { data }),
    urlEncode:   (data) => apiPost("/api/encoding/url/encode",    { data }),
    urlDecode:   (data) => apiPost("/api/encoding/url/decode",    { data }),
  },
  encryption: {
    xor:  (data, key) => apiPost("/api/encryption/xor",  { data, key }),
    rc4:  (data, key) => apiPost("/api/encryption/rc4",  { data, key }),
    des:  (data, key) => apiPost("/api/encryption/des",  { data, key }),
    des3: (data, key1, key2, key3) => apiPost("/api/encryption/3des", { data, key1, key2, key3 }),
    aes:  (data, key) => apiPost("/api/encryption/aes",  { data, key }),
    rsaGenerateKeys: (bits) => apiPost("/api/encryption/rsa/generate-keys", { bits }),
    rsa:  (data, e, n) => apiPost("/api/encryption/rsa", { data, e, n }),
  },
  decryption: {
    xor:  (data, key) => apiPost("/api/decryption/xor",  { data, key }),
    rc4:  (data, key) => apiPost("/api/decryption/rc4",  { data, key }),
    des:  (data, key) => apiPost("/api/decryption/des",  { data, key }),
    des3: (data, key1, key2, key3) => apiPost("/api/decryption/3des", { data, key1, key2, key3 }),
    aes:  (data, key) => apiPost("/api/decryption/aes",  { data, key }),
    rsa:  (data, d, n) => apiPost("/api/decryption/rsa", { data, d, n }),
  },
  hashing: {
    md5:    (data) => apiPost("/api/hashing/md5",    { data }),
    sha1:   (data) => apiPost("/api/hashing/sha1",   { data }),
    sha256: (data) => apiPost("/api/hashing/sha256", { data }),
    bcryptHash:   (data, rounds) => apiPost("/api/hashing/bcrypt", { data, rounds }),
    bcryptVerify: (data, hash)   => apiPost("/api/hashing/bcrypt/verify", { data, hash }),
  },
  crack: {
    wordlist: (hash, hashType, wordlist) => apiPost("/api/crack/wordlist", { hash, hash_type: hashType, wordlist }),
    john:     (hash, hashType, wordlist) => apiPost("/api/crack/john",    { hash, hash_type: hashType, wordlist }),
    hashcat:  (hash, hashType, wordlist) => apiPost("/api/crack/hashcat", { hash, hash_type: hashType, wordlist }),
    hashescom: (hash, apiKey) => apiPost("/api/hashescom", { hash, api_key: apiKey }),
    hashescomBalance: (apiKey) => apiPost("/api/hashescom/balance", { api_key: apiKey }),
    hashescomIdentify: (hash, extended) => apiPost("/api/hashescom/identify", { hash, extended: extended ? "true" : "false" }),
  },
  file: {
    transform:     (formData) => apiFetch("/api/file/transform",      formData),
    encryptDES:    (formData) => apiFetch("/api/file/encrypt/des",    formData),
    decryptDES:    (formData) => apiFetch("/api/file/decrypt/des",    formData),
    encryptHybrid: (formData) => apiFetch("/api/file/encrypt/hybrid", formData),
    decryptHybrid: (bodyOrFormData) => {
      const isJson = !(bodyOrFormData instanceof FormData);
      return apiFetch("/api/file/decrypt/hybrid", bodyOrFormData, isJson);
    },
  },
};

window.CryptoAPI = CryptoAPI;
window.API_BASE_URL = API_BASE_URL;

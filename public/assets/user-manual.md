# YAOGUAI Cryptography Training Ground — User Manual

YAOGUAI (妖怪) is a hands-on cryptography curriculum and interactive workbench designed for learning encoding, symmetric and asymmetric ciphers, cryptographic hashing, hash cracking, and secure file encryption.

---

## 1. Running the Application

To run the application locally on your computer:

```bash
cd scripts
pip install -r requirements.txt
python app.py
```

This starts the unified Flask server hosting both the REST API and the frontend website, automatically opening your default web browser at `http://127.0.0.1:5000/`. To stop the server at any time, press `Ctrl+C` in your terminal.

---

## 2. Tools Workbench Overview

Navigate to **Tools** in the top navigation bar (`tools.html`) to access the interactive cryptography workbench:
- **Sidebar**: Select any cryptographic primitive organized by category: Encoding (Hex, Base64, ASCII, URL), Encryption (XOR, RC4, DES, 3DES, AES, RSA), Hashing (MD5, SHA-1, SHA-256, bcrypt), Cracking, and File Crypto.
- **Mode Switch**: Toggle between operations (e.g., Encode / Decode, Encrypt / Decrypt, Hash / Verify).
- **Output → Input**: Instantly copies the current result into the input box to chain operations together.
- **API Status**: The top bar chip monitors real-time connectivity to the local Flask backend.

---

## 3. Encrypting & Decrypting Files

The **File Crypto** section supports secure file handling with built-in client validation, in-flight progress indicators, and automatic downloads.

### Standard DES Mode
1. **Encrypt**:
   - Choose **File Encrypt** from the sidebar and select the **DES** algorithm tab.
   - Choose your `.txt` file (max 1 MB) and provide an 8-character secret key.
   - Click **Encrypt & Download**. Your browser will immediately download `<filename>.des.enc`.
2. **Decrypt**:
   - Select **File Decrypt** and the **DES** tab.
   - Choose your encrypted `.des.enc` file, provide the matching secret key, and enter the desired original filename (e.g. `notes.txt`).
   - Click **Decrypt & Download** to retrieve your restored plaintext file.

### Hybrid RSA + DES Mode
Hybrid encryption combines the speed of symmetric DES with the key-exchange security of asymmetric RSA:
1. **Key Generation**: Open the **RSA** tool, select your key size (e.g. 256-bit or 512-bit), click **Generate keys**, and copy the public modulus `n` and exponent `e`.
2. **Hybrid Encrypt**:
   - In **File Encrypt**, select **Hybrid RSA+DES** and choose your `.txt` file.
   - Paste `n` and `e`, then click **Encrypt & Download**.
   - The app generates a cryptographically random 8-byte DES session key, encrypts the file with DES, encrypts the session key with RSA, downloads `<filename>.hybrid.enc`, and presents the RSA-encrypted session key on screen. Click **Copy key** to store it safely.
3. **Hybrid Decrypt**:
   - In **File Decrypt**, select **Hybrid RSA+DES** and select your `.hybrid.enc` file.
   - Paste the encrypted session key, your private exponent `d`, and modulus `n`.
   - Click **Decrypt & Download** to recover your original file.

---

## 4. Hash Cracking & Identification

Under **Crack a hash**, three dedicated modes assist with CTF challenges and audits:
1. **Crack (sample wordlist)**: Fast offline dictionary attack across MD5, SHA-1, and SHA-256 using the built-in wordlist.
2. **Crack (Hashes.com)**: Online crowd-sourced database lookup via the Hashes.com API. Enter your personal API key once (persisted safely in your browser's local storage).
3. **Identify algorithm**: Queries the Hashes.com Hash Identifier API to inspect hash length and format patterns, returning probable algorithm candidates without requiring an API key.

---

## 5. Lessons & CTF Challenges

Click **Encoding**, **Encryption**, or **Hashing** in the top navigation bar to explore interactive lessons. Read historical context and algorithm specifications, solve comprehension checkpoints, and solve end-of-module CTF challenges by recovering secret flags in the `flag{...}` format. Mark each lesson complete to track your overall curriculum progress.

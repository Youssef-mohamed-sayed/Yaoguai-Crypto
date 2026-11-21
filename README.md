# Yaoguai-Crypto

**YAOGUAI 妖怪 — Cryptography Training Ground.** A beginner-to-CTF cryptography course with hands-on tasks and a challenge in every lesson, plus a Flask API for encoding, encryption and hashing.

## Run it locally

```bash
cd scripts
pip install -r requirements.txt
python app.py
```

This serves the website and the API together and opens http://127.0.0.1:5000/.

## Deploy to Vercel

1. Push this repository to GitHub.
2. On vercel.com choose **Add New → Project**, import the repo and click **Deploy**. No settings or API keys are needed.

`vercel.json` sends every request to `api/index.py`, which serves the pages from `public/` and the JSON API under `/api/`. The john and hashcat endpoints need local binaries and are disabled on the hosted version; the sample-wordlist cracker and the Hashes.com lookup are pure HTTP/Python and work everywhere.

Accounts, progress, and revocable sessions currently use SQLite. On Vercel these
files live in temporary storage and are not a durable shared database: a cold
start or another instance can lose accounts or require signing in again. Use a
durable shared database before relying on hosted account persistence. Set
`YAOGUAI_JWT_SECRET` to a private random secret in deployments; local runs generate
and persist a random signing key in the database. Previously issued sessions must
sign in again after the session-isolation update.

## Project structure

```text
Yaoguai-Crypto/
├── api/index.py        Vercel entry point
├── public/             the website: index.html, assets/, js/, lessons/
├── scripts/            Flask API (app.py) and crypto implementations
├── requirements.txt
└── vercel.json
```

## Lessons

Fully written: Hexadecimal, Base64, XOR, AES, MD5, bcrypt. The remaining modules open a placeholder page and are listed in `public/js/registry.js`.

"""
Yaoguai-Crypto — one-command app.

    python app.py

starts the Flask REST API (encoding, encryption, hashing, cracking) AND
serves the front-end website from the same server, then opens it in your
browser at http://127.0.0.1:5000/.  All API routes accept and return JSON.
"""
import binascii
import os
import threading
import webbrowser

from flask import Flask, request, jsonify, send_from_directory

import encoding
import encryption
import decryption
import hashing
import crack
import crackstation

HOST = "127.0.0.1"
PORT = int(os.environ.get("PORT", 5000))

# Site folder = ../public (holds index.html, lessons/, js/, assets/)
SITE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public"))

app = Flask(__name__, static_folder=None)


# john / hashcat / CrackStation need external tools or outbound access, so they
# are switched off when hosted on Vercel.
HOSTED = bool(os.environ.get("VERCEL"))
CRACK_PATHS = ("/api/crack/", "/api/crackstation")


@app.before_request
def block_cracking_when_hosted():
    if HOSTED and request.path.startswith(CRACK_PATHS):
        return jsonify({"success": False,
                        "error": "Cracking tools are disabled on the hosted version."}), 403


@app.after_request
def allow_local_cors(resp):
    # Lets the pages call the API even if index.html is opened straight from disk.
    resp.headers.setdefault("Access-Control-Allow-Origin", "*")
    resp.headers.setdefault("Access-Control-Allow-Headers", "Content-Type")
    resp.headers.setdefault("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    return resp


# ---------------------------------------------------------- FRONT-END SITE
# Only these site folders are public; scripts/ (source, wordlists) is not.
@app.route("/")
@app.route("/index.html")
def site_index():
    return send_from_directory(SITE_ROOT, "index.html")


@app.route("/tools")
@app.route("/tools.html")
def site_tools():
    return send_from_directory(SITE_ROOT, "tools.html")


@app.route("/favicon.ico")
def site_favicon():
    return send_from_directory(os.path.join(SITE_ROOT, "assets", "images"), "favicon.ico")


@app.route("/<any(lessons, js, assets):folder>/<path:filename>")
def site_files(folder, filename):
    return send_from_directory(os.path.join(SITE_ROOT, folder), filename)


def ok(result):
    return jsonify({"success": True, "result": result})


def err(message, status=400):
    return jsonify({"success": False, "error": message}), status


def get_json():
    data = request.get_json(silent=True)
    if data is None:
        data = {}
    return data


def require(data, *fields):
    missing = [f for f in fields if f not in data or data[f] in (None, "")]
    if missing:
        raise ValueError(f"Missing required field(s): {', '.join(missing)}")


@app.errorhandler(404)
def not_found(e):
    if not request.path.startswith("/api/"):
        return "404 - page not found", 404
    return err("Endpoint not found.", 404)


@app.errorhandler(500)
def server_error(e):
    # never leak stack traces
    return err("Internal server error.", 500)


# ---------------------------------------------------------------- ENCODING
@app.route("/api/encoding/hex/encode", methods=["POST"])
def hex_encode_route():
    data = get_json()
    try:
        require(data, "data")
        return ok(encoding.hex_encode(data["data"]))
    except ValueError as e:
        return err(str(e))


@app.route("/api/encoding/hex/decode", methods=["POST"])
def hex_decode_route():
    data = get_json()
    try:
        require(data, "data")
        return ok(encoding.hex_decode(data["data"]))
    except (ValueError, binascii.Error):
        return err("Invalid hexadecimal input.")


@app.route("/api/encoding/base64/encode", methods=["POST"])
def base64_encode_route():
    data = get_json()
    try:
        require(data, "data")
        return ok(encoding.base64_encode(data["data"]))
    except ValueError as e:
        return err(str(e))


@app.route("/api/encoding/base64/decode", methods=["POST"])
def base64_decode_route():
    data = get_json()
    try:
        require(data, "data")
        return ok(encoding.base64_decode(data["data"]))
    except (ValueError, binascii.Error):
        return err("Invalid Base64 input.")


@app.route("/api/encoding/ascii/encode", methods=["POST"])
def ascii_encode_route():
    data = get_json()
    try:
        require(data, "data")
        return ok(encoding.ascii_encode(data["data"]))
    except ValueError as e:
        return err(str(e))


@app.route("/api/encoding/ascii/decode", methods=["POST"])
def ascii_decode_route():
    data = get_json()
    try:
        require(data, "data")
        return ok(encoding.ascii_decode(data["data"]))
    except ValueError:
        return err("Invalid ASCII code list.")


@app.route("/api/encoding/url/encode", methods=["POST"])
def url_encode_route():
    data = get_json()
    try:
        require(data, "data")
        return ok(encoding.url_encode(data["data"]))
    except ValueError as e:
        return err(str(e))


@app.route("/api/encoding/url/decode", methods=["POST"])
def url_decode_route():
    data = get_json()
    try:
        require(data, "data")
        return ok(encoding.url_decode(data["data"]))
    except ValueError as e:
        return err(str(e))


# -------------------------------------------------------------- ENCRYPTION
@app.route("/api/encryption/xor", methods=["POST"])
def xor_encrypt_route():
    data = get_json()
    try:
        require(data, "data", "key")
        return ok(encryption.xor_encrypt(data["data"], data["key"]))
    except ValueError as e:
        return err(str(e))


@app.route("/api/encryption/rc4", methods=["POST"])
def rc4_encrypt_route():
    data = get_json()
    try:
        require(data, "data", "key")
        return ok(encryption.rc4_encrypt(data["data"], data["key"]))
    except ValueError as e:
        return err(str(e))


@app.route("/api/encryption/des", methods=["POST"])
def des_encrypt_route():
    data = get_json()
    try:
        require(data, "data", "key")
        return ok(encryption.des_encrypt(data["data"], data["key"]))
    except ValueError as e:
        return err(str(e))


@app.route("/api/encryption/3des", methods=["POST"])
def triple_des_encrypt_route():
    data = get_json()
    try:
        require(data, "data", "key1", "key2")
        return ok(encryption.triple_des_encrypt(
            data["data"], data["key1"], data["key2"], data.get("key3")))
    except ValueError as e:
        return err(str(e))


@app.route("/api/encryption/aes", methods=["POST"])
def aes_encrypt_route():
    data = get_json()
    try:
        require(data, "data", "key")
        return ok(encryption.aes_encrypt(data["data"], data["key"]))
    except ValueError as e:
        return err(str(e))


@app.route("/api/encryption/rsa/generate-keys", methods=["POST"])
def rsa_generate_keys_route():
    data = get_json()
    bits = int(data.get("bits", 512))
    if bits < 64 or bits > 2048 or bits % 2 != 0:
        return err("bits must be an even number between 64 and 2048 (demo-sized).")
    keys = encryption.rsa_generate_keys(bits)
    # strings, not numbers: JSON numbers this large lose precision in JavaScript
    return ok({"n": str(keys["n"]), "e": str(keys["e"]), "d": str(keys["d"])})


@app.route("/api/encryption/rsa", methods=["POST"])
def rsa_encrypt_route():
    data = get_json()
    try:
        require(data, "data", "e", "n")
        return ok(encryption.rsa_encrypt(data["data"], int(data["e"]), int(data["n"])))
    except ValueError as e:
        return err(str(e))


# -------------------------------------------------------------- DECRYPTION
@app.route("/api/decryption/xor", methods=["POST"])
def xor_decrypt_route():
    data = get_json()
    try:
        require(data, "data", "key")
        return ok(decryption.xor_decrypt(data["data"], data["key"]))
    except (ValueError, binascii.Error):
        return err("Invalid key or malformed ciphertext.")


@app.route("/api/decryption/rc4", methods=["POST"])
def rc4_decrypt_route():
    data = get_json()
    try:
        require(data, "data", "key")
        return ok(decryption.rc4_decrypt(data["data"], data["key"]))
    except (ValueError, binascii.Error):
        return err("Invalid key or malformed ciphertext.")


@app.route("/api/decryption/des", methods=["POST"])
def des_decrypt_route():
    data = get_json()
    try:
        require(data, "data", "key")
        return ok(decryption.des_decrypt(data["data"], data["key"]))
    except (ValueError, binascii.Error):
        return err("Invalid key or malformed ciphertext.")


@app.route("/api/decryption/3des", methods=["POST"])
def triple_des_decrypt_route():
    data = get_json()
    try:
        require(data, "data", "key1", "key2")
        return ok(decryption.triple_des_decrypt(
            data["data"], data["key1"], data["key2"], data.get("key3")))
    except (ValueError, binascii.Error):
        return err("Invalid key(s) or malformed ciphertext.")


@app.route("/api/decryption/aes", methods=["POST"])
def aes_decrypt_route():
    data = get_json()
    try:
        require(data, "data", "key")
        return ok(decryption.aes_decrypt(data["data"], data["key"]))
    except (ValueError, binascii.Error):
        return err("Invalid key or malformed ciphertext.")


@app.route("/api/decryption/rsa", methods=["POST"])
def rsa_decrypt_route():
    data = get_json()
    try:
        require(data, "data", "d", "n")
        return ok(decryption.rsa_decrypt(data["data"], int(data["d"]), int(data["n"])))
    except ValueError as e:
        return err("Invalid RSA parameters.")


# ----------------------------------------------------------------- HASHING
@app.route("/api/hashing/md5", methods=["POST"])
def md5_hash_route():
    data = get_json()
    try:
        require(data, "data")
        return ok(hashing.md5_hash(data["data"]))
    except ValueError as e:
        return err(str(e))


@app.route("/api/hashing/sha1", methods=["POST"])
def sha1_hash_route():
    data = get_json()
    try:
        require(data, "data")
        return ok(hashing.sha1_hash(data["data"]))
    except ValueError as e:
        return err(str(e))


@app.route("/api/hashing/sha256", methods=["POST"])
def sha256_hash_route():
    data = get_json()
    try:
        require(data, "data")
        return ok(hashing.sha256_hash(data["data"]))
    except ValueError as e:
        return err(str(e))


@app.route("/api/hashing/bcrypt", methods=["POST"])
def bcrypt_hash_route():
    data = get_json()
    try:
        require(data, "data")
        rounds = int(data.get("rounds", 12))
        return ok(hashing.bcrypt_hash(data["data"], rounds))
    except ValueError as e:
        return err(str(e))


@app.route("/api/hashing/bcrypt/verify", methods=["POST"])
def bcrypt_verify_route():
    data = get_json()
    try:
        require(data, "data", "hash")
        return ok(hashing.bcrypt_verify(data["data"], data["hash"]))
    except ValueError as e:
        return err(str(e))


# ------------------------------------------------------------------- CRACK
@app.route("/api/crack/john", methods=["POST"])
def crack_john_route():
    data = get_json()
    try:
        require(data, "hash")
        result = crack.crack_with_john(
            data["hash"], data.get("hash_type", "md5"), data.get("wordlist"))
        return jsonify(result)
    except ValueError as e:
        return err(str(e))


@app.route("/api/crack/hashcat", methods=["POST"])
def crack_hashcat_route():
    data = get_json()
    try:
        require(data, "hash")
        result = crack.crack_with_hashcat(
            data["hash"], data.get("hash_type", "md5"), data.get("wordlist"))
        return jsonify(result)
    except ValueError as e:
        return err(str(e))


@app.route("/api/crackstation", methods=["POST"])
def crackstation_route():
    data = get_json()
    try:
        require(data, "hash")
        result = crackstation.crackstation_lookup(data["hash"])
        return jsonify(result)
    except ValueError as e:
        return err(str(e))


if __name__ == "__main__":
    url = f"http://{HOST}:{PORT}/"
    print(f"\n  YAOGUAI is running at {url}  (Ctrl+C to stop)\n")
    threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    app.run(debug=False, host=HOST, port=PORT)

import io
import pathlib
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "scripts"))
import app
import auth


class AuthenticationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.paths = patch.multiple(auth, DB_PATH=str(pathlib.Path(self.temp.name) / "test.db"),
                                    AVATARS_DIR=self.temp.name, _db_initialized=False)
        self.paths.start()
        self.client = app.app.test_client()

    def tearDown(self):
        self.paths.stop()
        self.temp.cleanup()

    def register(self, **changes):
        return self.client.post("/api/auth/register", json={
            "username": "test_user", "password": "password123", **changes})

    def test_registration_rules_and_all_missing_fields(self):
        response = self.register(username="", password="")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.json["errors"]), {"username", "password"})
        for fields, message in [
            ({"password": "1234567"}, "at least 8"),
            ({"password": "x" * 73}, "72 UTF-8 bytes"),
            ({"password": "😀" * 19}, "72 UTF-8 bytes"),
            ({"username": "ab"}, "3 and 30"),
            ({"username": "a" * 31}, "3 and 30"),
            ({"username": "bad name"}, "only contain"),
            ({"username": ["test"]}, "must be text"),
            ({"password": 12345678}, "must be text"),
        ]:
            with self.subTest(fields=fields):
                response = self.register(**fields)
                self.assertEqual(response.status_code, 400)
                self.assertIn(message, response.json["error"])

    def test_registration_login_and_duplicate(self):
        response = self.register(password="12345678")
        self.assertEqual(response.status_code, 200)
        token = response.json["result"]["token"]
        self.assertEqual(self.client.get("/api/auth/me", headers={
            "Authorization": f"Bearer {token}"}).status_code, 200)
        self.assertIn("already exists", self.register(username="TEST_USER").json["error"])
        response = self.client.post("/api/auth/login", json={
            "username": "test_user", "password": "12345678"})
        self.assertEqual(response.status_code, 200)

    def test_login_errors_and_legacy_short_password(self):
        response = self.client.post("/api/auth/login", json={})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.json["errors"]), {"username", "password"})
        with auth.get_db() as conn:
            conn.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)",
                         ("legacy", auth.hash_password("1234")))
        for username, password, status in [("legacy", "1234", 200),
                                            ("legacy", "wrong", 401),
                                            ("missing", "wrong", 401)]:
            response = self.client.post("/api/auth/login", json={
                "username": username, "password": password})
            self.assertEqual(response.status_code, status)
            if status == 401:
                self.assertEqual(response.json["error"], "Invalid username or password.")

    def test_bad_json_returns_json_error(self):
        for endpoint in ("register", "login", "avatar"):
            for body in ("[]", "null", "{", '"text"', "123"):
                response = self.client.post(f"/api/auth/{endpoint}", data=body,
                                            content_type="application/json")
                self.assertEqual(response.status_code, 400)
                self.assertIn("valid JSON object", response.json["error"])

    def test_avatar_validation_and_upload_limits(self):
        for content, filename, message in [(b"", "a.png", "Empty"),
                                            (b"fake", "a.png", "Invalid PNG"),
                                            (b"fake", "a.gif", ".png or .jpg")]:
            response = self.client.post("/api/auth/register", data={
                "username": "avatar_user", "password": "password123",
                "avatar": (io.BytesIO(content), filename)})
            self.assertEqual(response.status_code, 400)
            self.assertIn(message, response.json["error"])
        # Header validation is the existing avatar format policy.
        content = auth.PNG_MAGIC + b"x" * (2 * 1024 * 1024 - len(auth.PNG_MAGIC))
        response = self.client.post("/api/auth/register", data={
            "username": "avatar_user", "password": "password123",
            "avatar": (io.BytesIO(content), "a.png")})
        self.assertEqual(response.status_code, 200)
        response = self.client.post("/api/auth/register", data={
            "username": "other_user", "password": "password123",
            "avatar": (io.BytesIO(content + b"x"), "a.png")})
        self.assertEqual(response.status_code, 400)
        self.assertIn("2 MB", response.json["error"])
        response = self.client.post("/api/auth/register", data=b"x" * (3 * 1024 * 1024 + 1),
                                    content_type="application/json")
        self.assertEqual(response.status_code, 413)
        self.assertIn("2 MB", response.json["error"])
        response = self.client.post("/api/encoding/hex/encode", data=b"x" * (1024 * 1024 + 1))
        self.assertEqual(response.status_code, 413)

    def test_bad_base64_and_session(self):
        self.assertIn("Invalid base64", self.register(avatar_b64="!!!").json["error"])
        response = self.client.get("/api/auth/me", headers={"Authorization": "Bearer invalid"})
        self.assertEqual(response.status_code, 401)
        self.assertIn("log in again", response.json["error"])

    def test_service_errors_do_not_leak_internal_details(self):
        for endpoint, target in [("register", "register_user"), ("login", "login_user")]:
            with patch.object(auth, target, side_effect=sqlite3.OperationalError("private/path.db")), \
                    self.assertLogs(app.app.logger, level="ERROR"):
                response = self.client.post(f"/api/auth/{endpoint}", json={
                    "username": "test_user", "password": "password123"})
            self.assertEqual(response.status_code, 500)
            self.assertIn("try again later", response.json["error"])
            self.assertNotIn("private", response.json["error"])


if __name__ == "__main__":
    unittest.main()

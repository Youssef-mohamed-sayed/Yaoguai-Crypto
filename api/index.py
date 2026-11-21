"""Vercel entry point: exposes the Flask app from scripts/app.py."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from app import app  # noqa: E402,F401  (Vercel looks for a variable named `app`)

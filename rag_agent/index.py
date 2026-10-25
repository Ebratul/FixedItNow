"""Vercel entry point: Vercel's Python runtime looks for a module-level ASGI `app`.

Locally the service is started with `python -m app` (see README); this file is only used on Vercel.
"""

from app.main import app_from_env

app = app_from_env()

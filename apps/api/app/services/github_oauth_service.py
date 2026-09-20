"""
GitHub OAuth (Authorization Code flow).

By design, the backend does not persist GitHub access tokens: the frontend
receives the token after the OAuth callback and passes it along on each
ingestion request. This keeps token storage/rotation out of scope for this
version — see README "Known limitations" for the production hardening note
(a real deployment should store this encrypted, scoped per-user, in a
dedicated secrets-aware table).
"""
from __future__ import annotations

import httpx
from urllib.parse import urlencode

from app.core.config import settings

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"


class GithubOAuthError(Exception):
    pass


def is_oauth_configured() -> bool:
    return bool(settings.github_client_id and settings.github_client_secret)


def build_authorize_url(redirect_uri: str, state: str) -> str:
    if not is_oauth_configured():
        raise GithubOAuthError(
            "GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET."
        )
    params = {
        "client_id": settings.github_client_id,
        "redirect_uri": redirect_uri,
        "scope": "repo read:org",
        "state": state,
    }
    return f"{GITHUB_AUTHORIZE_URL}?{urlencode(params)}"


async def exchange_code_for_token(code: str, redirect_uri: str) -> str:
    if not is_oauth_configured():
        raise GithubOAuthError(
            "GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET."
        )

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            GITHUB_TOKEN_URL,
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
            },
        )

    if response.status_code != 200:
        raise GithubOAuthError(f"GitHub token exchange failed with status {response.status_code}.")

    data = response.json()
    if "error" in data:
        raise GithubOAuthError(data.get("error_description", data["error"]))

    access_token = data.get("access_token")
    if not access_token:
        raise GithubOAuthError("GitHub did not return an access token.")

    return access_token

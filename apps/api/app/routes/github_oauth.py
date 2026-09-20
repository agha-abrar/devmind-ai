import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.deps import get_current_user
from app.models.user import User
from app.services.github_oauth_service import (
    GithubOAuthError,
    build_authorize_url,
    exchange_code_for_token,
    is_oauth_configured,
)

router = APIRouter(prefix="/integrations/github", tags=["github-oauth"])


class AuthorizeUrlResponse(BaseModel):
    authorize_url: str | None
    configured: bool
    state: str | None = None


class CallbackRequest(BaseModel):
    code: str
    redirect_uri: str


class CallbackResponse(BaseModel):
    access_token: str


@router.get("/authorize-url", response_model=AuthorizeUrlResponse)
async def get_authorize_url(
    redirect_uri: str, current_user: User = Depends(get_current_user)
) -> AuthorizeUrlResponse:
    if not is_oauth_configured():
        return AuthorizeUrlResponse(authorize_url=None, configured=False)

    state = secrets.token_urlsafe(24)
    url = build_authorize_url(redirect_uri, state)
    return AuthorizeUrlResponse(authorize_url=url, configured=True, state=state)


@router.post("/callback", response_model=CallbackResponse)
async def oauth_callback(
    payload: CallbackRequest, current_user: User = Depends(get_current_user)
) -> CallbackResponse:
    try:
        token = await exchange_code_for_token(payload.code, payload.redirect_uri)
    except GithubOAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return CallbackResponse(access_token=token)

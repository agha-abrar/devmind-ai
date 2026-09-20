from __future__ import annotations

import uuid

from slugify import slugify
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.security import (
    InvalidTokenError,
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.enums import WorkspaceRole
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember

logger = get_logger(__name__)


class AuthError(Exception):
    """Raised for any auth failure that should map to an HTTP error."""


async def _unique_slug(db: AsyncSession, base: str) -> str:
    base_slug = slugify(base) or "workspace"
    candidate = base_slug
    suffix = 1
    while True:
        result = await db.execute(select(Workspace).where(Workspace.slug == candidate))
        if result.scalar_one_or_none() is None:
            return candidate
        suffix += 1
        candidate = f"{base_slug}-{suffix}"


async def register_user(db: AsyncSession, email: str, password: str, full_name: str) -> User:
    existing = await db.execute(select(User).where(User.email == email.lower()))
    if existing.scalar_one_or_none() is not None:
        raise AuthError("An account with this email already exists.")

    user = User(
        email=email.lower(),
        hashed_password=hash_password(password),
        full_name=full_name,
    )
    db.add(user)
    await db.flush()

    # Every user gets a personal workspace by default. The data model already
    # supports multiple members per workspace so teams can be added later
    # without a schema change.
    workspace = Workspace(
        name=f"{full_name}'s Workspace",
        slug=await _unique_slug(db, full_name),
        owner_id=user.id,
    )
    db.add(workspace)
    await db.flush()

    membership = WorkspaceMember(
        workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.OWNER
    )
    db.add(membership)

    await db.commit()
    await db.refresh(user)
    logger.info("user_registered", user_id=str(user.id), workspace_id=str(workspace.id))
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    result = await db.execute(select(User).where(User.email == email.lower()))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(password, user.hashed_password):
        raise AuthError("Invalid email or password.")
    if not user.is_active:
        raise AuthError("This account has been deactivated.")
    return user


def issue_tokens(user: User) -> tuple[str, str]:
    return create_access_token(user.id), create_refresh_token(user.id)


async def refresh_access_token(db: AsyncSession, refresh_token: str) -> tuple[str, str, User]:
    try:
        payload = decode_token(refresh_token, TokenType.REFRESH)
    except InvalidTokenError as exc:
        raise AuthError(str(exc)) from exc

    user_id = payload.get("sub")
    try:
        user_uuid = uuid.UUID(user_id)
    except (TypeError, ValueError) as exc:
        raise AuthError("Invalid token subject.") from exc

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise AuthError("User no longer exists or is inactive.")

    access_token, new_refresh_token = issue_tokens(user)
    return access_token, new_refresh_token, user

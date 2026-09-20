"""
Development-only seed data. Gated by ENABLE_DEV_SEED so it can never run
accidentally in production. Run with: `python -m app.db.seed` inside the
api container/venv.
"""
import asyncio

from sqlalchemy import select

from app.core.config import settings
from app.core.logging import get_logger
from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.conversation import Conversation
from app.models.enums import WorkspaceRole
from app.models.project import Project
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember

logger = get_logger(__name__)

DEMO_EMAIL = "demo@example.com"
DEMO_PASSWORD = "DemoPassword123!"


async def seed() -> None:
    if not settings.enable_dev_seed:
        logger.info("dev_seed_skipped", reason="ENABLE_DEV_SEED is false")
        return

    if settings.is_production:
        logger.warning("dev_seed_refused_in_production")
        return

    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(User).where(User.email == DEMO_EMAIL))
        if existing.scalar_one_or_none() is not None:
            logger.info("dev_seed_already_present")
            return

        user = User(
            email=DEMO_EMAIL,
            hashed_password=hash_password(DEMO_PASSWORD),
            full_name="Demo User",
        )
        db.add(user)
        await db.flush()

        workspace = Workspace(name="Demo Workspace", slug="demo-workspace", owner_id=user.id)
        db.add(workspace)
        await db.flush()

        db.add(WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.OWNER))

        project = Project(
            workspace_id=workspace.id,
            name="Sample Project",
            description=(
                "A starter project. Connect a GitHub repository or upload documentation, "
                "then ask a question in AI Workspace to see retrieval, multi-agent "
                "orchestration, and citations in action."
            ),
        )
        db.add(project)
        await db.flush()

        db.add(
            Conversation(
                project_id=project.id,
                user_id=user.id,
                title="Welcome to DevMind AI",
            )
        )

        await db.commit()
        logger.info("dev_seed_created", email=DEMO_EMAIL)
        print(  # noqa: T201 — intentional plain stdout so credentials aren't redacted by the logger
            f"\nDev seed created. Demo login -> email: {DEMO_EMAIL}  password: {DEMO_PASSWORD}\n"
            "This account only exists because ENABLE_DEV_SEED=true. Never enable this in production.\n"
        )


if __name__ == "__main__":
    asyncio.run(seed())

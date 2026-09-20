"""
Importing this module registers every ORM model with SQLAlchemy's mapper
registry. Alembic's env.py imports this module (via app.db.base) so
`alembic revision --autogenerate` can see every table.
"""
from app.db.base import Base  # noqa: F401
from app.models.agent_run import AgentRun, AgentStep  # noqa: F401
from app.models.citation import Citation  # noqa: F401
from app.models.conversation import Conversation, Message  # noqa: F401
from app.models.document import Document  # noqa: F401
from app.models.knowledge import KnowledgeChunk, KnowledgeSource  # noqa: F401
from app.models.project import Project  # noqa: F401
from app.models.repository import Repository  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.workspace import Workspace, WorkspaceMember  # noqa: F401

__all__ = [
    "Base",
    "User",
    "Workspace",
    "WorkspaceMember",
    "Project",
    "Repository",
    "Document",
    "KnowledgeSource",
    "KnowledgeChunk",
    "Conversation",
    "Message",
    "AgentRun",
    "AgentStep",
    "Citation",
]

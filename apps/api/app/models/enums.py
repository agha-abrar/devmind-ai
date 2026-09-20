import enum


class WorkspaceRole(str, enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class ProjectStatus(str, enum.Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class RepositoryStatus(str, enum.Enum):
    PENDING = "pending"
    INDEXING = "indexing"
    INDEXED = "indexed"
    FAILED = "failed"


class DocumentStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    INDEXED = "indexed"
    FAILED = "failed"


class KnowledgeSourceType(str, enum.Enum):
    CODE_FILE = "code_file"
    DOCUMENT = "document"


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class AgentRunStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class AgentStepStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class AgentName(str, enum.Enum):
    SUPERVISOR = "supervisor"
    CODE_RETRIEVAL = "code_retrieval"
    DOCUMENTATION = "documentation"
    DEBUGGING = "debugging"
    ARCHITECTURE = "architecture"
    IMPLEMENTATION_PLANNING = "implementation_planning"
    REVIEWER = "reviewer"


class ReviewStatus(str, enum.Enum):
    SUPPORTED = "supported"
    NEEDS_MORE_EVIDENCE = "needs_more_evidence"
    UNSUPPORTED = "unsupported"

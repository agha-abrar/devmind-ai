"""
Rules for deciding which files in a repository are worth indexing.
Keeps noise (build artifacts, dependency trees, binaries) out of the
knowledge base.
"""
import fnmatch
import os

IGNORED_DIR_NAMES = {
    "node_modules",
    ".git",
    ".next",
    ".nuxt",
    "dist",
    "build",
    "out",
    "coverage",
    "venv",
    ".venv",
    "env",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "target",
    "bin",
    "obj",
    ".idea",
    ".vscode",
    "vendor",
    ".terraform",
    "public/assets",
    ".cache",
}

IGNORED_FILE_PATTERNS = [
    "*.min.js",
    "*.min.css",
    "*.map",
    "*.lock",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "poetry.lock",
    "*.png",
    "*.jpg",
    "*.jpeg",
    "*.gif",
    "*.webp",
    "*.ico",
    "*.svg",
    "*.woff",
    "*.woff2",
    "*.ttf",
    "*.eot",
    "*.pdf",
    "*.zip",
    "*.tar",
    "*.gz",
    "*.exe",
    "*.dll",
    "*.so",
    "*.dylib",
    "*.class",
    "*.jar",
    "*.pyc",
    "*.db",
    "*.sqlite",
    "*.wasm",
]

SUPPORTED_EXTENSIONS = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".py": "python",
    ".java": "java",
    ".go": "go",
    ".rs": "rust",
    ".cs": "csharp",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".c": "c",
    ".h": "c",
    ".hpp": "cpp",
    ".md": "markdown",
    ".mdx": "markdown",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".sql": "sql",
    ".rb": "ruby",
    ".php": "php",
    ".kt": "kotlin",
    ".swift": "swift",
}

MAX_FILE_SIZE_BYTES = 512 * 1024  # 512 KB — larger files are almost always generated/vendored


def is_path_ignored(path: str) -> bool:
    parts = path.split("/")
    if any(part in IGNORED_DIR_NAMES for part in parts):
        return True
    filename = parts[-1]
    for pattern in IGNORED_FILE_PATTERNS:
        if fnmatch.fnmatch(filename, pattern):
            return True
    return False


def get_language(path: str) -> str | None:
    _, ext = os.path.splitext(path)
    return SUPPORTED_EXTENSIONS.get(ext.lower())


def is_supported_file(path: str, size_bytes: int) -> bool:
    if is_path_ignored(path):
        return False
    if size_bytes > MAX_FILE_SIZE_BYTES:
        return False
    return get_language(path) is not None

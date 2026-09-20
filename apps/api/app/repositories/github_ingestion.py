"""
GitHub repository ingestion.

Uses the GitHub REST API (via PyGithub) to walk a repository's git tree at its
default branch, filter out noise, and yield the raw content of every
supported file. Treats all repository content as untrusted data — it is
embedded and retrieved as evidence, never executed or treated as
instructions to the LLM.
"""
from __future__ import annotations

import base64
import re
from dataclasses import dataclass

from github import Auth, Github, GithubException

from app.core.logging import get_logger
from app.repositories.file_filters import get_language, is_supported_file

logger = get_logger(__name__)

_GITHUB_URL_PATTERN = re.compile(
    r"^(?:https?://github\.com/)?(?P<owner>[\w.-]+)/(?P<repo>[\w.-]+?)(?:\.git)?/?$"
)


class GithubIngestionError(Exception):
    pass


@dataclass
class RepoMetadata:
    owner: str
    name: str
    full_name: str
    default_branch: str
    latest_commit_sha: str
    description: str | None


@dataclass
class RepoFile:
    path: str
    language: str
    content: str
    size_bytes: int


def parse_repo_url(url_or_slug: str) -> tuple[str, str]:
    match = _GITHUB_URL_PATTERN.match(url_or_slug.strip())
    if not match:
        raise GithubIngestionError(
            "Could not parse repository. Expected a GitHub URL or 'owner/repo'."
        )
    return match.group("owner"), match.group("repo")


def _get_client(access_token: str | None) -> Github:
    if access_token:
        return Github(auth=Auth.Token(access_token))
    from app.core.config import settings

    if settings.github_default_token:
        return Github(auth=Auth.Token(settings.github_default_token))
    # Unauthenticated access works for public repos but is rate-limited to 60 req/hr.
    return Github()


def fetch_repo_metadata(owner: str, name: str, access_token: str | None) -> RepoMetadata:
    client = _get_client(access_token)
    try:
        gh_repo = client.get_repo(f"{owner}/{name}")
        branch = gh_repo.default_branch
        latest_commit = gh_repo.get_branch(branch).commit.sha
    except GithubException as exc:
        if exc.status == 404:
            raise GithubIngestionError(
                f"Repository '{owner}/{name}' was not found, or is private and no "
                "valid access token was provided."
            ) from exc
        if exc.status in (401, 403):
            raise GithubIngestionError(
                "GitHub rejected the request (authentication or rate limit issue). "
                "Provide a valid access token."
            ) from exc
        raise GithubIngestionError(f"GitHub API error: {exc.data}") from exc

    return RepoMetadata(
        owner=owner,
        name=name,
        full_name=gh_repo.full_name,
        default_branch=branch,
        latest_commit_sha=latest_commit,
        description=gh_repo.description,
    )


def iter_repo_files(
    owner: str, name: str, branch: str, access_token: str | None
):
    """Yields RepoFile for every supported, non-ignored file in the repo."""
    client = _get_client(access_token)
    gh_repo = client.get_repo(f"{owner}/{name}")

    try:
        tree = gh_repo.get_git_tree(branch, recursive=True)
    except GithubException as exc:
        raise GithubIngestionError(f"Failed to read repository tree: {exc.data}") from exc

    if tree.tree is None:
        return

    for item in tree.tree:
        if item.type != "blob":
            continue
        if item.size is None:
            continue
        if not is_supported_file(item.path, item.size):
            continue

        try:
            blob = gh_repo.get_git_blob(item.sha)
        except GithubException as exc:
            logger.warning("github_blob_fetch_failed", path=item.path, error=str(exc))
            continue

        if blob.encoding != "base64":
            continue

        try:
            raw_bytes = base64.b64decode(blob.content)
            content = raw_bytes.decode("utf-8")
        except (ValueError, UnicodeDecodeError):
            # Skip binary or non-UTF8 files we couldn't reliably filter by extension
            continue

        language = get_language(item.path)
        if language is None:
            continue

        yield RepoFile(path=item.path, language=language, content=content, size_bytes=item.size)

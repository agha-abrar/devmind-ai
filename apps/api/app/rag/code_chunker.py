"""
Code-aware chunking.

Goal: each chunk should map to a meaningful structural unit (function, method,
class, module-level block) rather than an arbitrary fixed-size slice, so
retrieval results are coherent and citations point at something readable.

Python gets exact boundaries via the `ast` module. Other languages use
regex-based heuristics for common function/class/struct/interface signatures.
Anything without detectable structure (JSON/YAML/TOML/SQL, or code where no
boundary matched) falls back to a token-aware sliding window.
"""
from __future__ import annotations

import ast
import re

from app.rag.chunk_types import Chunk
from app.rag.tokenizer import count_tokens

MAX_CHUNK_TOKENS = 400
MIN_CHUNK_TOKENS = 20
WINDOW_OVERLAP_LINES = 5

# (language -> regex matching a line that starts a function/class/struct/etc.)
_SIGNATURE_PATTERNS: dict[str, re.Pattern] = {
    "typescript": re.compile(
        r"^\s*(export\s+)?(default\s+)?(async\s+)?"
        r"(function\s+\w+|class\s+\w+|interface\s+\w+|type\s+\w+\s*=|"
        r"const\s+\w+\s*=\s*(async\s*)?\(|enum\s+\w+)"
    ),
    "javascript": re.compile(
        r"^\s*(export\s+)?(default\s+)?(async\s+)?"
        r"(function\s+\w+|class\s+\w+|const\s+\w+\s*=\s*(async\s*)?\()"
    ),
    "java": re.compile(
        r"^\s*(public|private|protected|static|final|\s)*"
        r"(class|interface|enum)\s+\w+|"
        r"^\s*(public|private|protected|static|final|\s)+[\w<>\[\]]+\s+\w+\s*\("
    ),
    "go": re.compile(r"^\s*func\s+(\(\w+\s+\*?\w+\)\s+)?\w+\s*\("),
    "rust": re.compile(r"^\s*(pub\s+)?(async\s+)?(fn|struct|enum|trait|impl)\s+\w+"),
    "csharp": re.compile(
        r"^\s*(public|private|protected|internal|static|\s)*(class|interface|struct|enum)\s+\w+"
    ),
    "cpp": re.compile(
        r"^\s*(class|struct)\s+\w+|^\s*\w[\w:<>,\s\*&]*\s+\w+::\w+\s*\("
    ),
    "c": re.compile(r"^\s*[\w\*]+\s+\w+\s*\([^;]*\)\s*\{?\s*$"),
    "ruby": re.compile(r"^\s*(class|module|def)\s+\w+"),
    "php": re.compile(r"^\s*(public|private|protected|static|\s)*(function|class|interface)\s+\w+"),
    "kotlin": re.compile(r"^\s*(public|private|internal|\s)*(fun|class|interface|object)\s+\w+"),
    "swift": re.compile(r"^\s*(public|private|internal|\s)*(func|class|struct|enum|protocol)\s+\w+"),
}

_STRUCTURED_TEXT_LANGUAGES = {"json", "yaml", "toml", "sql"}


def _chunk_python(content: str) -> list[Chunk]:
    lines = content.splitlines()
    try:
        tree = ast.parse(content)
    except SyntaxError:
        return _sliding_window(content)

    top_level_nodes = [
        node
        for node in tree.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))
    ]

    if not top_level_nodes:
        return _sliding_window(content)

    chunks: list[Chunk] = []
    covered_end = 0

    for idx, node in enumerate(top_level_nodes):
        start_line = node.lineno
        end_line = node.end_lineno or start_line

        # Capture any module-level code between the previous node and this one
        if start_line - 1 > covered_end:
            gap_text = "\n".join(lines[covered_end:start_line - 1]).strip()
            if gap_text and count_tokens(gap_text) >= MIN_CHUNK_TOKENS:
                chunks.append(
                    Chunk(
                        content=gap_text,
                        chunk_index=len(chunks),
                        token_count=count_tokens(gap_text),
                        symbol_type="module",
                        start_line=covered_end + 1,
                        end_line=start_line - 1,
                    )
                )

        symbol_type = "class" if isinstance(node, ast.ClassDef) else "function"
        snippet = "\n".join(lines[start_line - 1:end_line])
        chunks.append(
            Chunk(
                content=snippet,
                chunk_index=len(chunks),
                token_count=count_tokens(snippet),
                symbol_name=node.name,
                symbol_type=symbol_type,
                start_line=start_line,
                end_line=end_line,
            )
        )
        covered_end = end_line

    if covered_end < len(lines):
        tail_text = "\n".join(lines[covered_end:]).strip()
        if tail_text and count_tokens(tail_text) >= MIN_CHUNK_TOKENS:
            chunks.append(
                Chunk(
                    content=tail_text,
                    chunk_index=len(chunks),
                    token_count=count_tokens(tail_text),
                    symbol_type="module",
                    start_line=covered_end + 1,
                    end_line=len(lines),
                )
            )

    return _split_oversized(chunks)


def _chunk_by_signature(content: str, language: str) -> list[Chunk]:
    pattern = _SIGNATURE_PATTERNS.get(language)
    lines = content.splitlines()
    if pattern is None or not lines:
        return _sliding_window(content)

    boundaries: list[int] = [i for i, line in enumerate(lines) if pattern.match(line)]
    if not boundaries:
        return _sliding_window(content)

    chunks: list[Chunk] = []
    if boundaries[0] > 0:
        header = "\n".join(lines[: boundaries[0]]).strip()
        if header and count_tokens(header) >= MIN_CHUNK_TOKENS:
            chunks.append(
                Chunk(
                    content=header,
                    chunk_index=len(chunks),
                    token_count=count_tokens(header),
                    symbol_type="module",
                    start_line=1,
                    end_line=boundaries[0],
                )
            )

    for i, start in enumerate(boundaries):
        end = boundaries[i + 1] if i + 1 < len(boundaries) else len(lines)
        snippet = "\n".join(lines[start:end])
        name_match = re.search(r"\b(\w+)\s*\(", lines[start]) or re.search(r"\b(\w+)\b\s*$", lines[start])
        symbol_name = name_match.group(1) if name_match else None
        symbol_type = "class" if re.search(r"\bclass\b|\bstruct\b|\binterface\b", lines[start]) else "function"
        chunks.append(
            Chunk(
                content=snippet,
                chunk_index=len(chunks),
                token_count=count_tokens(snippet),
                symbol_name=symbol_name,
                symbol_type=symbol_type,
                start_line=start + 1,
                end_line=end,
            )
        )

    return _split_oversized(chunks)


def _sliding_window(content: str) -> list[Chunk]:
    lines = content.splitlines()
    if not lines:
        return []

    chunks: list[Chunk] = []
    window_lines: list[str] = []
    window_start = 1
    current_line = 0

    for line in lines:
        window_lines.append(line)
        current_line += 1
        window_text = "\n".join(window_lines)
        if count_tokens(window_text) >= MAX_CHUNK_TOKENS:
            chunks.append(
                Chunk(
                    content=window_text,
                    chunk_index=len(chunks),
                    token_count=count_tokens(window_text),
                    symbol_type="block",
                    start_line=window_start,
                    end_line=current_line,
                )
            )
            overlap = window_lines[-WINDOW_OVERLAP_LINES:]
            window_lines = list(overlap)
            window_start = current_line - len(overlap) + 1

    if window_lines:
        window_text = "\n".join(window_lines)
        if count_tokens(window_text) >= MIN_CHUNK_TOKENS or not chunks:
            chunks.append(
                Chunk(
                    content=window_text,
                    chunk_index=len(chunks),
                    token_count=count_tokens(window_text),
                    symbol_type="block",
                    start_line=window_start,
                    end_line=current_line,
                )
            )

    return chunks


def _split_oversized(chunks: list[Chunk]) -> list[Chunk]:
    """Any single symbol that is still too large (huge function) gets
    windowed internally so we never send unbounded context to the embedder."""
    result: list[Chunk] = []
    for chunk in chunks:
        if chunk.token_count <= MAX_CHUNK_TOKENS * 2:
            result.append(chunk)
            continue
        sub_chunks = _sliding_window(chunk.content)
        base_line = (chunk.start_line or 1) - 1
        for sub in sub_chunks:
            sub.symbol_name = chunk.symbol_name
            sub.symbol_type = chunk.symbol_type
            if sub.start_line is not None:
                sub.start_line += base_line
            if sub.end_line is not None:
                sub.end_line += base_line
            result.append(sub)
    for i, c in enumerate(result):
        c.chunk_index = i
    return result


def chunk_source_code(content: str, language: str) -> list[Chunk]:
    if not content.strip():
        return []

    if language == "python":
        return _chunk_python(content)

    if language in _SIGNATURE_PATTERNS:
        return _chunk_by_signature(content, language)

    if language in _STRUCTURED_TEXT_LANGUAGES:
        return _sliding_window(content)

    return _sliding_window(content)

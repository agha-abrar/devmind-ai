import tiktoken

_ENCODING_CACHE: dict[str, "tiktoken.Encoding"] = {}


def count_tokens(text: str, model: str = "cl100k_base") -> int:
    try:
        encoding = _ENCODING_CACHE.get(model)
        if encoding is None:
            try:
                encoding = tiktoken.encoding_for_model(model)
            except KeyError:
                encoding = tiktoken.get_encoding("cl100k_base")
            _ENCODING_CACHE[model] = encoding
        return len(encoding.encode(text, disallowed_special=()))
    except Exception:
        # Rough fallback: ~4 chars per token for English/code text
        return max(1, len(text) // 4)

from app.core.config import settings


def estimate_cost_usd(input_tokens: int, output_tokens: int) -> float:
    if settings.llm_input_price_per_1m_tokens <= 0 and settings.llm_output_price_per_1m_tokens <= 0:
        return 0.0
    input_cost = (input_tokens / 1_000_000) * settings.llm_input_price_per_1m_tokens
    output_cost = (output_tokens / 1_000_000) * settings.llm_output_price_per_1m_tokens
    return round(input_cost + output_cost, 6)

"""
Centralized application configuration.

All configuration is loaded from environment variables (via .env in local dev,
or real environment variables in production/containers). Nothing here should
ever contain a hard-coded secret.
"""
from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ---------- General ----------
    environment: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"

    # ---------- Database ----------
    database_url: str = Field(
        default="postgresql+asyncpg://devmind:devmind_local_password@localhost:5432/devmind"
    )
    database_url_sync: str = Field(
        default="postgresql+psycopg2://devmind:devmind_local_password@localhost:5432/devmind"
    )

    # ---------- Redis / Celery ----------
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # ---------- Auth ----------
    jwt_secret: str = Field(default="dev-only-insecure-secret-change-me")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30

    # ---------- LLM Provider ----------
    llm_provider: Literal["openai", "openai_compatible"] = "openai"
    llm_api_key: str = ""
    llm_model: str = "gpt-4o-mini"
    llm_base_url: str = "https://api.openai.com/v1"
    llm_request_timeout_seconds: int = 60
    # Cost estimation only — purely informational, does not affect billing.
    # Leave at 0 to disable cost display if you don't know your provider's rates.
    llm_input_price_per_1m_tokens: float = 0.0
    llm_output_price_per_1m_tokens: float = 0.0

    # ---------- Embeddings ----------
    embedding_provider: Literal["openai", "openai_compatible"] = "openai"
    embedding_api_key: str = ""
    embedding_model: str = "text-embedding-3-small"
    embedding_base_url: str = "https://api.openai.com/v1"
    embedding_dimensions: int = 1536

    # ---------- Reranking ----------
    reranker_provider: Literal["none", "openai_compatible", "cohere"] = "none"
    reranker_api_key: str = ""
    reranker_model: str = ""

    # ---------- GitHub ----------
    github_client_id: str = ""
    github_client_secret: str = ""
    github_default_token: str = ""

    # ---------- Uploads ----------
    upload_dir: str = "/data/uploads"
    max_upload_size_mb: int = 25

    # ---------- Rate limiting ----------
    rate_limit_chat_per_minute: int = 10
    rate_limit_ingestion_per_hour: int = 20

    # ---------- Seeding ----------
    enable_dev_seed: bool = False

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origins(self) -> list[str]:
        origins = {self.frontend_url}
        if not self.is_production:
            origins.update({"http://localhost:3000", "http://127.0.0.1:3000"})
        return list(origins)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

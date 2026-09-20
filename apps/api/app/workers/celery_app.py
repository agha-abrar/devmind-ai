from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "devmind",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.workers.tasks_repository", "app.workers.tasks_document"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    task_time_limit=60 * 30,  # 30 min hard limit for large repo indexing
    task_soft_time_limit=60 * 25,
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
)

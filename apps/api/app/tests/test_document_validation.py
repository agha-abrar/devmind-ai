import pytest
from httpx import AsyncClient


async def _create_project(client: AsyncClient, headers: dict) -> str:
    ws_response = await client.get("/api/v1/workspaces", headers=headers)
    workspace_id = ws_response.json()[0]["id"]
    response = await client.post(
        "/api/v1/projects",
        json={"workspace_id": workspace_id, "name": "Doc Test Project"},
        headers=headers,
    )
    return response.json()["id"]


@pytest.mark.asyncio
async def test_upload_unsupported_file_type_rejected(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)

    response = await client.post(
        f"/api/v1/projects/{project_id}/documents",
        files={"file": ("malware.exe", b"binary-content", "application/octet-stream")},
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "Unsupported file type" in response.json()["detail"]


@pytest.mark.asyncio
async def test_upload_empty_file_rejected(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)

    response = await client.post(
        f"/api/v1/projects/{project_id}/documents",
        files={"file": ("empty.txt", b"", "text/plain")},
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_upload_oversized_file_rejected(client: AsyncClient, auth_headers: dict, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "max_upload_size_mb", 1)
    project_id = await _create_project(client, auth_headers)

    too_big = b"x" * (2 * 1024 * 1024)
    response = await client.post(
        f"/api/v1/projects/{project_id}/documents",
        files={"file": ("big.txt", too_big, "text/plain")},
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "exceeds" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_upload_valid_text_file_succeeds_and_is_tracked(
    client: AsyncClient, auth_headers: dict, monkeypatch
):
    # Prevent the Celery task from actually being dispatched during tests —
    # we only assert on the synchronous upload/validation behavior here.
    from app.routes import documents as documents_route

    monkeypatch.setattr(documents_route.process_document_task, "delay", lambda *a, **k: None)

    project_id = await _create_project(client, auth_headers)
    response = await client.post(
        f"/api/v1/projects/{project_id}/documents",
        files={"file": ("readme.md", b"# Hello\n\nSome content here.", "text/markdown")},
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "uploaded"
    assert data["file_type"] == "md"

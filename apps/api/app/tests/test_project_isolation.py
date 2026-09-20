import pytest
from httpx import AsyncClient


async def _get_workspace_id(client: AsyncClient, headers: dict) -> str:
    response = await client.get("/api/v1/workspaces", headers=headers)
    assert response.status_code == 200
    workspaces = response.json()
    assert len(workspaces) >= 1
    return workspaces[0]["id"]


@pytest.mark.asyncio
async def test_create_and_get_project(client: AsyncClient, auth_headers: dict):
    workspace_id = await _get_workspace_id(client, auth_headers)

    create_response = await client.post(
        "/api/v1/projects",
        json={"workspace_id": workspace_id, "name": "My Project", "description": "A test project"},
        headers=auth_headers,
    )
    assert create_response.status_code == 201
    project = create_response.json()
    assert project["name"] == "My Project"

    get_response = await client.get(f"/api/v1/projects/{project['id']}", headers=auth_headers)
    assert get_response.status_code == 200
    detail = get_response.json()
    assert detail["stats"]["repositories"] == 0
    assert detail["stats"]["documents"] == 0


@pytest.mark.asyncio
async def test_user_cannot_access_another_users_project(
    client: AsyncClient, auth_headers: dict, second_user_auth_headers: dict
):
    workspace_id = await _get_workspace_id(client, auth_headers)
    create_response = await client.post(
        "/api/v1/projects",
        json={"workspace_id": workspace_id, "name": "Private Project"},
        headers=auth_headers,
    )
    project_id = create_response.json()["id"]

    # The second user should not be able to see or modify it — 404, not 403,
    # to avoid confirming the project's existence.
    get_response = await client.get(
        f"/api/v1/projects/{project_id}", headers=second_user_auth_headers
    )
    assert get_response.status_code == 404

    delete_response = await client.delete(
        f"/api/v1/projects/{project_id}", headers=second_user_auth_headers
    )
    assert delete_response.status_code == 404


@pytest.mark.asyncio
async def test_user_cannot_create_project_in_workspace_they_do_not_own(
    client: AsyncClient, auth_headers: dict, second_user_auth_headers: dict
):
    workspace_id = await _get_workspace_id(client, auth_headers)

    response = await client.post(
        "/api/v1/projects",
        json={"workspace_id": workspace_id, "name": "Intrusion Attempt"},
        headers=second_user_auth_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_projects_only_returns_own_projects(
    client: AsyncClient, auth_headers: dict, second_user_auth_headers: dict
):
    workspace_id = await _get_workspace_id(client, auth_headers)
    await client.post(
        "/api/v1/projects",
        json={"workspace_id": workspace_id, "name": "Owner Only Project"},
        headers=auth_headers,
    )

    response = await client.get("/api/v1/projects", headers=second_user_auth_headers)
    assert response.status_code == 200
    names = [p["name"] for p in response.json()]
    assert "Owner Only Project" not in names

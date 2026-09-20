import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_creates_user_and_returns_tokens(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": "alice@example.com", "password": "SecurePass123!", "full_name": "Alice"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["user"]["email"] == "alice@example.com"
    assert data["access_token"]
    assert data["refresh_token"]


@pytest.mark.asyncio
async def test_register_duplicate_email_rejected(client: AsyncClient):
    payload = {"email": "bob@example.com", "password": "SecurePass123!", "full_name": "Bob"}
    first = await client.post("/api/v1/auth/register", json=payload)
    assert first.status_code == 201

    second = await client.post("/api/v1/auth/register", json=payload)
    assert second.status_code == 409


@pytest.mark.asyncio
async def test_login_with_wrong_password_fails(client: AsyncClient):
    payload = {"email": "carol@example.com", "password": "SecurePass123!", "full_name": "Carol"}
    await client.post("/api/v1/auth/register", json=payload)

    response = await client.post(
        "/api/v1/auth/login", json={"email": "carol@example.com", "password": "WrongPassword!"}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_succeeds_with_correct_credentials(client: AsyncClient):
    payload = {"email": "dave@example.com", "password": "SecurePass123!", "full_name": "Dave"}
    await client.post("/api/v1/auth/register", json=payload)

    response = await client.post(
        "/api/v1/auth/login", json={"email": "dave@example.com", "password": "SecurePass123!"}
    )
    assert response.status_code == 200
    assert response.json()["user"]["email"] == "dave@example.com"


@pytest.mark.asyncio
async def test_me_requires_authentication(client: AsyncClient):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_current_user(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    assert "email" in response.json()


@pytest.mark.asyncio
async def test_invalid_token_is_rejected(client: AsyncClient):
    response = await client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert response.status_code == 401

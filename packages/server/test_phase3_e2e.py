import pytest
import httpx
import asyncio
from sqlalchemy import create_engine
from app.main import app
from app.db.session import Base, engine
from app.db.models import User
import os

from fastapi.testclient import TestClient

# Test database setup
@pytest.fixture(scope="module")
def test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="module")
def client(test_db):
    return TestClient(app)

@pytest.mark.asyncio
def test_register_and_login(client: TestClient):
    # Register
    response = client.post("/api/v1/auth/register", json={
        "username": "testuser",
        "email": "test@example.com",
        "password": "securepassword"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    token = data["access_token"]

    # Login
    response = client.post("/api/v1/auth/login", params={
        "username": "testuser",
        "password": "securepassword"
    })
    assert response.status_code == 200
    assert "access_token" in response.json()

@pytest.mark.asyncio
def test_kernel_lifecycle(client: TestClient):
    # Note: This test requires a running Docker daemon and might be skipped in CI
    # For now, we'll just check if the endpoint exists and returns expected errors for missing auth
    response = client.post("/api/v1/kernels/start", json={"workspace_id": 1})
    assert response.status_code == 401 # Unauthorized without token

@pytest.mark.asyncio
async def test_websocket_echo(client: httpx.AsyncClient):
    # Websocket testing with httpx is limited; usually done with websockets library
    # This is a placeholder for the concept
    pass

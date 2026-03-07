"""Authentication module — Supabase Magic Link auth via FastAPI."""

import os

from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SUPABASE_JWT_SECRET = os.environ["SUPABASE_JWT_SECRET"]
SERVER_URL = os.environ.get("SERVER_URL", "http://localhost:8765")

security = HTTPBearer()

_anon_client = None
_service_client = None


def get_anon_client():
    global _anon_client
    if _anon_client is None:
        _anon_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    return _anon_client


def get_service_client():
    global _service_client
    if _service_client is None:
        _service_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _service_client


def verify_token(token: str) -> dict:
    """Decode and verify a Supabase JWT. Returns the payload."""
    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> str:
    """FastAPI dependency — extracts user_id from Bearer token's sub claim."""
    payload = verify_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing sub claim")
    return user_id


def send_magic_link(email: str) -> None:
    """Send a magic link email via Supabase Auth OTP."""
    client = get_anon_client()
    client.auth.sign_in_with_otp(
        {"email": email, "options": {"email_redirect_to": f"{SERVER_URL}/api/auth/callback"}}
    )


def exchange_code_for_session(token_hash: str, type: str) -> dict:
    """Exchange a magic link token for a session (access + refresh tokens)."""
    client = get_anon_client()
    response = client.auth.verify_otp(
        {"token_hash": token_hash, "type": type}
    )
    return {
        "access_token": response.session.access_token,
        "refresh_token": response.session.refresh_token,
    }


def refresh_session(refresh_token: str) -> dict:
    """Refresh an expired session using a refresh token."""
    client = get_anon_client()
    response = client.auth._refresh_access_token(refresh_token)
    return {
        "access_token": response.session.access_token,
        "refresh_token": response.session.refresh_token,
    }

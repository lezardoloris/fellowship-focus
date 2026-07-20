import requests


class FellowshipApi:
    def __init__(self, api_url: str, token: str) -> None:
        self.api_url = api_url.rstrip("/")
        self.token = token

    def log_session(self, minutes: int, completed: bool, session_id: str | None = None) -> dict | None:
        if not self.token:
            return None
        try:
            payload: dict = {"token": self.token, "minutes": minutes, "completed": completed}
            if session_id:
                payload["sessionId"] = session_id
            r = requests.post(
                f"{self.api_url}/api/sessions",
                json=payload,
                timeout=10,
            )
            r.raise_for_status()
            return r.json()
        except Exception:
            return None

    def start_session(self) -> str | None:
        if not self.token:
            return None
        try:
            r = requests.post(
                f"{self.api_url}/api/sessions/start",
                json={"token": self.token},
                timeout=10,
            )
            r.raise_for_status()
            return r.json().get("sessionId")
        except Exception:
            return None

    def upload_proof(
        self,
        session_id: str,
        proof_type: str,
        privacy_tier: str,
        active_app: str,
        image_b64: str | None,
    ) -> bool:
        if not self.token:
            return False
        try:
            payload: dict = {
                "token": self.token,
                "sessionId": session_id,
                "proofType": proof_type,
                "privacyTier": privacy_tier,
                "activeApp": active_app,
            }
            if image_b64:
                payload["imageBase64"] = image_b64
            r = requests.post(f"{self.api_url}/api/proofs", json=payload, timeout=30)
            r.raise_for_status()
            return True
        except Exception:
            return False

    def get_fellowship(self, code: str) -> dict | None:
        try:
            r = requests.get(f"{self.api_url}/api/fellowship/{code}", timeout=10)
            r.raise_for_status()
            return r.json()
        except Exception:
            return None

    def get_habits(self) -> dict | None:
        if not self.token:
            return None
        try:
            r = requests.get(f"{self.api_url}/api/habits", params={"token": self.token}, timeout=10)
            r.raise_for_status()
            return r.json()
        except Exception:
            return None

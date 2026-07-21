import requests


class FellowshipApi:
    def __init__(self, api_url: str, token: str) -> None:
        self.api_url = api_url.rstrip("/")
        self.token = token

    def log_session(
        self, minutes: int, completed: bool, session_id: str | None = None, activity_score: int = 0
    ) -> dict | None:
        if not self.token:
            return None
        try:
            payload: dict = {
                "token": self.token,
                "minutes": minutes,
                "completed": completed,
                "activityScore": activity_score,
            }
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

    def bypass_blocker(self, session_id: str) -> dict | None:
        if not self.token:
            return None
        try:
            r = requests.post(
                f"{self.api_url}/api/sessions/bypass-blocker",
                json={"token": self.token, "sessionId": session_id},
                timeout=10,
            )
            r.raise_for_status()
            return r.json()
        except Exception:
            return None

    def upload_proof(
        self,
        session_id: str,
        proof_type: str,
        privacy_tier: str,
        active_app: str,
        image_b64: str | None,
        activity_score: int | None = None,
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
            if activity_score is not None:
                payload["activityScore"] = activity_score
            r = requests.post(f"{self.api_url}/api/proofs", json=payload, timeout=30)
            r.raise_for_status()
            return True
        except Exception:
            return False

    def sync_usage(
        self,
        work_seconds: int,
        distraction_seconds: int,
        personal_seconds: int,
        neutral_seconds: int,
        focus_score: int,
    ) -> bool:
        if not self.token:
            return False
        try:
            r = requests.post(
                f"{self.api_url}/api/usage",
                json={
                    "token": self.token,
                    "workSeconds": work_seconds,
                    "distractionSeconds": distraction_seconds,
                    "personalSeconds": personal_seconds,
                    "neutralSeconds": neutral_seconds,
                    "focusScore": focus_score,
                },
                timeout=10,
            )
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

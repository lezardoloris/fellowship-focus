import requests


class FellowshipApi:
    def __init__(self, api_url: str, token: str) -> None:
        self.api_url = api_url.rstrip("/")
        self.token = token

    def log_session(self, minutes: int, completed: bool) -> dict | None:
        if not self.token:
            return None
        try:
            r = requests.post(
                f"{self.api_url}/api/sessions",
                json={"token": self.token, "minutes": minutes, "completed": completed},
                timeout=10,
            )
            r.raise_for_status()
            return r.json()
        except Exception:
            return None

    def get_fellowship(self, code: str) -> dict | None:
        try:
            r = requests.get(f"{self.api_url}/api/fellowship/{code}", timeout=10)
            r.raise_for_status()
            return r.json()
        except Exception:
            return None

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    splunk_host: str = "localhost"
    splunk_port: int = 8089
    splunk_token: str = ""
    anthropic_api_key: str = ""
    poll_interval_seconds: int = 30
    db_path: str = "sankofa.db"

    model_config = {"env_file": ".env"}

settings = Settings()

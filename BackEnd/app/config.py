import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    SECRET_KEY: str = "super_secret_jwt_key_for_super_uce_doc_project_12345"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    DATABASE_URL: str = "sqlite:///./super_uce_doc.db"
    GROQ_API_KEY: str = ""
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    LOCAL_MODEL_NAME: str = "llama3.1"
    USE_LOCAL_LLM: bool = True
    TAVILY_API_KEY: str = ""

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()

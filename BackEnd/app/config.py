import os
from dotenv import dotenv_values

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(backend_dir, ".env")

def parse_bool(val: str, default: bool = False) -> bool:
    if val is None:
        return default
    return str(val).strip().lower() in ("true", "1", "yes", "on")

class Settings:
    @property
    def HOST(self) -> str:
        vals = dotenv_values(env_path)
        return vals.get("HOST") or os.getenv("HOST", "127.0.0.1")

    @property
    def PORT(self) -> int:
        vals = dotenv_values(env_path)
        return int(vals.get("PORT") or os.getenv("PORT", 8000))

    @property
    def SECRET_KEY(self) -> str:
        vals = dotenv_values(env_path)
        return vals.get("SECRET_KEY") or os.getenv("SECRET_KEY", "super_secret_jwt_key_for_super_uce_doc_project_12345")

    @property
    def ALGORITHM(self) -> str:
        vals = dotenv_values(env_path)
        return vals.get("ALGORITHM") or os.getenv("ALGORITHM", "HS256")

    @property
    def ACCESS_TOKEN_EXPIRE_MINUTES(self) -> int:
        vals = dotenv_values(env_path)
        return int(vals.get("ACCESS_TOKEN_EXPIRE_MINUTES") or os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 1440))

    @property
    def DATABASE_URL(self) -> str:
        vals = dotenv_values(env_path)
        return vals.get("DATABASE_URL") or os.getenv("DATABASE_URL", "sqlite:///./super_uce_doc.db")

    @property
    def OPENROUTER_API_KEY(self) -> str:
        vals = dotenv_values(env_path)
        return vals.get("OPENROUTER_API_KEY") or vals.get("GROQ_API_KEY") or os.getenv("OPENROUTER_API_KEY", "")

    @property
    def GOOGLE_API_KEY(self) -> str:
        vals = dotenv_values(env_path)
        return vals.get("GOOGLE_API_KEY") or os.getenv("GOOGLE_API_KEY", "")

    @property
    def OPENROUTER_MODEL(self) -> str:
        vals = dotenv_values(env_path)
        return vals.get("OPENROUTER_MODEL") or os.getenv("OPENROUTER_MODEL", "google/gemini-2.5-flash")

    @property
    def OLLAMA_BASE_URL(self) -> str:
        vals = dotenv_values(env_path)
        return vals.get("OLLAMA_BASE_URL") or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

    @property
    def LOCAL_MODEL_NAME(self) -> str:
        vals = dotenv_values(env_path)
        return vals.get("LOCAL_MODEL_NAME") or os.getenv("LOCAL_MODEL_NAME", "llama3.1")

    @property
    def USE_LOCAL_LLM(self) -> bool:
        vals = dotenv_values(env_path)
        raw_use_local = vals.get("USE_LOCAL_LLM") if "USE_LOCAL_LLM" in vals else os.getenv("USE_LOCAL_LLM")
        return parse_bool(raw_use_local, default=False)

    @property
    def TAVILY_API_KEY(self) -> str:
        vals = dotenv_values(env_path)
        return vals.get("TAVILY_API_KEY") or os.getenv("TAVILY_API_KEY", "")

    @property
    def SMTP_HOST(self) -> str:
        vals = dotenv_values(env_path)
        return vals.get("SMTP_HOST") or os.getenv("SMTP_HOST", "smtp.gmail.com")

    @property
    def SMTP_PORT(self) -> int:
        vals = dotenv_values(env_path)
        return int(vals.get("SMTP_PORT") or os.getenv("SMTP_PORT", 587))

    @property
    def SMTP_USER(self) -> str:
        vals = dotenv_values(env_path)
        return vals.get("SMTP_USER") or os.getenv("SMTP_USER", "")

    @property
    def SMTP_PASSWORD(self) -> str:
        vals = dotenv_values(env_path)
        return vals.get("SMTP_PASSWORD") or os.getenv("SMTP_PASSWORD", "")

settings = Settings()

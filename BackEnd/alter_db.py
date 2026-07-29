import os
import sys
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.database import engine, Base
from app import models
from sqlalchemy import text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def apply_migrations():
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE clinical_histories ADD COLUMN diagnostics VARCHAR;"))
            conn.execute(text("ALTER TABLE clinical_histories ADD COLUMN recommendations VARCHAR;"))
            conn.execute(text("ALTER TABLE clinical_histories ADD COLUMN prescriptions VARCHAR;"))
            conn.execute(text("ALTER TABLE clinical_histories ADD COLUMN metadata_json VARCHAR;"))
            conn.execute(text("ALTER TABLE clinical_histories ADD COLUMN embedding_ref VARCHAR;"))
            logger.info("clinical_histories: columnas añadidas exitosamente.")
        except Exception as e:
            logger.info(f"clinical_histories: columnas ya existen o hubo error (ignorando): {e}")

        try:
            conn.execute(text("ALTER TABLE chat_messages ADD COLUMN tokens_count INTEGER DEFAULT 0;"))
            conn.execute(text("ALTER TABLE chat_messages ADD COLUMN metadata_json VARCHAR;"))
            logger.info("chat_messages: columnas añadidas exitosamente.")
        except Exception as e:
            logger.info(f"chat_messages: columnas ya existen o hubo error (ignorando): {e}")

if __name__ == "__main__":
    apply_migrations()
    Base.metadata.create_all(bind=engine)
    print("Migración completada exitosamente.")

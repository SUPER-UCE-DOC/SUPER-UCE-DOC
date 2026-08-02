from app.database import engine
from sqlalchemy import text

with engine.begin() as conn:
    try:
        conn.execute(text("ALTER TABLE patients ADD COLUMN risk_status VARCHAR DEFAULT 'estable'"))
        print("Column risk_status added to patients table.")
    except Exception as e:
        print("Error:", e)

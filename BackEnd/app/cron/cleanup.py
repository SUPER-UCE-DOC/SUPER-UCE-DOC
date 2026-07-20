import sys
import os
import datetime

# Asegurar que el directorio raíz del BackEnd esté en el PYTHONPATH
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.database import SessionLocal
from app import models

def run_cleanup():
    print(f"[{datetime.datetime.now()}] Iniciando limpieza automática diaria de recetas vencidas...")
    db = SessionLocal()
    try:
        now = datetime.datetime.utcnow()
        # Buscar recetas activas cuyo plazo haya expirado
        expired_recipes = db.query(models.Prescription).filter(
            models.Prescription.status == "activa",
            models.Prescription.expires_at < now
        ).all()
        
        count = len(expired_recipes)
        for rx in expired_recipes:
            rx.status = "vencida"
            
        if count > 0:
            db.commit()
            print(f"[{datetime.datetime.now()}] Se actualizaron {count} recetas a estado 'vencida'.")
        else:
            print(f"[{datetime.datetime.now()}] No se encontraron recetas expiradas hoy.")
            
    except Exception as e:
        db.rollback()
        print(f"[{datetime.datetime.now()}] Error durante el cron job de limpieza: {e}")
    finally:
        db.close()
        print(f"[{datetime.datetime.now()}] Limpieza automática diaria finalizada.")

if __name__ == "__main__":
    run_cleanup()

from app.database import SessionLocal
from app.models import ClinicalHistory

def clean_fake_summaries():
    db = SessionLocal()
    try:
        # Buscar el texto específico del fallback
        fake_text = "SÍNTOMAS DETECTADOS: Cefalea (dolor de cabeza) persistente de 3 días de duración, mareos posturales al levantarse."
        
        # Eliminar todos los registros que contengan ese texto
        records = db.query(ClinicalHistory).filter(ClinicalHistory.summary_ia.like(f"%{fake_text}%")).all()
        for r in records:
            db.delete(r)
            
        db.commit()
        print(f"Exito: Se han eliminado {len(records)} resumenes clinicos hardcodeados/falsos de la base de datos.")
    except Exception as e:
        print(f"Error limpiando la base de datos: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    clean_fake_summaries()

import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models import (
    Prescription, ClinicalHistory, Appointment, SupplierOrder,
    ChatSession, ChatMessage, ConversationSummary, PatientMemory,
    DoctorPatientInvitation, DoctorPatientLink, PharmacyInventory
)

def clean_data():
    db = SessionLocal()
    try:
        print("Limpiando datos de la base de datos (conservando cuentas de usuario)...")
        
        deleted_messages = db.query(ChatMessage).delete()
        deleted_summaries = db.query(ConversationSummary).delete()
        deleted_sessions = db.query(ChatSession).delete()
        
        deleted_prescriptions = db.query(Prescription).delete()
        deleted_histories = db.query(ClinicalHistory).delete()
        deleted_appointments = db.query(Appointment).delete()
        
        deleted_orders = db.query(SupplierOrder).delete()
        deleted_memories = db.query(PatientMemory).delete()
        deleted_invitations = db.query(DoctorPatientInvitation).delete()
        deleted_links = db.query(DoctorPatientLink).delete()
        deleted_inventory = db.query(PharmacyInventory).delete()
        
        db.commit()
        print("¡Limpieza de datos completada con éxito!")
        print(f" - Citas eliminadas: {deleted_appointments}")
        print(f" - Recetas eliminadas: {deleted_prescriptions}")
        print(f" - Historiales clínicos eliminados: {deleted_histories}")
        print(f" - Sesiones de chat eliminadas: {deleted_sessions}")
        print(f" - Mensajes de chat eliminados: {deleted_messages}")
        print(f" - Invitaciones eliminadas: {deleted_invitations}")
        print(f" - Vínculos médico-paciente eliminados: {deleted_links}")
        print(f" - Pedidos a proveedor eliminados: {deleted_orders}")
        print(f" - Memorias de paciente eliminadas: {deleted_memories}")
        print(f" - Inventario de farmacia limpiado: {deleted_inventory}")
        print("[OK] Se conservaron todas las cuentas registradas (Usuarios, Pacientes, Medicos y Farmacias).")
    except Exception as e:
        db.rollback()
        print(f"Error al limpiar la base de datos: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    clean_data()

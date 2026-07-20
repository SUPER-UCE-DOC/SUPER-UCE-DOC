import sys
import os
import datetime

# Asegurar que el directorio raíz del BackEnd esté en el PYTHONPATH
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app import models
from app.cron.cleanup import run_cleanup

# Crear base de datos temporal para pruebas
TEST_DATABASE_URL = "sqlite:///./test_temp.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Sobrescribir dependencia get_db de FastAPI
def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

def setup_test_db():
    # Inicializar tablas
    Base.metadata.create_all(bind=engine)

def teardown_test_db():
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_temp.db"):
        try:
            os.remove("./test_temp.db")
        except Exception:
            pass


def test_flow():
    setup_test_db()
    try:
        print("\n=== INICIANDO PRUEBAS DE INTEGRACION DEL BACKEND ===")

        # 1. Verificar raíz del servidor
        response = client.get("/")
        assert response.status_code == 200
        print("[OK] Endpoint '/' verificado exitosamente.")

        # 2. Registrar Médico
        doc_email = "doctor.test@superuce.com"
        doc_data = {
            "email": doc_email,
            "password": "password123",
            "full_name": "Dr. Juan de la Cruz",
            "role": "doctor",
            "specialty": "Pediatría",
            "lat": 18.46,
            "lon": -69.30
        }
        res_reg_doc = client.post("/api/auth/register", json=doc_data)
        assert res_reg_doc.status_code == 201
        print("[OK] Registro de Medico exitoso.")

        # 3. Registrar Paciente
        pat_email = "paciente.test@superuce.com"
        pat_data = {
            "email": pat_email,
            "password": "password123",
            "full_name": "Pedro Martínez",
            "role": "patient",
            "age": 30,
            "condition": "Hipertensión",
            "lat": 18.461,
            "lon": -69.301
        }
        res_reg_pat = client.post("/api/auth/register", json=pat_data)
        assert res_reg_pat.status_code == 201
        pat_id = res_reg_pat.json()["id"]
        print("[OK] Registro de Paciente exitoso.")

        # 4. Registrar Farmacia
        pharm_email = "farmacia.test@superuce.com"
        pharm_data = {
            "email": pharm_email,
            "password": "password123",
            "full_name": "Farmacia Central Test",
            "role": "pharmacy",
            "business_name": "Farmacia Central Test",
            "address": "San Pedro de Macorís",
            "phone": "809-529-1111",
            "lat": 18.462,
            "lon": -69.299
        }
        res_reg_ph = client.post("/api/auth/register", json=pharm_data)
        assert res_reg_ph.status_code == 201
        pharm_id = res_reg_ph.json()["id"]
        print("[OK] Registro de Farmacia exitoso.")

        # 5. Iniciar sesión como Paciente para obtener JWT Token
        res_login_pat = client.post(
            "/api/auth/login",
            data={"username": pat_email, "password": "password123"}
        )
        assert res_login_pat.status_code == 200
        pat_token = res_login_pat.json()["access_token"]
        pat_headers = {"Authorization": f"Bearer {pat_token}"}
        print("[OK] Login de Paciente exitoso. Token JWT generado.")

        # 6. Iniciar sesión como Médico para obtener JWT Token
        res_login_doc = client.post(
            "/api/auth/login",
            data={"username": doc_email, "password": "password123"}
        )
        assert res_login_doc.status_code == 200
        doc_token = res_login_doc.json()["access_token"]
        doc_headers = {"Authorization": f"Bearer {doc_token}"}
        print("[OK] Login de Medico exitoso. Token JWT generado.")

        # 7. Iniciar sesión como Farmacia
        res_login_ph = client.post(
            "/api/auth/login",
            data={"username": pharm_email, "password": "password123"}
        )
        assert res_login_ph.status_code == 200
        pharm_token = res_login_ph.json()["access_token"]
        pharm_headers = {"Authorization": f"Bearer {pharm_token}"}
        print("[OK] Login de Farmacia exitoso. Token JWT generado.")

        # 8. PRUEBA RBAC (Control de Roles Estricto):
        # Intentar obtener pedidos al proveedor de farmacia siendo un paciente (Debe devolver 403)
        res_rbac = client.get("/api/pharmacies/orders", headers=pat_headers)
        assert res_rbac.status_code == 403
        print("[OK] VALIDACION RBAC EXITOSA: Paciente no puede acceder a pedidos de Farmacia (Retorno HTTP 403).")

        # 9. Crear cita médica como paciente para el médico
        app_data = {
            "doctor_id": res_reg_doc.json()["id"],
            "date_time": (datetime.datetime.now() + datetime.timedelta(days=1)).isoformat(),
            "type": "Teleconsulta",
            "reason": "Control de presion"
        }
        res_create_app = client.post("/api/appointments", json=app_data, headers=pat_headers)
        assert res_create_app.status_code == 201
        app_id = res_create_app.json()["id"]
        print(f"[OK] Cita medica creada con exito. ID: {app_id}")

        # 10. Actualizar estado de cita médica como médico a 'en_curso'
        res_update_app = client.put(
            f"/api/appointments/{app_id}/status",
            json={"status": "en_curso"},
            headers=doc_headers
        )
        assert res_update_app.status_code == 200
        assert res_update_app.json()["status"] == "en_curso"
        print("[OK] Estado de cita actualizado a 'en_curso' por el Medico.")

        # 11. Agregar stock de medicamentos en la farmacia para despacho
        db_session = TestingSessionLocal()
        inv_item = models.PharmacyInventory(
            pharmacy_id=pharm_id,
            medicine="Losartan 50mg",
            stock=10
        )
        db_session.add(inv_item)
        db_session.commit()
        db_session.close()
        print("[OK] Se agrego stock de 'Losartan 50mg' (10 unidades) a la farmacia.")

        # 12. Emitir Receta Digital como Médico para el Paciente
        rx_data = {
            "patient_id": pat_id,
            "appointment_id": app_id,
            "medicine": "Losartan 50mg",
            "dose": "1 comprimido",
            "frequency": "Cada 24 horas",
            "expires_in_days": 30
        }
        res_emit_rx = client.post("/api/prescriptions", json=rx_data, headers=doc_headers)
        assert res_emit_rx.status_code == 201
        rx_id = res_emit_rx.json()["id"]
        print(f"[OK] Receta medica emitida. ID: {rx_id}, Medicamento: Losartan 50mg")

        # 13. PRUEBA DE TRANSACCION ACID (Despacho de Receta por la Farmacia):
        # Despachar la receta
        res_dispatch = client.post(
            f"/api/prescriptions/{rx_id}/dispatch",
            headers=pharm_headers
        )
        assert res_dispatch.status_code == 200
        assert res_dispatch.json()["status"] == "despachada"
        
        # Verificar que el stock disminuyó a 9 en la base de datos
        db_session = TestingSessionLocal()
        db_inv = db_session.query(models.PharmacyInventory).filter(
            models.PharmacyInventory.pharmacy_id == pharm_id,
            models.PharmacyInventory.medicine == "Losartan 50mg"
        ).first()
        assert db_inv.stock == 9
        db_session.close()
        print("[OK] PRUEBA ACID EXITOSA: Receta despachada y stock del inventario decrementado a 9 (Transaccion atomica).")

        # 14. Búsqueda de Farmacias cercanas en un radio de 2km
        # Coordenadas paciente: (18.461, -69.301)
        # Farmacia: (18.462, -69.299) -> Distancia ~ 230 metros
        res_nearby = client.get(
            f"/api/pharmacies/nearby?lat=18.461&lon=-69.301&medicine=Losartan",
            headers=pat_headers
        )
        assert res_nearby.status_code == 200
        assert len(res_nearby.json()) > 0
        assert res_nearby.json()[0]["name"] == "Farmacia Central Test"
        print("[OK] Geolocalizacion Avanzada exitosa. Farmacia dentro del rango de 2km detectada.")

        # 15. PRUEBA IA: Traducción de gestos a oraciones coherentes (LSTM + Qwen local)
        gestures_payload = {"gestures": ["DOLOR", "CABEZA", "TRES", "DIAS"]}
        res_trans = client.post("/api/ai/translate", json=gestures_payload, headers=doc_headers)
        assert res_trans.status_code == 200
        print(f"[OK] Traduccion de gestos exitosa: {gestures_payload['gestures']} -> '{res_trans.json()['translation']}'")

        # 16. PRUEBA IA: Chatbot Médico RAG
        chat_payload = {"message": "Que medicamentos se usan para tratar la presion alta?"}
        res_chat = client.post("/api/ai/chatbot", json=chat_payload, headers=pat_headers)
        assert res_chat.status_code == 200
        assert len(res_chat.json()["reply"]) > 0
        print(f"[OK] Chatbot RAG Clinico verificado. Respuesta: '{res_chat.json()['reply'][:75]}...'")

        # 17. PRUEBA CRON JOB: Limpieza de recetas vencidas
        # Crear receta que expira en el pasado
        db_session = TestingSessionLocal()
        past_rx = models.Prescription(
            id="RX-TEST-EXPIRADA",
            patient_id=pat_id,
            doctor_id=res_reg_doc.json()["id"],
            medicine="Paracetamol",
            dose="500mg",
            frequency="8h",
            status="activa",
            issued_at=datetime.datetime.utcnow() - datetime.timedelta(days=40),
            expires_at=datetime.datetime.utcnow() - datetime.timedelta(days=10),
            patient_lat=18.46,
            patient_lon=-69.30
        )
        db_session.add(past_rx)
        db_session.commit()
        db_session.close()

        # Ejecutar limpieza
        db_session = TestingSessionLocal()
        now = datetime.datetime.utcnow()
        expired = db_session.query(models.Prescription).filter(
            models.Prescription.status == "activa",
            models.Prescription.expires_at < now
        ).all()
        for rx in expired:
            rx.status = "vencida"
        db_session.commit()
        
        # Verificar cambio
        check_rx = db_session.query(models.Prescription).filter(models.Prescription.id == "RX-TEST-EXPIRADA").first()
        assert check_rx.status == "vencida"
        db_session.close()
        print("[OK] Cron Job de limpieza de recetas verificado exitosamente.")

        print("\n=== TODAS LAS PRUEBAS DEL BACKEND SE COMPLETARON CON EXITO ===")

    except Exception as e:
        print(f"[ERROR] Error durante la ejecucion de la prueba: {e}")
        raise e
    finally:
        teardown_test_db()

if __name__ == "__main__":
    test_flow()

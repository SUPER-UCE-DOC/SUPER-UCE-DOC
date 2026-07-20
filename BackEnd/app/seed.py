import sys
import os
import datetime
from sqlalchemy.orm import Session

# Asegurar que el directorio raíz del BackEnd esté en el PYTHONPATH
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, engine, Base
from app import models
from app.routers.auth import get_password_hash

def seed_database():
    print("Iniciando la siembra (seeding) de la base de datos...")
    
    # Asegurar que las tablas existan
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # 1. Crear usuarios y perfiles de Médicos si no existen
        doctors_data = [
            {"email": "carlos.mendoza@superuce.com", "name": "Dr. Carlos Mendoza", "specialty": "Cardiología", "lat": 18.465, "lon": -69.300},
            {"email": "ana.torres@superuce.com", "name": "Dra. Ana Torres", "specialty": "Pediatría", "lat": 18.466, "lon": -69.302},
            {"email": "dr.paredes@superuce.com", "name": "Dr. Paredes", "specialty": "Medicina General", "lat": 18.464, "lon": -69.298}
        ]
        
        for doc in doctors_data:
            existing = db.query(models.User).filter(models.User.email == doc["email"]).first()
            if not existing:
                user = models.User(
                    email=doc["email"],
                    hashed_password=get_password_hash("doctor123"),
                    role="doctor",
                    full_name=doc["name"]
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                
                profile = models.Doctor(
                    id=user.id,
                    specialty=doc["specialty"],
                    room_state="libre",
                    lat=doc["lat"],
                    lon=doc["lon"]
                )
                db.add(profile)
                db.commit()
                print(f"Médico creado: {doc['name']}")

        # 2. Crear usuarios y perfiles de Pacientes si no existen
        patients_data = [
            {"email": "maria.lopez@superuce.com", "name": "María López", "age": 45, "condition": "Hipertensión Grado 1", "lat": 18.463, "lon": -69.304},
            {"email": "juan.paredes@superuce.com", "name": "Juan Paredes", "age": 62, "condition": "Diabetes Tipo 2", "lat": 18.467, "lon": -69.299},
            {"email": "rosa.chavez@superuce.com", "name": "Rosa Chávez", "age": 38, "condition": "Ansiedad Generalizada", "lat": 18.469, "lon": -69.305},
            {"email": "carlos.vega@superuce.com", "name": "Carlos Vega", "age": 55, "condition": "Insuficiencia Cardíaca", "lat": 18.462, "lon": -69.296},
            {"email": "ana.morales@superuce.com", "name": "Ana Morales", "age": 29, "condition": "Control prenatal semana 28", "lat": 18.459, "lon": -69.308}
        ]

        for pat in patients_data:
            existing = db.query(models.User).filter(models.User.email == pat["email"]).first()
            if not existing:
                user = models.User(
                    email=pat["email"],
                    hashed_password=get_password_hash("paciente123"),
                    role="patient",
                    full_name=pat["name"]
                )
                db.add(user)
                db.commit()
                db.refresh(user)

                profile = models.Patient(
                    id=user.id,
                    age=pat["age"],
                    condition=pat["condition"],
                    avatar=pat["name"][:2].upper(),
                    lat=pat["lat"],
                    lon=pat["lon"]
                )
                db.add(profile)
                db.commit()
                print(f"Paciente creado: {pat['name']}")

        # 3. Crear usuarios y perfiles de Farmacias si no existen
        pharmacies_data = [
            {"email": "suizaplus@superuce.com", "name": "Farmacia Suiza Plus", "address": "C/ Sánchez #12, Sector El Café, SPM", "phone": "809-246-5599", "lat": 18.467, "lon": -69.301},
            {"email": "carol@superuce.com", "name": "Farmacia Carol", "address": "Av. Circunvalación #14, San Pedro de Macorís", "phone": "809-246-0011", "lat": 18.463, "lon": -69.303},
            {"email": "sanjuan@superuce.com", "name": "Farmacia San Juan", "address": "C/ Duarte #87, esq. Pedro A. Lluberes", "phone": "809-529-3344", "lat": 18.469, "lon": -69.297}
        ]

        for ph in pharmacies_data:
            existing = db.query(models.User).filter(models.User.email == ph["email"]).first()
            if not existing:
                user = models.User(
                    email=ph["email"],
                    hashed_password=get_password_hash("farmacia123"),
                    role="pharmacy",
                    full_name=ph["name"]
                )
                db.add(user)
                db.commit()
                db.refresh(user)

                profile = models.Pharmacy(
                    id=user.id,
                    business_name=ph["name"],
                    lat=ph["lat"],
                    lon=ph["lon"],
                    address=ph["address"],
                    phone=ph["phone"]
                )
                db.add(profile)
                db.commit()
                print(f"Farmacia creada: {ph['name']}")

                # Agregar stock de medicamentos inicial para el inventario de la farmacia
                medicines = [
                    ("Sertralina 50mg", 100),
                    ("Losartán 25mg", 120),
                    ("Metformina 500mg", 200),
                    ("Furosemida 40mg", 80),
                    ("Ácido Fólico 5mg", 150),
                    ("Atorvastatina 20mg", 130)
                ]
                for med_name, stock_qty in medicines:
                    inv = models.PharmacyInventory(
                        pharmacy_id=user.id,
                        medicine=med_name,
                        stock=stock_qty
                    )
                    db.add(inv)
                db.commit()
                print(f"  -> Inventario inicial sembrado para {ph['name']}")

        # 4. Crear citas médicas de prueba si no existen
        # Enlazar Dr. Carlos Mendoza (id=1 o similar) con Pacientes
        doc_mendoza = db.query(models.Doctor).join(models.User).filter(models.User.email == "carlos.mendoza@superuce.com").first()
        pat_rosa = db.query(models.Patient).join(models.User).filter(models.User.email == "rosa.chavez@superuce.com").first()
        pat_maria = db.query(models.Patient).join(models.User).filter(models.User.email == "maria.lopez@superuce.com").first()

        if doc_mendoza and pat_rosa:
            existing_app = db.query(models.Appointment).filter(
                models.Appointment.patient_id == pat_rosa.id,
                models.Appointment.doctor_id == doc_mendoza.id
            ).first()
            if not existing_app:
                # Cita de hoy para la sala de espera
                app1 = models.Appointment(
                    patient_id=pat_rosa.id,
                    doctor_id=doc_mendoza.id,
                    date_time=datetime.datetime.now(),
                    status="pendiente",
                    type="Teleconsulta",
                    reason="Seguimiento de ansiedad e hipertensión"
                )
                db.add(app1)
                
                # Cita completada
                app2 = models.Appointment(
                    patient_id=pat_maria.id,
                    doctor_id=doc_mendoza.id,
                    date_time=datetime.datetime.now() - datetime.timedelta(hours=2),
                    status="completada",
                    type="Teleconsulta",
                    reason="Control de hipertensión recurrente"
                )
                db.add(app2)
                db.commit()
                print("Citas de prueba creadas con éxito.")

        # 5. Crear algunas recetas médicas activas de prueba
        if pat_rosa and doc_mendoza:
            existing_rx = db.query(models.Prescription).filter(models.Prescription.patient_id == pat_rosa.id).first()
            if not existing_rx:
                rx1 = models.Prescription(
                    id="RX-2026-0841",
                    appointment_id=None,
                    patient_id=pat_rosa.id,
                    doctor_id=doc_mendoza.id,
                    medicine="Sertralina 50mg",
                    dose="30 comprimidos",
                    frequency="1 comprimido al día",
                    status="activa",
                    issued_at=datetime.datetime.utcnow(),
                    expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=30),
                    patient_lat=pat_rosa.lat,
                    patient_lon=pat_rosa.lon
                )
                db.add(rx1)
                
                rx2 = models.Prescription(
                    id="RX-2026-0839",
                    appointment_id=None,
                    patient_id=pat_maria.id,
                    doctor_id=doc_mendoza.id,
                    medicine="Losartán 25mg",
                    dose="30 comprimidos",
                    frequency="1 comprimido por la mañana",
                    status="activa",
                    issued_at=datetime.datetime.utcnow(),
                    expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=30),
                    patient_lat=pat_maria.lat,
                    patient_lon=pat_maria.lon
                )
                db.add(rx2)
                db.commit()
                print("Recetas de prueba creadas.")

        print("Base de datos sembrada con éxito.")

    except Exception as e:
        db.rollback()
        print(f"Error sembrando base de datos: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()

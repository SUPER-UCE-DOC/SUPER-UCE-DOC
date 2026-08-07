import datetime
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False)  # "patient", "doctor", "pharmacy"
    full_name = Column(String, nullable=False)
    avatar = Column(String, nullable=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    patient_profile = relationship("Patient", back_populates="user", uselist=False, cascade="all, delete-orphan")
    doctor_profile = relationship("Doctor", back_populates="user", uselist=False, cascade="all, delete-orphan")
    pharmacy_profile = relationship("Pharmacy", back_populates="user", uselist=False, cascade="all, delete-orphan")


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    age = Column(Integer, nullable=False)
    condition = Column(String, nullable=True)
    avatar = Column(String, nullable=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    risk_status = Column(String, default="estable")

    # Relationships
    user = relationship("User", back_populates="patient_profile")
    appointments = relationship("Appointment", back_populates="patient", cascade="all, delete-orphan")
    prescriptions = relationship("Prescription", back_populates="patient", cascade="all, delete-orphan")
    clinical_histories = relationship("ClinicalHistory", back_populates="patient", cascade="all, delete-orphan")


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    specialty = Column(String, nullable=False)
    exequatur = Column(String, nullable=True)  # Número de Exequátur oficial de Salud Pública
    id_card = Column(String, nullable=True)    # Cédula de Identidad / DNI
    phone = Column(String, nullable=True)      # Teléfono de contacto clínico
    room_state = Column(String, default="libre")  # "libre", "esperando", "en_consulta"
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    
    # Settings and availability
    firma = Column(String, nullable=True)
    available_days = Column(String, default="L,M,X,J,V")
    start_time = Column(String, default="08:00")
    end_time = Column(String, default="17:00")

    # Relationships
    user = relationship("User", back_populates="doctor_profile")
    appointments = relationship("Appointment", back_populates="doctor", cascade="all, delete-orphan")
    prescriptions = relationship("Prescription", back_populates="doctor", cascade="all, delete-orphan")
    clinical_histories = relationship("ClinicalHistory", back_populates="doctor")


class Pharmacy(Base):
    __tablename__ = "pharmacies"

    id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    business_name = Column(String, nullable=False)
    rnc = Column(String, nullable=True)             # Registro Nacional de Contribuyente (RNC)
    health_license = Column(String, nullable=True)  # Licencia Sanitaria de Habilitación MISPAS
    pharmacist_name = Column(String, nullable=True) # Farmacéutico Regente Titular
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    address = Column(String, nullable=False)
    google_place_id = Column(String, nullable=True, unique=True, index=True)
    phone = Column(String, nullable=False)

    # Relationships
    user = relationship("User", back_populates="pharmacy_profile")
    inventory_items = relationship("PharmacyInventory", back_populates="pharmacy", cascade="all, delete-orphan")


class PharmacyInventory(Base):
    __tablename__ = "pharmacy_inventory"

    id = Column(Integer, primary_key=True, index=True)
    pharmacy_id = Column(Integer, ForeignKey("pharmacies.id"), nullable=False)
    medicine = Column(String, nullable=False, index=True)
    stock = Column(Integer, default=0)

    # Relationships
    pharmacy = relationship("Pharmacy", back_populates="inventory_items")


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    date_time = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String, default="pendiente")  # "pendiente", "en_curso", "completada"
    type = Column(String, nullable=False)  # "Teleconsulta", "Presencial", "Seguimiento"
    reason = Column(String, nullable=True)
    real_start_time = Column(DateTime, nullable=True)
    real_end_time = Column(DateTime, nullable=True)

    # Relationships
    patient = relationship("Patient", back_populates="appointments")
    doctor = relationship("Doctor", back_populates="appointments")
    prescriptions = relationship("Prescription", back_populates="appointment")


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(String, primary_key=True, index=True)  # Format e.g., RX-2026-0841
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    pharmacy_id = Column(Integer, ForeignKey("pharmacies.id"), nullable=True)
    medicine = Column(String, nullable=False)
    dose = Column(String, nullable=False)
    frequency = Column(String, nullable=False)
    status = Column(String, default="activa")  # "activa", "vencida", "despachada"
    issued_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    patient_lat = Column(Float, nullable=False)
    patient_lon = Column(Float, nullable=False)

    # Relationships
    appointment = relationship("Appointment", back_populates="prescriptions")
    patient = relationship("Patient", back_populates="prescriptions")
    doctor = relationship("Doctor", back_populates="prescriptions")


class ClinicalHistory(Base):
    __tablename__ = "clinical_histories"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    date = Column(DateTime, default=datetime.datetime.utcnow)
    gestures_detected = Column(String, nullable=True)  # Stored as text / comma-separated
    translation_text = Column(String, nullable=True)
    summary_ia = Column(String, nullable=True)
    
    # Extensiones de la Memoria Híbrida (Teleconsultation History)
    diagnostics = Column(String, nullable=True)
    recommendations = Column(String, nullable=True)
    prescriptions = Column(String, nullable=True)
    metadata_json = Column(String, nullable=True) # Estructura JSON para almacenar metadatos extra
    embedding_ref = Column(String, nullable=True) # Referencia al UUID del índice vectorial independiente

    # Relationships
    patient = relationship("Patient", back_populates="clinical_histories")
    doctor = relationship("Doctor", back_populates="clinical_histories")

class SupplierOrder(Base):
    __tablename__ = "supplier_orders"

    id = Column(String, primary_key=True, index=True)  # Format e.g. ORD-9921
    pharmacy_id = Column(Integer, ForeignKey("pharmacies.id"), nullable=False)
    supplier = Column(String, nullable=False)
    items = Column(String, nullable=False)  # Comma separated or JSON string
    total = Column(Float, nullable=False)
    estimated_delivery = Column(String, nullable=False)
    status = Column(String, default="borrador")  # "borrador", "enviado", "transito", "recibido"
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, default="Nueva consulta médica")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(String, nullable=False)
    tokens_count = Column(Integer, default=0)
    metadata_json = Column(String, nullable=True) # Conversation ID temporal, adjuntos, etc.
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    session = relationship("ChatSession", back_populates="messages")


class ConversationSummary(Base):
    __tablename__ = "conversation_summaries"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    summary_text = Column(String, nullable=False)
    last_message_id_included = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    session = relationship("ChatSession")


class PatientMemory(Base):
    __tablename__ = "patient_memories"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    memory_type = Column(String, nullable=False)  # ej. alergia, enfermedad, medicamento, antecedente, cirugia
    value = Column(String, nullable=False)
    confidence = Column(Float, default=1.0)
    origin = Column(String, nullable=False)       # paciente, inferencia, documento, doctor, teleconsulta
    status = Column(String, default="activo")     # activo / inactivo
    embedding_ref = Column(String, nullable=True) # Referencia al índice vectorial
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    patient = relationship("Patient")


class DoctorPatientInvitation(Base):
    __tablename__ = "doctor_patient_invitations"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    status = Column(String, default="pending")  # "pending", "accepted", "rejected"
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # We could add relationships here, but often manual querying is enough
    doctor = relationship("Doctor", foreign_keys=[doctor_id])
    patient = relationship("Patient", foreign_keys=[patient_id])


class DoctorPatientLink(Base):
    __tablename__ = "doctor_patient_links"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    linked_at = Column(DateTime, default=datetime.datetime.utcnow)

    doctor = relationship("Doctor", foreign_keys=[doctor_id])
    patient = relationship("Patient", foreign_keys=[patient_id])


class EmailVerificationCode(Base):
    __tablename__ = "email_verification_codes"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True, nullable=False)
    code = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


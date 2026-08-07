import datetime
from pydantic import BaseModel, EmailStr
from typing import List, Optional

# --- Token Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str
    is_new: Optional[bool] = False

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None


class GoogleLoginRequest(BaseModel):
    token: str
    role: str
    is_creation_step: Optional[bool] = False
    full_name: Optional[str] = None
    specialty: Optional[str] = None
    exequatur: Optional[str] = None
    id_card: Optional[str] = None
    age: Optional[int] = None
    condition: Optional[str] = None
    business_name: Optional[str] = None
    rnc: Optional[str] = None
    health_license: Optional[str] = None
    pharmacist_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None


# --- User Schemas ---
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str  # "patient", "doctor", "pharmacy"

class UserCreate(UserBase):
    password: str
    # Details specific to roles
    age: Optional[int] = None
    condition: Optional[str] = None
    specialty: Optional[str] = None
    exequatur: Optional[str] = None
    id_card: Optional[str] = None
    business_name: Optional[str] = None
    rnc: Optional[str] = None
    health_license: Optional[str] = None
    pharmacist_name: Optional[str] = None
    address: Optional[str] = None
    google_place_id: Optional[str] = None
    phone: Optional[str] = None
    lat: float = 18.46
    lon: float = -69.30

class UserResponse(UserBase):
    id: int
    avatar: Optional[str] = None
    created_at: datetime.datetime
    is_verified: bool = False
    requires_verification: Optional[bool] = False
    # settings
    available_days: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    firma: Optional[str] = None

    class Config:
        from_attributes = True

class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str

class VerifyCodeResponse(BaseModel):
    message: str
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"
    user: Optional[UserResponse] = None

class UserSettingsUpdate(BaseModel):
    available_days: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    firma: Optional[str] = None

class AvatarUpdateRequest(BaseModel):
    avatar_url: str


# --- Patient Profile ---
class PatientResponse(BaseModel):
    id: int
    age: int
    condition: Optional[str]
    avatar: Optional[str]
    lat: float
    lon: float
    full_name: str
    email: str

    class Config:
        from_attributes = True


# --- Doctor Profile ---
class DoctorResponse(BaseModel):
    id: int
    specialty: str
    room_state: str
    lat: float
    lon: float
    full_name: str
    email: str
    avatar: Optional[str] = None
    available_days: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    firma: Optional[str] = None

    class Config:
        from_attributes = True


# --- Pharmacy Profile ---
class PharmacyResponse(BaseModel):
    id: int
    business_name: str
    lat: float
    lon: float
    address: str
    google_place_id: Optional[str] = None
    phone: str
    full_name: str
    email: str

    class Config:
        from_attributes = True


# --- Pharmacy Inventory ---
class InventoryItemBase(BaseModel):
    medicine: str
    stock: int

class InventoryItemCreate(InventoryItemBase):
    pass

class InventoryItemResponse(InventoryItemBase):
    id: int
    pharmacy_id: int

    class Config:
        from_attributes = True


# --- Appointments ---
class AppointmentCreate(BaseModel):
    doctor_id: Optional[int] = None
    patient_id: Optional[int] = None
    date_time: datetime.datetime
    type: str = "Teleconsulta"  # "Teleconsulta", "Presencial", "Seguimiento"
    reason: Optional[str] = None

class AppointmentStatusUpdate(BaseModel):
    status: str  # "pendiente", "en_curso", "completada"

class AppointmentResponse(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    date_time: datetime.datetime
    status: str
    type: str
    reason: Optional[str]
    patient_name: str
    doctor_name: str
    doctor_specialty: Optional[str] = None
    patient_avatar: Optional[str] = None
    doctor_avatar: Optional[str] = None
    real_start_time: Optional[datetime.datetime] = None
    real_end_time: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True


# --- Prescriptions ---
class PrescriptionCreate(BaseModel):
    patient_id: int  # The patient to issue the recipe to
    appointment_id: Optional[int] = None
    medicine: str
    dose: str
    frequency: str
    expires_in_days: int = 30
    expires_at_date: Optional[str] = None

class PrescriptionResponse(BaseModel):
    id: str
    appointment_id: Optional[int]
    patient_id: int
    pharmacy_id: Optional[int] = None
    patient_name: str
    doctor_id: int
    doctor_name: str
    medicine: str
    dose: str
    frequency: str
    status: str
    issued_at: datetime.datetime
    expires_at: datetime.datetime
    patient_lat: float
    patient_lon: float
    pharmacy_lat: Optional[float] = None
    pharmacy_lon: Optional[float] = None

    class Config:
        from_attributes = True

class PrescriptionAssign(BaseModel):
    pharmacy_id: int


# --- Supplier Orders ---
class SupplierOrderCreate(BaseModel):
    supplier: str
    items: List[str]
    total: float
    estimated_delivery: str

class SupplierOrderStatusUpdate(BaseModel):
    status: str  # "borrador", "enviado", "transito", "recibido"

class SupplierOrderResponse(BaseModel):
    id: str
    pharmacy_id: int
    supplier: str
    items: str
    total: float
    estimated_delivery: str
    status: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# --- AI Translation & Chatbot ---
class TranslationRequest(BaseModel):
    gestures: List[str]

class TranslationResponse(BaseModel):
    original_gestures: List[str]
    translation: str

class SummarizeRequest(BaseModel):
    appointment_id: int
    conversation_transcript: str
    clinical_notes: Optional[str] = None

class SummarizeResponse(BaseModel):
    summary: str

class ChatMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# --- Invitations ---
class InvitationCreate(BaseModel):
    patient_id: int

class InvitationResponse(BaseModel):
    id: int
    doctor_id: int
    patient_id: int
    status: str
    created_at: datetime.datetime
    
    # We will include doctor details for the patient to see
    doctor_name: Optional[str] = None
    doctor_avatar: Optional[str] = None
    doctor_specialty: Optional[str] = None

    class Config:
        from_attributes = True

class PatientSearchResponse(BaseModel):
    id: int
    full_name: str
    email: str
    avatar: Optional[str] = None
    age: Optional[int] = None
    status: Optional[str] = "none"  # "none", "pending", "accepted"

    class Config:
        from_attributes = True

class ChatSessionResponse(BaseModel):
    id: int
    title: str
    created_at: datetime.datetime
    messages: Optional[List[ChatMessageResponse]] = None

    class Config:
        from_attributes = True

class ChatbotRequest(BaseModel):
    message: str
    session_id: Optional[int] = None
    chat_history: Optional[List[dict]] = None
    attached_doc_ids: Optional[List[str]] = None

class ChatbotResponse(BaseModel):
    reply: str
    sources: Optional[List[str]] = None
    session_title: Optional[str] = None

class SpeechToTextRequest(BaseModel):
    audio_base64: str
    audio_format: Optional[str] = "webm"
    session_id: Optional[int] = None

class SpeechToTextResponse(BaseModel):
    transcription: str

class DocumentUploadResponse(BaseModel):
    doc_id: str
    filename: str
    doc_type: str
    pages_count: int
    chunks_count: int
    status: str
    hash: str


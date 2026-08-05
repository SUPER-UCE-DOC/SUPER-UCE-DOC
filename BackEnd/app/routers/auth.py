import datetime
import bcrypt
import urllib.request
import json
import random
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from typing import List

from app.database import get_db
from app import models, schemas
from app.config import settings
from app.services.email_service import email_service

router = APIRouter(prefix="/api/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        role: str = payload.get("role")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: models.User = Depends(get_current_user)):
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acceso Denegado: Su rol '{current_user.role}' no tiene permisos para esta acción."
            )
        return current_user


@router.post("/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    db_user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La dirección de correo electrónico especificada ya se encuentra registrada en la plataforma."
        )
    
    # Hash password
    hashed_pwd = get_password_hash(user_in.password)
    
    # Patients require email verification by OTP code; professional roles are auto-verified
    is_patient = (user_in.role == "patient")
    
    # Create main user
    new_user = models.User(
        email=user_in.email,
        hashed_password=hashed_pwd,
        role=user_in.role,
        full_name=user_in.full_name,
        is_verified=not is_patient
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Create role profile
    if user_in.role == "patient":
        new_patient = models.Patient(
            id=new_user.id,
            age=user_in.age if user_in.age is not None else 30,
            condition=user_in.condition,
            avatar=new_user.full_name[:2].upper(),
            lat=user_in.lat,
            lon=user_in.lon
        )
        db.add(new_patient)

        # Generar código OTP de 6 dígitos con expiración de 15 minutos
        otp_code = f"{random.randint(100000, 999999):06d}"
        
        # Eliminar códigos antiguos para el mismo email si existieran
        db.query(models.EmailVerificationCode).filter(models.EmailVerificationCode.email == user_in.email).delete()
        
        new_code_entry = models.EmailVerificationCode(
            email=user_in.email,
            code=otp_code,
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
        )
        db.add(new_code_entry)
        db.commit()

        # Disparar envío de correo transaccional
        email_service.send_verification_code(user_in.email, otp_code)

    elif user_in.role == "doctor":
        new_doctor = models.Doctor(
            id=new_user.id,
            specialty=user_in.specialty if user_in.specialty else "Medicina General",
            exequatur=user_in.exequatur if user_in.exequatur else "Pendiente",
            id_card=user_in.id_card if user_in.id_card else "000-0000000-0",
            phone=user_in.phone if user_in.phone else "809-529-0000",
            room_state="libre",
            lat=user_in.lat,
            lon=user_in.lon
        )
        db.add(new_doctor)
    elif user_in.role == "pharmacy":
        new_pharmacy = models.Pharmacy(
            id=new_user.id,
            business_name=user_in.business_name if user_in.business_name else user_in.full_name,
            rnc=user_in.rnc if user_in.rnc else "1-00-00000-0",
            health_license=user_in.health_license if user_in.health_license else "MISPAS-PEND",
            pharmacist_name=user_in.pharmacist_name if user_in.pharmacist_name else user_in.full_name,
            lat=user_in.lat,
            lon=user_in.lon,
            address=user_in.address if user_in.address else "San Pedro de Macorís, RD",
            phone=user_in.phone if user_in.phone else "809-529-0000"
        )
        db.add(new_pharmacy)
    else:
        # Rollback user creation if role is invalid
        db.delete(new_user)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El rol '{user_in.role}' especificado no es válido."
        )

    db.commit()

    resp = schemas.UserResponse.from_orm(new_user)
    resp.requires_verification = is_patient
    return resp


@router.post("/verify-code", response_model=schemas.VerifyCodeResponse)
def verify_email_code(req: schemas.VerifyCodeRequest, db: Session = Depends(get_db)):
    """
    Valida el código OTP de 6 dígitos ingresado por el paciente.
    Si han transcurrido más de 15 minutos, retorna el error explícito de expiración.
    """
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró ninguna cuenta asociada a este correo electrónico."
        )

    # Buscar código en BD
    code_record = db.query(models.EmailVerificationCode).filter(
        models.EmailVerificationCode.email == req.email,
        models.EmailVerificationCode.code == req.code.strip()
    ).first()

    if not code_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código de verificación incorrecto. Por favor verifique el número ingresado."
        )

    # Verificar si expiró (más de 15 minutos)
    if datetime.datetime.utcnow() > code_record.expires_at:
        db.delete(code_record)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código ha expirado. Por favor inicie el registro nuevamente."
        )

    # Código válido: marcar usuario como verificado
    user.is_verified = True
    db.delete(code_record)
    db.commit()

    # Generar Token JWT de acceso
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role}
    )

    user_resp = schemas.UserResponse.from_orm(user)
    user_resp.is_verified = True
    user_resp.requires_verification = False

    return schemas.VerifyCodeResponse(
        message="Correo electrónico verificado exitosamente.",
        access_token=access_token,
        token_type="bearer",
        user=user_resp
    )


@router.post("/resend-code")
def resend_verification_code(req: schemas.VerifyCodeRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado."
        )

    if user.is_verified:
        return {"message": "La cuenta ya se encuentra verificada."}

    # Generar nuevo código OTP
    otp_code = f"{random.randint(100000, 999999):06d}"
    db.query(models.EmailVerificationCode).filter(models.EmailVerificationCode.email == req.email).delete()

    new_code_entry = models.EmailVerificationCode(
        email=req.email,
        code=otp_code,
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
    )
    db.add(new_code_entry)
    db.commit()

    email_service.send_verification_code(req.email, otp_code)
    return {"message": "Nuevo código de verificación enviado exitosamente."}


@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    
    # 1. Validar si la cuenta existe
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La dirección de correo electrónico ingresada no está registrada en la plataforma. Seleccione la pestaña 'Registrarse' para crear su cuenta.",
        )
        
    # 2. Validar contraseña
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La contraseña ingresada es incorrecta. Por favor, verifique sus datos e intente nuevamente.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # 3. Validar coincidencia de rol
    if form_data.client_id and user.role != form_data.client_id:
        role_names = {"patient": "Paciente", "doctor": "Médico", "pharmacy": "Farmacia"}
        role_label = role_names.get(user.role, user.role)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Esta dirección de correo electrónico ya se encuentra registrada bajo el rol de '{role_label}'. Por favor, seleccione ese perfil para iniciar sesión."
        )
    
    # 4. Validar si la cuenta requiere verificación de correo
    if user.role == "patient" and not user.is_verified:
        # Reenviar un nuevo código para facilidad del usuario
        otp_code = f"{random.randint(100000, 999999):06d}"
        db.query(models.EmailVerificationCode).filter(models.EmailVerificationCode.email == user.email).delete()
        new_code_entry = models.EmailVerificationCode(
            email=user.email,
            code=otp_code,
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
        )
        db.add(new_code_entry)
        db.commit()
        email_service.send_verification_code(user.email, otp_code)

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Su cuenta de paciente requiere verificación por correo electrónico. Se ha enviado un código a su correo."
        )

    # Generate token
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role}
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.put("/me/avatar", response_model=schemas.UserResponse)
def update_avatar(
    req: schemas.AvatarUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.avatar = req.avatar_url
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/me")
def get_me(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile_data = {}
    if current_user.role == "patient":
        pat = db.query(models.Patient).filter(models.Patient.id == current_user.id).first()
        if pat:
            profile_data = {
                "age": pat.age,
                "condition": pat.condition,
                "avatar": pat.avatar,
                "lat": pat.lat,
                "lon": pat.lon
            }
    elif current_user.role == "doctor":
        doc = db.query(models.Doctor).filter(models.Doctor.id == current_user.id).first()
        if doc:
            profile_data = {
                "specialty": doc.specialty,
                "exequatur": doc.exequatur,
                "id_card": doc.id_card,
                "phone": doc.phone,
                "room_state": doc.room_state,
                "lat": doc.lat,
                "lon": doc.lon,
                "available_days": doc.available_days,
                "start_time": doc.start_time,
                "end_time": doc.end_time,
                "firma": doc.firma
            }
    elif current_user.role == "pharmacy":
        ph = db.query(models.Pharmacy).filter(models.Pharmacy.id == current_user.id).first()
        if ph:
            profile_data = {
                "business_name": ph.business_name,
                "rnc": ph.rnc,
                "health_license": ph.health_license,
                "pharmacist_name": ph.pharmacist_name,
                "address": ph.address,
                "phone": ph.phone,
                "lat": ph.lat,
                "lon": ph.lon
            }

    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "avatar": current_user.avatar,
        "specialty": profile_data.get("specialty"),
        "exequatur": profile_data.get("exequatur"),
        "profile": profile_data
    }


@router.put("/me/settings")
def update_settings(
    req: schemas.UserSettingsUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "doctor":
        doc = db.query(models.Doctor).filter(models.Doctor.id == current_user.id).first()
        if doc:
            if req.available_days is not None:
                doc.available_days = req.available_days
            if req.start_time is not None:
                doc.start_time = req.start_time
            if req.end_time is not None:
                doc.end_time = req.end_time
            if req.firma is not None:
                doc.firma = req.firma
            db.commit()
            
    # Future: handle patient or pharmacy settings here if needed
    return {"message": "Settings updated successfully"}

def verify_google_token(token: str) -> dict:
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    # 1. Try access_token userinfo
    url_userinfo = f"https://www.googleapis.com/oauth2/v3/userinfo?access_token={token}"
    try:
        req = urllib.request.Request(url_userinfo, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        print(f"Userinfo Google token validation failed: {e}")

    # 2. Try id_token tokeninfo
    url_tokeninfo = f"https://oauth2.googleapis.com/tokeninfo?id_token={token}"
    try:
        req = urllib.request.Request(url_tokeninfo, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        print(f"Tokeninfo Google token validation failed: {e}")

    return None


@router.post("/google", response_model=schemas.Token)
def login_google(req_data: schemas.GoogleLoginRequest, db: Session = Depends(get_db)):
    if req_data.role != "patient":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La autenticación a través de proveedores externos está disponible únicamente para cuentas de Pacientes. Los perfiles profesionales (Médicos y Farmacias) deben registrarse e ingresar con sus credenciales institucionales."
        )

    user_info = verify_google_token(req_data.token)
    if not user_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La sesión de autenticación ha expirado o no es válida. Por favor, intente nuevamente."
        )
    
    email = user_info.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo obtener la dirección de correo electrónico vinculada a la sesión."
        )

    user = db.query(models.User).filter(models.User.email == email).first()
    role_names = {"patient": "Paciente", "doctor": "Médico", "pharmacy": "Farmacia"}

    avatar_url = user_info.get("picture")

    # CASO 1: El usuario YA EXISTE en la base de datos
    if user:
        if user.role != req_data.role:
            role_label = role_names.get(user.role, user.role)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Esta dirección de correo electrónico ya se encuentra registrada bajo el rol de '{role_label}'. Por favor, seleccione ese perfil para iniciar sesión."
            )
        
        if avatar_url and user.avatar != avatar_url:
            user.avatar = avatar_url
            db.commit()

        access_token = create_access_token(data={"sub": user.email, "role": user.role})
        return {"access_token": access_token, "token_type": "bearer", "is_new": False}

    # CASO 2: El usuario NO EXISTE en la base de datos
    # Si la petición era solo para consultar/iniciar sesión sin paso de creación completado
    if not req_data.is_creation_step:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ACCOUNT_NOT_FOUND"
        )

    # Si es el paso de creación (is_creation_step = True), registramos al usuario
    full_name = req_data.full_name if req_data.full_name and req_data.full_name.strip() else (user_info.get("name") or email.split("@")[0])
    random_pwd = get_password_hash(datetime.datetime.utcnow().isoformat() + email)
    
    new_user = models.User(
        email=email,
        hashed_password=random_pwd,
        role=req_data.role,
        full_name=full_name,
        avatar=avatar_url
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    if req_data.role == "patient":
        new_patient = models.Patient(
            id=new_user.id,
            age=req_data.age if req_data.age is not None else 30,
            condition=req_data.condition if req_data.condition else "General",
            avatar=user_info.get("picture") or full_name[:2].upper(),
            lat=18.463,
            lon=-69.304
        )
        db.add(new_patient)
    elif req_data.role == "doctor":
        new_doctor = models.Doctor(
            id=new_user.id,
            specialty=req_data.specialty if req_data.specialty else "Medicina General",
            exequatur=req_data.exequatur if req_data.exequatur else "Pendiente",
            id_card=req_data.id_card if req_data.id_card else "000-0000000-0",
            phone=req_data.phone if req_data.phone else "809-529-0000",
            room_state="libre",
            lat=18.463,
            lon=-69.304
        )
        db.add(new_doctor)
    elif req_data.role == "pharmacy":
        new_pharmacy = models.Pharmacy(
            id=new_user.id,
            business_name=req_data.business_name if req_data.business_name else full_name,
            rnc=req_data.rnc if req_data.rnc else "1-00-00000-0",
            health_license=req_data.health_license if req_data.health_license else "MISPAS-PEND",
            pharmacist_name=req_data.pharmacist_name if req_data.pharmacist_name else full_name,
            lat=18.463,
            lon=-69.304,
            address=req_data.address if req_data.address else "San Pedro de Macorís, RD",
            phone=req_data.phone if req_data.phone else "809-529-0000"
        )
        db.add(new_pharmacy)
    
    db.commit()
    
    access_token = create_access_token(data={"sub": new_user.email, "role": new_user.role})
    return {"access_token": access_token, "token_type": "bearer", "is_new": True}

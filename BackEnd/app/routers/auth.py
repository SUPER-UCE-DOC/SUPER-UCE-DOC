import datetime
import bcrypt
import urllib.request
import json
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from typing import List

from app.database import get_db
from app import models, schemas
from app.config import settings

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
            detail="El correo electrónico ya está registrado."
        )
    
    # Hash password
    hashed_pwd = get_password_hash(user_in.password)
    
    # Create main user
    new_user = models.User(
        email=user_in.email,
        hashed_password=hashed_pwd,
        role=user_in.role,
        full_name=user_in.full_name
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
    elif user_in.role == "doctor":
        new_doctor = models.Doctor(
            id=new_user.id,
            specialty=user_in.specialty if user_in.specialty else "Medicina General",
            room_state="libre",
            lat=user_in.lat,
            lon=user_in.lon
        )
        db.add(new_doctor)
    elif user_in.role == "pharmacy":
        new_pharmacy = models.Pharmacy(
            id=new_user.id,
            business_name=user_in.business_name if user_in.business_name else user_in.full_name,
            lat=user_in.lat,
            lon=user_in.lon,
            address=user_in.address if user_in.address else "Dirección no especificada",
            phone=user_in.phone if user_in.phone else "809-529-0000"
        )
        db.add(new_pharmacy)
    else:
        # Rollback user creation if role is invalid
        db.delete(new_user)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Rol '{user_in.role}' no es válido."
        )

    db.commit()
    return new_user


@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Generate token
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role}
    )
    return {"access_token": access_token, "token_type": "bearer"}


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
                "room_state": doc.room_state,
                "lat": doc.lat,
                "lon": doc.lon
            }
    elif current_user.role == "pharmacy":
        ph = db.query(models.Pharmacy).filter(models.Pharmacy.id == current_user.id).first()
        if ph:
            profile_data = {
                "business_name": ph.business_name,
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
        "profile": profile_data
    }


def verify_google_token(token: str) -> dict:
    url = f"https://www.googleapis.com/oauth2/v3/userinfo?access_token={token}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        print(f"Error validating Google token: {e}")
    return None


@router.post("/google", response_model=schemas.Token)
def login_google(req_data: schemas.GoogleLoginRequest, db: Session = Depends(get_db)):
    user_info = verify_google_token(req_data.token)
    if not user_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de Google no válido o expirado."
        )
    
    email = user_info.get("email")
    full_name = user_info.get("name") or email.split("@")[0]
    
    # Check if user already exists
    user = db.query(models.User).filter(models.User.email == email).first()
    
    if not user:
        # Create a new user with randomized password
        random_pwd = get_password_hash(datetime.datetime.utcnow().isoformat() + email)
        user = models.User(
            email=email,
            hashed_password=random_pwd,
            role=req_data.role,
            full_name=full_name
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Create role profile
        if req_data.role == "patient":
            new_patient = models.Patient(
                id=user.id,
                age=30,
                condition="General",
                avatar=full_name[:2].upper(),
                lat=18.463,
                lon=-69.304
            )
            db.add(new_patient)
        elif req_data.role == "doctor":
            new_doctor = models.Doctor(
                id=user.id,
                specialty="Medicina General",
                room_state="libre",
                lat=18.463,
                lon=-69.304
            )
            db.add(new_doctor)
        elif req_data.role == "pharmacy":
            new_pharmacy = models.Pharmacy(
                id=user.id,
                business_name=full_name,
                lat=18.463,
                lon=-69.304,
                address="San Pedro de Macorís, RD",
                phone="809-529-0000"
            )
            db.add(new_pharmacy)
        
        db.commit()
    
    # Generate application JWT
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role}
    )
    return {"access_token": access_token, "token_type": "bearer"}

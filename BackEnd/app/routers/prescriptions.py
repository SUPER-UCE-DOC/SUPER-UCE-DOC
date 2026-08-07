from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import datetime
import uuid

from app.database import get_db
from app import models, schemas
from app.routers.auth import get_current_user, RoleChecker

router = APIRouter(prefix="/api/prescriptions", tags=["prescriptions"])

@router.post("", response_model=schemas.PrescriptionResponse, status_code=status.HTTP_201_CREATED)
def create_prescription(
    prescription_in: schemas.PrescriptionCreate,
    current_user: models.User = Depends(RoleChecker(["doctor"])),
    db: Session = Depends(get_db)
):
    # Verify patient exists (or resolve from appointment_id)
    patient = db.query(models.Patient).filter(models.Patient.id == prescription_in.patient_id).first()
    if not patient and prescription_in.appointment_id:
        app = db.query(models.Appointment).filter(models.Appointment.id == prescription_in.appointment_id).first()
        if app:
            patient = db.query(models.Patient).filter(models.Patient.id == app.patient_id).first()
            if patient:
                prescription_in.patient_id = app.patient_id

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró el expediente del paciente activo para emitir esta receta."
        )

    # Calculate expiration date
    if prescription_in.expires_at_date:
        try:
            # Parse as YYYY-MM-DD and set time to 23:59:59
            parsed_date = datetime.datetime.strptime(prescription_in.expires_at_date, "%Y-%m-%d")
            expires_at = parsed_date.replace(hour=23, minute=59, second=59)
        except ValueError:
            # Fallback if invalid format
            expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=prescription_in.expires_in_days)
    else:
        expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=prescription_in.expires_in_days)
    
    # Generate unique ID e.g. RX-2026-XXXX
    unique_rx_id = f"RX-{datetime.datetime.now().year}-{str(uuid.uuid4().int)[:4]}"

    new_rx = models.Prescription(
        id=unique_rx_id,
        appointment_id=prescription_in.appointment_id,
        patient_id=prescription_in.patient_id,
        doctor_id=current_user.id,
        medicine=prescription_in.medicine,
        dose=prescription_in.dose,
        frequency=prescription_in.frequency,
        status="activa",
        issued_at=datetime.datetime.utcnow(),
        expires_at=expires_at,
        patient_lat=patient.lat,
        patient_lon=patient.lon
    )
    db.add(new_rx)
    db.commit()
    db.refresh(new_rx)

    # Enviar correo de notificación de receta médica al paciente
    if patient and patient.user and patient.user.email:
        try:
            from app.services.email_service import email_service
            email_service.send_prescription_email(
                to_email=patient.user.email,
                patient_name=patient.user.full_name,
                doctor_name=current_user.full_name,
                medicine=new_rx.medicine,
                dose=new_rx.dose,
                frequency=new_rx.frequency,
                rx_id=new_rx.id
            )
        except Exception as ex:
            print("Error al enviar correo de receta médica:", ex)

    return schemas.PrescriptionResponse(
        id=new_rx.id,
        appointment_id=new_rx.appointment_id,
        patient_id=new_rx.patient_id,
        pharmacy_id=new_rx.pharmacy_id,
        patient_name=patient.user.full_name,
        doctor_id=new_rx.doctor_id,
        doctor_name=current_user.full_name,
        medicine=new_rx.medicine,
        dose=new_rx.dose,
        frequency=new_rx.frequency,
        status=new_rx.status,
        issued_at=new_rx.issued_at,
        expires_at=new_rx.expires_at,
        patient_lat=new_rx.patient_lat,
        patient_lon=new_rx.patient_lon
    )


@router.get("", response_model=List[schemas.PrescriptionResponse])
def get_prescriptions(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.Prescription)
    if current_user.role == "patient":
        query = query.filter(models.Prescription.patient_id == current_user.id)
    elif current_user.role == "doctor":
        query = query.filter(models.Prescription.doctor_id == current_user.id)
    elif current_user.role == "pharmacy":
        # Pharmacy can only see prescriptions explicitly assigned to them
        query = query.filter(models.Prescription.pharmacy_id == current_user.id)
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Rol no reconocido.")
    
    rx_list = query.order_by(models.Prescription.issued_at.desc()).all()
    
    response = []
    for rx in rx_list:
        p_name = db.query(models.User).filter(models.User.id == rx.patient_id).first().full_name
        d_name = db.query(models.User).filter(models.User.id == rx.doctor_id).first().full_name
        response.append(
            schemas.PrescriptionResponse(
                id=rx.id,
                appointment_id=rx.appointment_id,
                patient_id=rx.patient_id,
                pharmacy_id=rx.pharmacy_id,
                patient_name=p_name,
                doctor_id=rx.doctor_id,
                doctor_name=d_name,
                medicine=rx.medicine,
                dose=rx.dose,
                frequency=rx.frequency,
                status=rx.status,
                issued_at=rx.issued_at,
                expires_at=rx.expires_at,
                patient_lat=rx.patient_lat,
                patient_lon=rx.patient_lon
            )
        )
    return response


@router.get("/patient/{patient_id}", response_model=List[schemas.PrescriptionResponse])
def get_prescriptions_by_patient(
    patient_id: int,
    current_user: models.User = Depends(RoleChecker(["doctor"])),
    db: Session = Depends(get_db)
):
    rx_list = db.query(models.Prescription).filter(
        models.Prescription.patient_id == patient_id
    ).order_by(models.Prescription.issued_at.desc()).all()
    
    response = []
    for rx in rx_list:
        p_name = db.query(models.User).filter(models.User.id == rx.patient_id).first().full_name
        d_name = db.query(models.User).filter(models.User.id == rx.doctor_id).first().full_name
        response.append(
            schemas.PrescriptionResponse(
                id=rx.id,
                appointment_id=rx.appointment_id,
                patient_id=rx.patient_id,
                pharmacy_id=rx.pharmacy_id,
                patient_name=p_name,
                doctor_id=rx.doctor_id,
                doctor_name=d_name,
                medicine=rx.medicine,
                dose=rx.dose,
                frequency=rx.frequency,
                status=rx.status,
                issued_at=rx.issued_at,
                expires_at=rx.expires_at,
                patient_lat=rx.patient_lat,
                patient_lon=rx.patient_lon
            )
        )
    return response

@router.get("/{id}", response_model=schemas.PrescriptionResponse)
def get_prescription_by_id(
    id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rx = db.query(models.Prescription).filter(models.Prescription.id == id).first()
    if not rx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receta no encontrada."
        )

    # Paciente solo puede ver su propia receta
    if current_user.role == "patient" and rx.patient_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: esta receta pertenece a otro paciente."
        )

    p_name = db.query(models.User).filter(models.User.id == rx.patient_id).first().full_name
    d_name = db.query(models.User).filter(models.User.id == rx.doctor_id).first().full_name

    return schemas.PrescriptionResponse(
        id=rx.id,
        appointment_id=rx.appointment_id,
        patient_id=rx.patient_id,
        pharmacy_id=rx.pharmacy_id,
        patient_name=p_name,
        doctor_id=rx.doctor_id,
        doctor_name=d_name,
        medicine=rx.medicine,
        dose=rx.dose,
        frequency=rx.frequency,
        status=rx.status,
        issued_at=rx.issued_at,
        expires_at=rx.expires_at,
        patient_lat=rx.patient_lat,
        patient_lon=rx.patient_lon
    )


@router.post("/{id}/assign", response_model=schemas.PrescriptionResponse)
def assign_prescription_to_pharmacy(
    id: str,
    assignment: schemas.PrescriptionAssign,
    current_user: models.User = Depends(RoleChecker(["patient"])),
    db: Session = Depends(get_db)
):
    rx = db.query(models.Prescription).filter(models.Prescription.id == id).first()
    if not rx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receta no encontrada."
        )
    
    if rx.patient_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: esta receta pertenece a otro paciente."
        )
        
    if rx.status != "activa" or rx.pharmacy_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta receta ya no está activa o ya fue enviada a una farmacia."
        )
        
    pharmacy = db.query(models.Pharmacy).filter(models.Pharmacy.id == assignment.pharmacy_id).first()
    if not pharmacy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La farmacia seleccionada no está registrada en el sistema."
        )

    rx.pharmacy_id = assignment.pharmacy_id
    rx.status = "asignada"
    db.commit()
    db.refresh(rx)
    
    p_name = db.query(models.User).filter(models.User.id == rx.patient_id).first().full_name
    d_name = db.query(models.User).filter(models.User.id == rx.doctor_id).first().full_name

    return schemas.PrescriptionResponse(
        id=rx.id,
        appointment_id=rx.appointment_id,
        patient_id=rx.patient_id,
        pharmacy_id=rx.pharmacy_id,
        patient_name=p_name,
        doctor_id=rx.doctor_id,
        doctor_name=d_name,
        medicine=rx.medicine,
        dose=rx.dose,
        frequency=rx.frequency,
        status=rx.status,
        issued_at=rx.issued_at,
        expires_at=rx.expires_at,
        patient_lat=rx.patient_lat,
        patient_lon=rx.patient_lon
    )


@router.post("/{id}/dispatch", response_model=schemas.PrescriptionResponse)
def dispatch_prescription(
    id: str,
    current_user: models.User = Depends(RoleChecker(["pharmacy"])),
    db: Session = Depends(get_db)
):
    """
    Despacha una receta médica reduciendo el inventario en una transacción ACID.
    Si hay algún error, se realiza un rollback automático de la transacción.
    """
    # Iniciamos transacción explícita
    # Nota: db.begin() no es necesario porque SQLAlchemy maneja transacciones en Session.
    # Usamos with_for_update() en la receta y el inventario para asegurar exclusión mutua
    rx = db.query(models.Prescription).filter(models.Prescription.id == id).with_for_update().first()
    
    if not rx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receta no encontrada."
        )
        
    if rx.status == "despachada":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta receta ya ha sido despachada anteriormente."
        )
        
    if rx.status == "vencida":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta receta está vencida y no puede ser despachada."
        )

    # Buscamos el medicamento en el inventario de esta farmacia
    inv_item = db.query(models.PharmacyInventory).filter(
        models.PharmacyInventory.pharmacy_id == current_user.id,
        models.PharmacyInventory.medicine.ilike(rx.medicine)
    ).with_for_update().first()

    if not inv_item:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La farmacia no cuenta con el medicamento '{rx.medicine}' en su catálogo."
        )

    if inv_item.stock <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stock insuficiente para '{rx.medicine}'. Stock actual: {inv_item.stock}"
        )

    try:
        # 1. Restar stock del inventario
        inv_item.stock -= 1
        
        # 2. Actualizar estado de la receta
        rx.status = "despachada"
        
        # Guardamos los cambios
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en la transacción ACID de despacho: {str(e)}"
        )

    p_name = db.query(models.User).filter(models.User.id == rx.patient_id).first().full_name
    d_name = db.query(models.User).filter(models.User.id == rx.doctor_id).first().full_name

    return schemas.PrescriptionResponse(
        id=rx.id,
        appointment_id=rx.appointment_id,
        patient_id=rx.patient_id,
        pharmacy_id=rx.pharmacy_id,
        patient_name=p_name,
        doctor_id=rx.doctor_id,
        doctor_name=d_name,
        medicine=rx.medicine,
        dose=rx.dose,
        frequency=rx.frequency,
        status=rx.status,
        issued_at=rx.issued_at,
        expires_at=rx.expires_at,
        patient_lat=rx.patient_lat,
        patient_lon=rx.patient_lon
    )

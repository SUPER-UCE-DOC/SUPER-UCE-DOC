from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import datetime

from app.database import get_db
from app import models, schemas
from app.routers.auth import get_current_user, RoleChecker

router = APIRouter(prefix="/api/appointments", tags=["appointments"])

@router.post("", response_model=schemas.AppointmentResponse, status_code=status.HTTP_201_CREATED)
def create_appointment(
    appointment_in: schemas.AppointmentCreate,
    current_user: models.User = Depends(RoleChecker(["patient", "doctor"])),
    db: Session = Depends(get_db)
):
    if current_user.role == "patient":
        if not appointment_in.doctor_id:
            raise HTTPException(status_code=400, detail="Debes especificar un médico.")
        doctor = db.query(models.Doctor).filter(models.Doctor.id == appointment_in.doctor_id).first()
        if not doctor:
            raise HTTPException(status_code=404, detail="Médico no encontrado.")
            
        new_app = models.Appointment(
            patient_id=current_user.id,
            doctor_id=appointment_in.doctor_id,
            date_time=appointment_in.date_time,
            status="pendiente",
            type=appointment_in.type,
            reason=appointment_in.reason
        )
        patient_user = current_user
        doctor_user = doctor.user
        patient_name = patient_user.full_name
        doctor_name = doctor_user.full_name

    else:  # doctor
        if not appointment_in.patient_id:
            raise HTTPException(status_code=400, detail="Debes especificar un paciente.")
        patient = db.query(models.Patient).filter(models.Patient.id == appointment_in.patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Paciente no encontrado.")

        new_app = models.Appointment(
            patient_id=appointment_in.patient_id,
            doctor_id=current_user.id,
            date_time=appointment_in.date_time,
            status="confirmada",
            type=appointment_in.type,
            reason=appointment_in.reason
        )
        patient_user = patient.user
        doctor_user = current_user
        patient_name = patient_user.full_name
        doctor_name = doctor_user.full_name

    db.add(new_app)
    db.commit()
    db.refresh(new_app)

    return schemas.AppointmentResponse(
        id=new_app.id,
        patient_id=new_app.patient_id,
        doctor_id=new_app.doctor_id,
        date_time=new_app.date_time,
        status=new_app.status,
        type=new_app.type,
        reason=new_app.reason,
        patient_name=patient_name,
        doctor_name=doctor_name,
        patient_avatar=patient_user.avatar,
        doctor_avatar=doctor_user.avatar
    )


@router.get("", response_model=List[schemas.AppointmentResponse])
def get_my_appointments(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.Appointment)
    if current_user.role == "patient":
        query = query.filter(models.Appointment.patient_id == current_user.id)
    elif current_user.role == "doctor":
        query = query.filter(models.Appointment.doctor_id == current_user.id)
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Farmacias no tienen agenda de citas médicas."
        )
    
    appointments = query.order_by(models.Appointment.date_time.asc()).all()
    
    response = []
    for app in appointments:
        p_user = db.query(models.User).filter(models.User.id == app.patient_id).first()
        d_user = db.query(models.User).filter(models.User.id == app.doctor_id).first()
        p_name = p_user.full_name if p_user else "Paciente"
        d_name = d_user.full_name if d_user else "Doctor"
        response.append(
            schemas.AppointmentResponse(
                id=app.id,
                patient_id=app.patient_id,
                doctor_id=app.doctor_id,
                date_time=app.date_time,
                status=app.status,
                type=app.type,
                reason=app.reason,
                patient_name=p_name,
                doctor_name=d_name,
                patient_avatar=p_user.avatar if p_user else None,
                doctor_avatar=d_user.avatar if d_user else None
            )
        )
    return response


@router.put("/{id}/status", response_model=schemas.AppointmentResponse)
def update_appointment_status(
    id: int,
    status_update: schemas.AppointmentStatusUpdate,
    current_user: models.User = Depends(RoleChecker(["doctor", "patient"])),
    db: Session = Depends(get_db)
):
    app = db.query(models.Appointment).filter(models.Appointment.id == id).first()
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cita no encontrada."
        )
    
    # Check permissions (doctor can modify any of their appointments, patient can cancel theirs)
    if current_user.role == "patient" and app.patient_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para modificar esta cita."
        )
    if current_user.role == "doctor" and app.doctor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No eres el médico asignado a esta cita."
        )
    
    # Update status
    app.status = status_update.status
    
    # If the doctor updates state, update the doctor's room state accordingly
    if current_user.role == "doctor":
        doc = db.query(models.Doctor).filter(models.Doctor.id == current_user.id).first()
        if doc:
            if status_update.status == "en_curso":
                doc.room_state = "en_consulta"
                try:
                    from app.routers.realtime import room_presence_store
                    clean_room = str(app.id)
                    if clean_room not in room_presence_store:
                        room_presence_store[clean_room] = {}
                    if "start_time" not in room_presence_store[clean_room]:
                        room_presence_store[clean_room]["start_time"] = time.time()
                except Exception as ex:
                    print("Error setting start_time:", ex)
            elif status_update.status == "completada":
                doc.room_state = "libre"
            elif status_update.status == "pendiente":
                doc.room_state = "esperando"

    db.commit()
    db.refresh(app)
    
    p_user = db.query(models.User).filter(models.User.id == app.patient_id).first()
    d_user = db.query(models.User).filter(models.User.id == app.doctor_id).first()
    p_name = p_user.full_name if p_user else "Paciente"
    d_name = d_user.full_name if d_user else "Doctor"
    
    return schemas.AppointmentResponse(
        id=app.id,
        patient_id=app.patient_id,
        doctor_id=app.doctor_id,
        date_time=app.date_time,
        status=app.status,
        type=app.type,
        reason=app.reason,
        patient_name=p_name,
        doctor_name=d_name,
        patient_avatar=p_user.avatar if p_user else None,
        doctor_avatar=d_user.avatar if d_user else None
    )


@router.get("/waiting-room", response_model=List[schemas.AppointmentResponse])
def get_waiting_room(
    current_user: models.User = Depends(RoleChecker(["doctor"])),
    db: Session = Depends(get_db)
):
    # Get appointments for today that are pending or en_curso
    today = datetime.date.today()
    start_of_day = datetime.datetime.combine(today, datetime.time.min)
    end_of_day = datetime.datetime.combine(today, datetime.time.max)
    
    appointments = db.query(models.Appointment).filter(
        models.Appointment.doctor_id == current_user.id,
        models.Appointment.date_time >= start_of_day,
        models.Appointment.date_time <= end_of_day,
        models.Appointment.status.in_(["pendiente", "en_curso"])
    ).order_by(models.Appointment.date_time.asc()).all()
    
    response = []
    for app in appointments:
        p_name = db.query(models.User).filter(models.User.id == app.patient_id).first().full_name
        d_name = current_user.full_name
        response.append(
            schemas.AppointmentResponse(
                id=app.id,
                patient_id=app.patient_id,
                doctor_id=app.doctor_id,
                date_time=app.date_time,
                status=app.status,
                type=app.type,
                reason=app.reason,
                patient_name=p_name,
                doctor_name=d_name
            )
        )
    return response

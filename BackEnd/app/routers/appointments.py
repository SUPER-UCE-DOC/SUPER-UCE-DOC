from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import datetime
import time

from app.database import get_db
from app import models, schemas
from app.routers.auth import get_current_user, RoleChecker

router = APIRouter(prefix="/api/appointments", tags=["appointments"])

VALID_APPOINTMENT_STATUSES = {"pendiente", "en_curso", "completada", "cancelada"}


def notify_state_change(appointment_id: int, new_status: str) -> None:
    print(f"Notificando Módulo 5: cita {appointment_id} cambió a estado {new_status}")


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
            status="pendiente",
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
    doc_profile = db.query(models.Doctor).filter(models.Doctor.id == doctor_user.id).first() if doctor_user else None
    doc_spec = doc_profile.specialty if doc_profile else "Medicina General"

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
        doctor_specialty=doc_spec,
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
        d_prof = db.query(models.Doctor).filter(models.Doctor.id == app.doctor_id).first()
        p_name = p_user.full_name if p_user else "Paciente"
        d_name = d_user.full_name if d_user else "Doctor"
        d_spec = d_prof.specialty if d_prof else "Medicina General"
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
                doctor_specialty=d_spec,
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

    requested_status = status_update.status.strip().lower()
    if requested_status not in VALID_APPOINTMENT_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Estado inválido. Los estados permitidos son: pendiente, en_curso, completada, cancelada."
        )

    if app.status in {"completada", "cancelada"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede modificar una cita que ya está en estado '{app.status}'."
        )

    if requested_status == app.status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La cita ya se encuentra en estado '{app.status}'."
        )

    if current_user.role == "doctor":
        if requested_status not in {"en_curso", "completada"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Solo el médico puede cambiar el estado a 'en_curso' o 'completada'."
            )

        if app.status == "pendiente" and requested_status != "en_curso":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede saltar estados. Desde 'pendiente' solo se permite avanzar a 'en_curso'."
            )

        if app.status == "en_curso" and requested_status != "completada":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede saltar estados. Desde 'en_curso' solo se permite avanzar a 'completada'."
            )

    elif current_user.role == "patient":
        if requested_status != "cancelada":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Solo el paciente puede cancelar la cita, cambiando su estado a 'cancelada'."
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rol no permitido para cambiar el estado de la cita."
        )

    app.status = requested_status

    if current_user.role == "doctor":
        doc = db.query(models.Doctor).filter(models.Doctor.id == current_user.id).first()
        if doc:
            if requested_status == "en_curso":
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
            elif requested_status == "completada":
                doc.room_state = "libre"
            elif requested_status == "pendiente":
                doc.room_state = "esperando"

    db.commit()
    db.refresh(app)

    notify_state_change(app.id, app.status)

    p_user = db.query(models.User).filter(models.User.id == app.patient_id).first()
    d_user = db.query(models.User).filter(models.User.id == app.doctor_id).first()
    d_prof = db.query(models.Doctor).filter(models.Doctor.id == app.doctor_id).first()
    p_name = p_user.full_name if p_user else "Paciente"
    d_name = d_user.full_name if d_user else "Doctor"
    d_spec = d_prof.specialty if d_prof else "Medicina General"

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
        doctor_specialty=d_spec,
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
    
    d_prof = db.query(models.Doctor).filter(models.Doctor.id == current_user.id).first()
    d_spec = d_prof.specialty if d_prof else "Medicina General"

    response = []
    for app in appointments:
        p_user = db.query(models.User).filter(models.User.id == app.patient_id).first()
        p_name = p_user.full_name if p_user else "Paciente"
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
                doctor_name=d_name,
                doctor_specialty=d_spec,
                patient_avatar=p_user.avatar if p_user else None,
                doctor_avatar=current_user.avatar
            )
        )
    return response


# Helper local para serializar una cita en el formato usado por la API
def _build_appointment_response(db: Session, appointment: models.Appointment) -> schemas.AppointmentResponse:
    p_user = db.query(models.User).filter(models.User.id == appointment.patient_id).first()
    d_user = db.query(models.User).filter(models.User.id == appointment.doctor_id).first()
    d_prof = db.query(models.Doctor).filter(models.Doctor.id == appointment.doctor_id).first()
    p_name = p_user.full_name if p_user else "Paciente"
    d_name = d_user.full_name if d_user else "Doctor"
    d_spec = d_prof.specialty if d_prof else "Medicina General"

    return schemas.AppointmentResponse(
        id=appointment.id,
        patient_id=appointment.patient_id,
        doctor_id=appointment.doctor_id,
        date_time=appointment.date_time,
        status=appointment.status,
        type=appointment.type,
        reason=appointment.reason,
        patient_name=p_name,
        doctor_name=d_name,
        doctor_specialty=d_spec,
        patient_avatar=p_user.avatar if p_user else None,
        doctor_avatar=d_user.avatar if d_user else None
    )


@router.get("/{id}", response_model=schemas.AppointmentResponse)
def get_appointment_by_id(
    id: int,
    current_user: models.User = Depends(RoleChecker(["patient", "doctor"])),
    db: Session = Depends(get_db)
):
    """Devuelve el detalle de una cita si el usuario tiene permiso para verla."""
    appointment = db.query(models.Appointment).filter(models.Appointment.id == id).first()
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cita no encontrada."
        )

    if current_user.role == "patient" and appointment.patient_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para ver esta cita."
        )

    if current_user.role == "doctor" and appointment.doctor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para ver esta cita."
        )

    return _build_appointment_response(db, appointment)


@router.put("/{id}", response_model=schemas.AppointmentResponse)
def update_appointment(
    id: int,
    appointment_update: schemas.AppointmentCreate,
    current_user: models.User = Depends(RoleChecker(["doctor"])),
    db: Session = Depends(get_db)
):
    """Permite editar los datos básicos de una cita únicamente por el médico asignado."""
    appointment = db.query(models.Appointment).filter(models.Appointment.id == id).first()
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cita no encontrada."
        )

    if appointment.doctor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para editar esta cita."
        )

    if appointment.status in {"completada", "cancelada"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede editar una cita que ya está completada o cancelada."
        )

    # Solo se permiten estos campos para evitar modificar el flujo clínico de la cita
    appointment.date_time = appointment_update.date_time
    appointment.type = appointment_update.type
    appointment.reason = appointment_update.reason

    db.commit()
    db.refresh(appointment)

    return _build_appointment_response(db, appointment)


@router.delete("/{id}", status_code=status.HTTP_200_OK)
def cancel_appointment(
    id: int,
    current_user: models.User = Depends(RoleChecker(["patient"])),
    db: Session = Depends(get_db)
):
    """Cancela una cita cambiando su estado en vez de borrar el registro."""
    appointment = db.query(models.Appointment).filter(models.Appointment.id == id).first()
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cita no encontrada."
        )

    if appointment.patient_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el paciente dueño de la cita puede cancelarla."
        )

    if appointment.status in {"completada", "cancelada"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede cancelar una cita que ya está completada o cancelada."
        )

    appointment.status = "cancelada"
    db.commit()
    db.refresh(appointment)

    notify_state_change(appointment.id, appointment.status)

    return {"message": "Cita cancelada exitosamente"}

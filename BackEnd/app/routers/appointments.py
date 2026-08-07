from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List
import datetime
import time

from app.database import get_db
from app import models, schemas
from app.routers.auth import get_current_user, RoleChecker

router = APIRouter(prefix="/api/appointments", tags=["appointments"])

VALID_APPOINTMENT_STATUSES = {"pendiente", "confirmada", "rechazada", "en_curso", "completada", "cancelada"}


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

    # Enviar correo de notificación al paciente sobre la nueva cita agendada
    if patient_user and patient_user.email:
        try:
            from app.services.email_service import email_service
            date_formatted = new_app.date_time.strftime("%d/%m/%Y a las %I:%M %p") if isinstance(new_app.date_time, datetime.datetime) else str(new_app.date_time)
            is_doc = (current_user.role == "doctor")
            email_service.send_appointment_status_email(
                to_email=patient_user.email,
                patient_name=patient_name,
                doctor_name=doctor_name,
                date_time_str=date_formatted,
                status_name=new_app.status,
                reason=new_app.reason or "",
                is_created_by_doctor=is_doc
            )
        except Exception as ex:
            print("Error al enviar correo al crear cita médica:", ex)

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
        doctor_avatar=doctor_user.avatar,
        real_start_time=new_app.real_start_time,
        real_end_time=new_app.real_end_time
    )


@router.get("", response_model=List[schemas.AppointmentResponse])
def get_my_appointments(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.Appointment).options(
        joinedload(models.Appointment.patient).joinedload(models.Patient.user),
        joinedload(models.Appointment.doctor).joinedload(models.Doctor.user)
    )
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
        p_user = app.patient.user if app.patient else None
        d_user = app.doctor.user if app.doctor else None
        d_prof = app.doctor
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
                doctor_avatar=d_user.avatar if d_user else None,
                real_start_time=app.real_start_time,
                real_end_time=app.real_end_time
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
            detail="Estado inválido. Los estados permitidos son: pendiente, confirmada, rechazada, en_curso, completada, cancelada."
        )

    if app.status in {"completada", "cancelada"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede modificar una cita que ya está en estado '{app.status}'."
        )

    if requested_status == app.status:
        if requested_status == "en_curso":
            if not app.real_start_time:
                app.real_start_time = datetime.datetime.utcnow()
                db.commit()
            try:
                from app.routers.realtime import start_room_timer, utc_dt_to_timestamp
                start_room_timer(str(app.id), start_ts=utc_dt_to_timestamp(app.real_start_time))
            except Exception as ex:
                pass
            patient_user = app.patient.user if app.patient else None
            doctor_user = app.doctor.user if app.doctor else None
            doc_profile = db.query(models.Doctor).filter(models.Doctor.id == app.doctor_id).first() if app.doctor_id else None
            return schemas.AppointmentResponse(
                id=app.id,
                patient_id=app.patient_id,
                doctor_id=app.doctor_id,
                date_time=app.date_time,
                status=app.status,
                type=app.type,
                reason=app.reason,
                patient_name=patient_user.full_name if patient_user else "Paciente",
                doctor_name=doctor_user.full_name if doctor_user else "Médico",
                patient_avatar=patient_user.avatar if patient_user else None,
                doctor_avatar=doctor_user.avatar if doctor_user else None,
                doctor_specialty=doc_profile.specialty if doc_profile else "Medicina General",
                real_start_time=app.real_start_time,
                real_end_time=app.real_end_time
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La cita ya se encuentra en estado '{app.status}'."
        )

    if current_user.role == "doctor":
        if requested_status not in {"confirmada", "rechazada", "en_curso", "completada"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Solo el médico puede cambiar el estado a 'confirmada', 'rechazada', 'en_curso' o 'completada'."
            )

        if app.status == "pendiente" and requested_status not in {"confirmada", "rechazada"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede saltar estados. Desde 'pendiente' solo se permite 'confirmada' o 'rechazada'."
            )

        if app.status == "confirmada" and requested_status != "en_curso":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede saltar estados. Desde 'confirmada' solo se permite avanzar a 'en_curso'."
            )

        if app.status == "en_curso" and requested_status != "completada":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede saltar estados. Desde 'en_curso' solo se permite avanzar a 'completada'."
            )

    elif current_user.role == "patient":
        if requested_status not in {"cancelada", "en_curso"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Solo el paciente puede cancelar la cita o avanzar a en_curso al unirse."
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rol no permitido para cambiar el estado de la cita."
        )

    app.status = requested_status

    if requested_status == "en_curso":
        if not app.real_start_time:
            app.real_start_time = datetime.datetime.utcnow()
        try:
            from app.routers.realtime import start_room_timer, utc_dt_to_timestamp
            start_room_timer(str(app.id), start_ts=utc_dt_to_timestamp(app.real_start_time))
        except Exception as ex:
            print("Error starting realtime timer:", ex)
    elif requested_status == "completada" and not app.real_end_time:
        app.real_end_time = datetime.datetime.utcnow()

    if current_user.role == "doctor":
        doc = db.query(models.Doctor).filter(models.Doctor.id == current_user.id).first()
        if doc:
            if requested_status == "en_curso":
                doc.room_state = "en_consulta"
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

    # Enviar correo de notificación de cita si el paciente tiene correo registrado
    if p_user and p_user.email:
        try:
            from app.services.email_service import email_service
            date_formatted = app.date_time.strftime("%d/%m/%Y a las %I:%M %p") if isinstance(app.date_time, datetime.datetime) else str(app.date_time)
            email_service.send_appointment_status_email(
                to_email=p_user.email,
                patient_name=p_name,
                doctor_name=d_name,
                date_time_str=date_formatted,
                status_name=app.status,
                reason=app.reason or ""
            )
        except Exception as ex:
            print("Error al enviar correo de actualización de cita:", ex)

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
        doctor_avatar=d_user.avatar if d_user else None,
        real_start_time=app.real_start_time,
        real_end_time=app.real_end_time
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
    
    appointments = db.query(models.Appointment).options(
        joinedload(models.Appointment.patient).joinedload(models.Patient.user),
        joinedload(models.Appointment.doctor)
    ).filter(
        models.Appointment.doctor_id == current_user.id,
        models.Appointment.date_time >= start_of_day,
        models.Appointment.date_time <= end_of_day,
        models.Appointment.status.in_(["pendiente", "en_curso"])
    ).order_by(models.Appointment.date_time.asc()).all()
    
    response = []
    for app in appointments:
        p_user = app.patient.user if app.patient else None
        d_prof = app.doctor if app.doctor else None
        p_name = p_user.full_name if p_user else "Paciente"
        d_name = current_user.full_name
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


@router.get("/my-patients")
def get_my_patients(
    current_user: models.User = Depends(RoleChecker(["doctor"])),
    db: Session = Depends(get_db)
):
    """Devuelve la lista de pacientes únicos que tienen o han tenido una cita con el doctor actual."""
    appointments = db.query(models.Appointment).options(
        joinedload(models.Appointment.patient).joinedload(models.Patient.user)
    ).filter(
        models.Appointment.doctor_id == current_user.id
    ).order_by(models.Appointment.date_time.desc()).all()
    
    from collections import defaultdict
    patient_apps = defaultdict(list)
    for app in appointments:
        patient_apps[app.patient_id].append(app)
        
    patients_data = []
    for pid, apps in patient_apps.items():
        patient_profile = apps[0].patient
        patient_user = patient_profile.user if patient_profile else None
        
        if not patient_user:
            continue
            
        completed_apps = [a for a in apps if a.status == "completada"]
        last_appt = completed_apps[0] if completed_apps else apps[0]
        
        patients_data.append({
            "id": pid,
            "name": patient_user.full_name,
            "email": patient_user.email,
            "age": patient_profile.age if patient_profile else 0,
            "condition": patient_profile.condition if patient_profile else "Ninguna",
            "lastVisit": last_appt.date_time.strftime("%d %b") if last_appt else "Reciente",
            "status": getattr(patient_profile, "risk_status", "estable") if patient_profile else "estable",
            "avatar": patient_user.avatar
        })

    return patients_data


@router.get("/patient/{patient_id}/history")
def get_patient_history(
    patient_id: int,
    current_user: models.User = Depends(RoleChecker(["doctor"])),
    db: Session = Depends(get_db)
):
    """Devuelve el historial clínico de un paciente específico, para un médico autorizado."""
    has_treated = db.query(models.Appointment).filter(
        models.Appointment.doctor_id == current_user.id,
        models.Appointment.patient_id == patient_id
    ).first()
    
    if not has_treated:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes autorización para ver el historial de este paciente."
        )
        
    histories = db.query(models.ClinicalHistory).options(
        joinedload(models.ClinicalHistory.doctor).joinedload(models.Doctor.user)
    ).filter(
        models.ClinicalHistory.patient_id == patient_id
    ).order_by(models.ClinicalHistory.date.desc()).all()
    
    result = []
    for h in histories:
        doc = h.doctor.user if h.doctor and h.doctor.user else None
        result.append({
            "id": h.id,
            "date": (h.date - datetime.timedelta(hours=4)).isoformat(),
            "doctor_name": doc.full_name if doc else "Doctor",
            "summary_ia": h.summary_ia,
            "translation_text": h.translation_text
        })
        
    return result


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

@router.get("/doctor/{doctor_id}/booked-slots", response_model=List[str])
def get_doctor_booked_slots(
    doctor_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(RoleChecker(["patient", "doctor"]))
):
    """Devuelve las fechas/horas ocupadas (ISO string) para un doctor específico."""
    appointments = db.query(models.Appointment).filter(
        models.Appointment.doctor_id == doctor_id,
        models.Appointment.status.in_(["pendiente", "confirmada"])
    ).all()
    
    # Retornar las fechas en formato ISO string
    booked_slots = [
        app.date_time.isoformat() if hasattr(app.date_time, 'isoformat') else str(app.date_time) 
        for app in appointments
    ]
    return booked_slots

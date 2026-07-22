from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.routers.auth import get_current_user
from app import models, schemas

router = APIRouter(
    prefix="/api/invitations",
    tags=["Invitations"]
)

@router.get("/search-patient", response_model=List[schemas.PatientSearchResponse])
def search_patient(name: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    Busca pacientes por su nombre completo exacto (privacidad).
    """
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can search patients")
        
    # Búsqueda exacta (case insensitive, pero exacta en contenido)
    patients = db.query(models.User).join(models.Patient).filter(
        models.User.role == "patient",
        models.User.full_name.ilike(name)
    ).all()
    
    results = []
    for p in patients:
        existing_invite = db.query(models.DoctorPatientInvitation).filter(
            models.DoctorPatientInvitation.doctor_id == current_user.id,
            models.DoctorPatientInvitation.patient_id == p.patient_profile.id,
            models.DoctorPatientInvitation.status == "pending"
        ).first()

        existing_link = db.query(models.DoctorPatientLink).filter(
            models.DoctorPatientLink.doctor_id == current_user.id,
            models.DoctorPatientLink.patient_id == p.patient_profile.id
        ).first()

        inv_status = "none"
        if existing_link:
            inv_status = "accepted"
        elif existing_invite:
            inv_status = "pending"

        results.append({
            "id": p.patient_profile.id,
            "full_name": p.full_name,
            "email": p.email,
            "avatar": p.avatar,
            "age": p.patient_profile.age,
            "status": inv_status
        })
    return results

@router.post("/send", response_model=schemas.InvitationResponse)
def send_invitation(invite: schemas.InvitationCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    Envía una invitación de un doctor a un paciente.
    """
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can send invitations")
        
    # Check if already linked
    existing_link = db.query(models.DoctorPatientLink).filter(
        models.DoctorPatientLink.doctor_id == current_user.id,
        models.DoctorPatientLink.patient_id == invite.patient_id
    ).first()
    if existing_link:
        raise HTTPException(status_code=400, detail="Patient is already linked to this doctor")

    # Check if pending invite exists
    existing_invite = db.query(models.DoctorPatientInvitation).filter(
        models.DoctorPatientInvitation.doctor_id == current_user.id,
        models.DoctorPatientInvitation.patient_id == invite.patient_id,
        models.DoctorPatientInvitation.status == "pending"
    ).first()
    if existing_invite:
        raise HTTPException(status_code=400, detail="An invitation is already pending")
        
    new_invite = models.DoctorPatientInvitation(
        doctor_id=current_user.id,
        patient_id=invite.patient_id,
        status="pending"
    )
    db.add(new_invite)
    db.commit()
    db.refresh(new_invite)
    
    return {
        "id": new_invite.id,
        "doctor_id": new_invite.doctor_id,
        "patient_id": new_invite.patient_id,
        "status": new_invite.status,
        "created_at": new_invite.created_at
    }

@router.get("/my-invitations", response_model=List[schemas.InvitationResponse])
def get_my_invitations(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    Lista las invitaciones pendientes para el paciente actual.
    """
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Only patients can view their invitations")
        
    invitations = db.query(models.DoctorPatientInvitation).filter(
        models.DoctorPatientInvitation.patient_id == current_user.id,
        models.DoctorPatientInvitation.status == "pending"
    ).all()
    
    results = []
    for inv in invitations:
        doctor_user = db.query(models.User).filter(models.User.id == inv.doctor_id).first()
        results.append({
            "id": inv.id,
            "doctor_id": inv.doctor_id,
            "patient_id": inv.patient_id,
            "status": inv.status,
            "created_at": inv.created_at,
            "doctor_name": doctor_user.full_name if doctor_user else "Unknown Doctor",
            "doctor_avatar": doctor_user.avatar if doctor_user else None,
            "doctor_specialty": doctor_user.doctor_profile.specialty if doctor_user and doctor_user.doctor_profile else "General"
        })
    return results

@router.post("/{invite_id}/accept")
def accept_invitation(invite_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    Acepta una invitación y crea el vínculo.
    """
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Only patients can accept invitations")
        
    invite = db.query(models.DoctorPatientInvitation).filter(
        models.DoctorPatientInvitation.id == invite_id,
        models.DoctorPatientInvitation.patient_id == current_user.id
    ).first()
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invitation not found")
        
    if invite.status != "pending":
        raise HTTPException(status_code=400, detail="Invitation is not pending")
        
    invite.status = "accepted"
    
    # Create the link
    link = models.DoctorPatientLink(
        doctor_id=invite.doctor_id,
        patient_id=invite.patient_id
    )
    db.add(link)
    db.commit()
    
    return {"message": "Invitation accepted successfully"}

@router.post("/{invite_id}/reject")
def reject_invitation(invite_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    Rechaza una invitación.
    """
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Only patients can reject invitations")
        
    invite = db.query(models.DoctorPatientInvitation).filter(
        models.DoctorPatientInvitation.id == invite_id,
        models.DoctorPatientInvitation.patient_id == current_user.id
    ).first()
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invitation not found")
        
    invite.status = "rejected"
    db.commit()
    
    return {"message": "Invitation rejected successfully"}


@router.get("/my-patients", response_model=List[schemas.PatientResponse])
def get_my_patients(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    Lista los pacientes que han aceptado la invitación del doctor actual.
    """
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can view their patients")
        
    links = db.query(models.DoctorPatientLink).filter(
        models.DoctorPatientLink.doctor_id == current_user.id
    ).all()
    
    results = []
    for link in links:
        patient_user = db.query(models.User).filter(models.User.id == link.patient_id).first()
        if patient_user and patient_user.patient_profile:
            results.append({
                "id": patient_user.patient_profile.id,
                "age": patient_user.patient_profile.age,
                "condition": patient_user.patient_profile.condition,
                "avatar": patient_user.avatar,
                "lat": patient_user.patient_profile.lat,
                "lon": patient_user.patient_profile.lon,
                "full_name": patient_user.full_name,
                "email": patient_user.email
            })
    return results


@router.get("/my-doctors", response_model=List[schemas.DoctorResponse])
def get_my_doctors(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    Lista los médicos vinculados al paciente actual.
    """
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Only patients can view their doctors")
        
    links = db.query(models.DoctorPatientLink).filter(
        models.DoctorPatientLink.patient_id == current_user.id
    ).all()
    
    results = []
    for link in links:
        doc_user = db.query(models.User).filter(models.User.id == link.doctor_id).first()
        if doc_user and doc_user.doctor_profile:
            results.append({
                "id": doc_user.doctor_profile.id,
                "specialty": doc_user.doctor_profile.specialty,
                "room_state": doc_user.doctor_profile.room_state,
                "lat": doc_user.doctor_profile.lat,
                "lon": doc_user.doctor_profile.lon,
                "full_name": doc_user.full_name,
                "email": doc_user.email
            })
    return results


@router.get("/all-notifications")
def get_all_notifications(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    Devuelve las notificaciones en tiempo real para el usuario actual (Paciente, Médico o Farmacia).
    """
    notifications_list = []
    
    if current_user.role == "patient":
        # 1. Invitaciones pendientes de médicos
        invitations = db.query(models.DoctorPatientInvitation).filter(
            models.DoctorPatientInvitation.patient_id == current_user.id,
            models.DoctorPatientInvitation.status == "pending"
        ).all()
        for inv in invitations:
            doc_user = db.query(models.User).filter(models.User.id == inv.doctor_id).first()
            specialty = doc_user.doctor_profile.specialty if doc_user and doc_user.doctor_profile else "Medicina General"
            notifications_list.append({
                "id": f"inv-{inv.id}",
                "raw_id": inv.id,
                "type": "invitation",
                "title": doc_user.full_name if doc_user else "Médico",
                "sender_name": doc_user.full_name if doc_user else "Doctor",
                "text": f"El {doc_user.full_name if doc_user else 'Doctor'} ({specialty}) quiere agregarte a su lista de pacientes.",
                "avatar": doc_user.avatar if doc_user else None,
                "created_at": inv.created_at.isoformat()
            })

        # 2. Recetas médicas emitidas al paciente
        prescriptions = db.query(models.Prescription).filter(
            models.Prescription.patient_id == current_user.id,
            models.Prescription.status == "activa"
        ).order_by(models.Prescription.issued_at.desc()).all()

        for rx in prescriptions:
            doc_user = db.query(models.User).filter(models.User.id == rx.doctor_id).first()
            doc_name = doc_user.full_name if doc_user else "Tu médico"
            notifications_list.append({
                "id": f"rx-pat-{rx.id}",
                "type": "info",
                "title": "Nueva Receta Médica 💊",
                "sender_name": doc_name,
                "text": f"El {doc_name} te ha recetado {rx.medicine} ({rx.dose}).",
                "avatar": doc_user.avatar if doc_user else None,
                "created_at": rx.issued_at.isoformat()
            })

        # 3. Citas confirmadas o agendadas por médicos
        patient_apps = db.query(models.Appointment).filter(
            models.Appointment.patient_id == current_user.id,
            models.Appointment.status.in_(["confirmada", "pendiente"])
        ).order_by(models.Appointment.date_time.asc()).all()

        for app in patient_apps:
            doc_user = db.query(models.User).filter(models.User.id == app.doctor_id).first()
            doc_name = doc_user.full_name if doc_user else "Tu médico"
            date_str = app.date_time.strftime("%d/%m %H:%M")
            st_text = "confirmado" if app.status == "confirmada" else "solicitado"
            notifications_list.append({
                "id": f"app-pat-{app.id}",
                "type": "info",
                "title": f"Cita Médica ({app.type})",
                "sender_name": doc_name,
                "text": f"Has {st_text} una cita con el {doc_name} para el {date_str}. Motivo: {app.reason or 'Sin especificar'}.",
                "avatar": doc_user.avatar if doc_user else None,
                "created_at": app.date_time.isoformat()
            })

    elif current_user.role == "doctor":
        # 1. Pacientes que han aceptado invitaciones recientemente
        accepted_invites = db.query(models.DoctorPatientInvitation).filter(
            models.DoctorPatientInvitation.doctor_id == current_user.id,
            models.DoctorPatientInvitation.status == "accepted"
        ).all()
        for inv in accepted_invites:
            pat_user = db.query(models.User).filter(models.User.id == inv.patient_id).first()
            pat_name = pat_user.full_name if pat_user else "Paciente"
            notifications_list.append({
                "id": f"acc-{inv.id}",
                "type": "info",
                "title": "Invitación Aceptada",
                "sender_name": pat_name,
                "text": f"El paciente {pat_name} ha aceptado tu solicitud de vinculación.",
                "avatar": pat_user.avatar if pat_user else None,
                "created_at": inv.created_at.isoformat()
            })

        # 2. Solicitudes de citas pendientes de pacientes
        pending_apps = db.query(models.Appointment).filter(
            models.Appointment.doctor_id == current_user.id,
            models.Appointment.status == "pendiente"
        ).order_by(models.Appointment.date_time.asc()).all()

        for app in pending_apps:
            pat_user = db.query(models.User).filter(models.User.id == app.patient_id).first()
            pat_name = pat_user.full_name if pat_user else "Paciente"
            date_str = app.date_time.strftime("%d/%m %H:%M")
            notifications_list.append({
                "id": f"app-req-{app.id}",
                "raw_id": app.id,
                "type": "appointment_request",
                "title": f"Solicitud de Cita",
                "sender_name": pat_name,
                "text": f"El paciente {pat_name} solicita cita ({app.type}) para el {date_str}. Motivo: {app.reason or 'Sin especificar'}.",
                "avatar": pat_user.avatar if pat_user else None,
                "created_at": app.date_time.isoformat()
            })
            
        # 2. Citas del médico
        appointments = db.query(models.Appointment).filter(
            models.Appointment.doctor_id == current_user.id
        ).all()
        if appointments:
            notifications_list.append({
                "id": "app-summary",
                "type": "info",
                "title": "Agenda Médica",
                "sender_name": "Agenda",
                "text": f"Tienes {len(appointments)} citas agendadas en la plataforma.",
                "avatar": None,
                "created_at": ""
            })
            
    elif current_user.role == "pharmacy":
        # 1. Recetas activas entrantes
        prescriptions = db.query(models.Prescription).filter(
            models.Prescription.status == "activa"
        ).all()
        for rx in prescriptions[:5]:  # Muestra las últimas 5 recetas activas
            pat_user = db.query(models.User).filter(models.User.id == rx.patient_id).first()
            pat_name = pat_user.full_name if pat_user else "Paciente"
            notifications_list.append({
                "id": f"rx-{rx.id}",
                "type": "info",
                "title": f"Receta #{rx.id}",
                "sender_name": pat_name,
                "text": f"Receta de {rx.medicine} para {pat_name}.",
                "avatar": pat_user.avatar if pat_user else None,
                "created_at": rx.issued_at.isoformat()
            })
            
        # 2. Pedidos a proveedores
        orders = db.query(models.SupplierOrder).all()
        for ord in orders[:2]:
            notifications_list.append({
                "id": f"ord-{ord.id}",
                "type": "info",
                "title": f"Pedido {ord.id}",
                "text": f"Proveedor {ord.supplier} - Estado: {ord.status}.",
                "avatar": None,
                "created_at": ord.created_at.isoformat()
            })

    return notifications_list

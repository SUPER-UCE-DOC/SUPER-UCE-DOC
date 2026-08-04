from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.group_b_models import PatientPharmacySelection
from app.routers.auth import RoleChecker


router = APIRouter(tags=["group-b-pharmacies"])


class PharmacyAccountLinkRequest(BaseModel):
    business_name: str
    address: str
    phone: str
    lat: float
    lon: float
    rnc: Optional[str] = None
    health_license: Optional[str] = None
    pharmacist_name: Optional[str] = None


class PharmacyAccountLinkResponse(BaseModel):
    message: str
    pharmacy_id: int
    user_id: int
    business_name: str
    email: str


class PharmacySelectionResponse(BaseModel):
    patient_id: int
    pharmacy_id: int
    business_name: str
    address: str
    phone: str
    email: str
    selected_at: str
    updated_at: str


def _selection_response(selection, pharmacy):
    return PharmacySelectionResponse(
        patient_id=selection.patient_id,
        pharmacy_id=pharmacy.id,
        business_name=pharmacy.business_name,
        address=pharmacy.address,
        phone=pharmacy.phone,
        email=pharmacy.user.email,
        selected_at=selection.selected_at.isoformat(),
        updated_at=selection.updated_at.isoformat(),
    )


@router.post(
    "/api/pharmacy-links/me",
    response_model=PharmacyAccountLinkResponse,
    status_code=status.HTTP_200_OK,
)
def link_existing_pharmacy_account(
    payload: PharmacyAccountLinkRequest,
    current_user: models.User = Depends(RoleChecker(["pharmacy"])),
    db: Session = Depends(get_db),
):
    """Vincula una cuenta existente con rol farmacia a su perfil de farmacia."""

    pharmacy = db.query(models.Pharmacy).filter(
        models.Pharmacy.id == current_user.id
    ).first()

    if pharmacy is None:
        pharmacy = models.Pharmacy(
            id=current_user.id,
            business_name=payload.business_name,
            rnc=payload.rnc,
            health_license=payload.health_license,
            pharmacist_name=payload.pharmacist_name,
            lat=payload.lat,
            lon=payload.lon,
            address=payload.address,
            phone=payload.phone,
        )
        db.add(pharmacy)
        message = "Cuenta de farmacia vinculada correctamente."
    else:
        pharmacy.business_name = payload.business_name
        pharmacy.rnc = payload.rnc
        pharmacy.health_license = payload.health_license
        pharmacy.pharmacist_name = payload.pharmacist_name
        pharmacy.lat = payload.lat
        pharmacy.lon = payload.lon
        pharmacy.address = payload.address
        pharmacy.phone = payload.phone
        message = "La cuenta ya estaba vinculada y su perfil fue actualizado."

    db.commit()
    db.refresh(pharmacy)

    return PharmacyAccountLinkResponse(
        message=message,
        pharmacy_id=pharmacy.id,
        user_id=current_user.id,
        business_name=pharmacy.business_name,
        email=current_user.email,
    )


@router.get(
    "/api/pharmacy-links/me",
    response_model=PharmacyAccountLinkResponse,
)
def get_linked_pharmacy_account(
    current_user: models.User = Depends(RoleChecker(["pharmacy"])),
    db: Session = Depends(get_db),
):
    pharmacy = db.query(models.Pharmacy).filter(
        models.Pharmacy.id == current_user.id
    ).first()

    if pharmacy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La cuenta todavía no está vinculada a un perfil de farmacia.",
        )

    return PharmacyAccountLinkResponse(
        message="Cuenta de farmacia vinculada.",
        pharmacy_id=pharmacy.id,
        user_id=current_user.id,
        business_name=pharmacy.business_name,
        email=current_user.email,
    )


@router.put(
    "/api/pharmacy-selection/{pharmacy_id}",
    response_model=PharmacySelectionResponse,
)
def select_pharmacy(
    pharmacy_id: int,
    current_user: models.User = Depends(RoleChecker(["patient"])),
    db: Session = Depends(get_db),
):
    """Selecciona o cambia la farmacia preferida del paciente autenticado."""

    patient = db.query(models.Patient).filter(
        models.Patient.id == current_user.id
    ).first()
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró el perfil del paciente autenticado.",
        )

    pharmacy = db.query(models.Pharmacy).filter(
        models.Pharmacy.id == pharmacy_id
    ).first()
    if pharmacy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La farmacia seleccionada no existe o no está vinculada.",
        )

    selection = db.query(PatientPharmacySelection).filter(
        PatientPharmacySelection.patient_id == current_user.id
    ).first()

    if selection is None:
        selection = PatientPharmacySelection(
            patient_id=current_user.id,
            pharmacy_id=pharmacy_id,
        )
        db.add(selection)
    else:
        selection.pharmacy_id = pharmacy_id

    db.commit()
    db.refresh(selection)

    return _selection_response(selection, pharmacy)


@router.get(
    "/api/pharmacy-selection",
    response_model=PharmacySelectionResponse,
)
def get_selected_pharmacy(
    current_user: models.User = Depends(RoleChecker(["patient"])),
    db: Session = Depends(get_db),
):
    """Consulta la farmacia actualmente seleccionada por el paciente."""

    selection = db.query(PatientPharmacySelection).filter(
        PatientPharmacySelection.patient_id == current_user.id
    ).first()

    if selection is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El paciente todavía no ha seleccionado una farmacia.",
        )

    pharmacy = db.query(models.Pharmacy).filter(
        models.Pharmacy.id == selection.pharmacy_id
    ).first()
    if pharmacy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La farmacia seleccionada ya no está disponible.",
        )

    return _selection_response(selection, pharmacy)

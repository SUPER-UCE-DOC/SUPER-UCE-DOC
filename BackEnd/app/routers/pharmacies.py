import math
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
import uuid

from app.database import get_db
from app import models, schemas
from app.routers.auth import get_current_user, RoleChecker

router = APIRouter(prefix="/api/pharmacies", tags=["pharmacies"])

def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calcula la distancia radial en metros entre dos puntos geográficos (Haversine).
    """
    R = 6371000  # Radio de la Tierra en metros
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0)**2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


@router.get("", response_model=List[schemas.PharmacyResponse])
def get_all_pharmacies(db: Session = Depends(get_db)):
    pharmacies = db.query(models.Pharmacy).all()
    response = []
    for ph in pharmacies:
        response.append(
            schemas.PharmacyResponse(
                id=ph.id,
                business_name=ph.business_name,
                lat=ph.lat,
                lon=ph.lon,
                address=ph.address,
                phone=ph.phone,
                full_name=ph.user.full_name,
                email=ph.user.email
            )
        )
    return response


@router.get("/nearby")
def get_nearby_pharmacies(
    lat: float,
    lon: float,
    medicine: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Busca farmacias dentro del rango de 2km (2000m).
    Utiliza PostGIS en PostgreSQL o cálculo en Python (Haversine) como fallback.
    """
    is_postgres = "postgresql" in str(db.bind.url)
    nearby_pharmacies = []

    if is_postgres:
        # Consulta SQL nativa para PostGIS
        # Buscamos farmacias a menos de 2000 metros (2 km)
        sql = """
        SELECT p.id, p.business_name, p.address, p.phone, p.lat, p.lon, u.full_name, u.email,
               ST_Distance(
                   ST_SetSRID(ST_MakePoint(p.lon, p.lat), 4326)::geography,
                   ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
               ) as distance
        FROM pharmacies p
        JOIN users u ON p.id = u.id
        WHERE ST_DWithin(
            ST_SetSRID(ST_MakePoint(p.lon, p.lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
            2000
        )
        ORDER BY distance ASC;
        """
        results = db.execute(text(sql), {"lat": lat, "lon": lon}).fetchall()
        for row in results:
            nearby_pharmacies.append({
                "id": row.id,
                "name": row.business_name,
                "address": row.address,
                "phone": row.phone,
                "lat": row.lat,
                "lon": row.lon,
                "distance": round(row.distance / 1000.0, 2),  # km
                "has_stock": False
            })
    else:
        # Fallback local usando Python (SQLite/Desarrollo)
        pharmacies = db.query(models.Pharmacy).all()
        for ph in pharmacies:
            dist = haversine_distance(lat, lon, ph.lat, ph.lon)
            if dist <= 2000.0:  # 2 km
                nearby_pharmacies.append({
                    "id": ph.id,
                    "name": ph.business_name,
                    "address": ph.address,
                    "phone": ph.phone,
                    "lat": ph.lat,
                    "lon": ph.lon,
                    "distance": round(dist / 1000.0, 2),  # km
                    "has_stock": False
                })

    # Si se especificó un medicamento, verificar stock inteligente
    for ph_info in nearby_pharmacies:
        if medicine:
            clean_query = medicine.strip().lower()
            main_token = clean_query.split()[0] if clean_query else clean_query

            inv = db.query(models.PharmacyInventory).filter(
                models.PharmacyInventory.pharmacy_id == ph_info["id"],
                or_(
                    models.PharmacyInventory.medicine.ilike(f"%{clean_query}%"),
                    models.PharmacyInventory.medicine.ilike(f"%{main_token}%")
                )
            ).first()
            ph_info["has_stock"] = (inv is not None and inv.stock > 0)
        else:
            ph_info["has_stock"] = True

    return nearby_pharmacies


# --- Inventario ---
@router.get("/{pharmacy_id}/inventory", response_model=List[schemas.InventoryItemResponse])
def get_inventory(pharmacy_id: int, db: Session = Depends(get_db)):
    items = db.query(models.PharmacyInventory).filter(models.PharmacyInventory.pharmacy_id == pharmacy_id).all()
    return items


@router.post("/inventory", response_model=schemas.InventoryItemResponse)
def update_inventory_item(
    item_in: schemas.InventoryItemCreate,
    current_user: models.User = Depends(RoleChecker(["pharmacy"])),
    db: Session = Depends(get_db)
):
    # Buscar si ya existe
    item = db.query(models.PharmacyInventory).filter(
        models.PharmacyInventory.pharmacy_id == current_user.id,
        models.PharmacyInventory.medicine.ilike(item_in.medicine)
    ).first()

    if item:
        item.stock = item_in.stock
    else:
        item = models.PharmacyInventory(
            pharmacy_id=current_user.id,
            medicine=item_in.medicine,
            stock=item_in.stock
        )
        db.add(item)
    
    db.commit()
    db.refresh(item)
    return item


# --- Pedidos a Proveedores ---
@router.post("/orders", response_model=schemas.SupplierOrderResponse)
def create_supplier_order(
    order_in: schemas.SupplierOrderCreate,
    current_user: models.User = Depends(RoleChecker(["pharmacy"])),
    db: Session = Depends(get_db)
):
    order_id = f"ORD-{str(uuid.uuid4().int)[:4]}"
    new_order = models.SupplierOrder(
        id=order_id,
        pharmacy_id=current_user.id,
        supplier=order_in.supplier,
        items=",".join(order_in.items),
        total=order_in.total,
        estimated_delivery=order_in.estimated_delivery,
        status="borrador"
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    return new_order


@router.get("/orders", response_model=List[schemas.SupplierOrderResponse])
def get_supplier_orders(
    current_user: models.User = Depends(RoleChecker(["pharmacy"])),
    db: Session = Depends(get_db)
):
    orders = db.query(models.SupplierOrder).filter(models.SupplierOrder.pharmacy_id == current_user.id).all()
    return orders


@router.put("/orders/{id}/status", response_model=schemas.SupplierOrderResponse)
def update_order_status(
    id: str,
    status_update: schemas.SupplierOrderStatusUpdate,
    current_user: models.User = Depends(RoleChecker(["pharmacy"])),
    db: Session = Depends(get_db)
):
    order = db.query(models.SupplierOrder).filter(
        models.SupplierOrder.id == id,
        models.SupplierOrder.pharmacy_id == current_user.id
    ).first()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido al proveedor no encontrado."
        )

    # Si pasa a recibido, agregamos automáticamente los artículos al inventario
    if status_update.status == "recibido" and order.status != "recibido":
        items = order.items.split(",")
        for raw_item in items:
            # item format: "Name ×Amount" (e.g. Losartán 50mg ×500u)
            try:
                if "×" in raw_item:
                    med, qty_str = raw_item.split("×")
                    qty = int(qty_str.replace("u", "").strip())
                    med = med.strip()
                else:
                    med = raw_item.strip()
                    qty = 100 # default amount if not parsed
                
                # Update inventory
                inv = db.query(models.PharmacyInventory).filter(
                    models.PharmacyInventory.pharmacy_id == current_user.id,
                    models.PharmacyInventory.medicine.ilike(med)
                ).first()
                if inv:
                    inv.stock += qty
                else:
                    new_inv = models.PharmacyInventory(
                        pharmacy_id=current_user.id,
                        medicine=med,
                        stock=qty
                    )
                    db.add(new_inv)
            except Exception:
                # Si falla parseo de un item, continuar
                pass

    order.status = status_update.status
    db.commit()
    db.refresh(order)
    return order


@router.get("/stats")
def get_pharmacy_stats(
    current_user: models.User = Depends(RoleChecker(["pharmacy"])),
    db: Session = Depends(get_db)
):
    # 1. Total Inversión en Pedidos a Proveedores
    orders = db.query(models.SupplierOrder).filter(models.SupplierOrder.pharmacy_id == current_user.id).all()
    total_spent = sum(o.total for o in orders)
    
    # 2. Total Recetas Despachadas
    dispatched_prescriptions = db.query(models.Prescription).filter(
        models.Prescription.status == "despachada"
    ).count()

    # 3. Total Productos e Ítems en Inventario
    inventory_items = db.query(models.PharmacyInventory).filter(models.PharmacyInventory.pharmacy_id == current_user.id).all()
    total_inventory_products = len(inventory_items)
    total_stock_units = sum(i.stock for i in inventory_items)
    low_stock_count = sum(1 for i in inventory_items if i.stock < 100)
    out_of_stock_count = sum(1 for i in inventory_items if i.stock == 0)

    # 4. Flujo de actividad por día de la semana
    days_map = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
    days_counts = {d: 0 for d in days_map}

    for order in orders:
        if hasattr(order, "created_at") and order.created_at:
            w = order.created_at.weekday()
            if 0 <= w <= 6:
                days_counts[days_map[w]] += 1

    weekly_flow = [{"day": d, "value": days_counts[d]} for d in days_map]

    return {
        "total_spent": total_spent,
        "dispatched_prescriptions": dispatched_prescriptions,
        "total_inventory_products": total_inventory_products,
        "total_stock_units": total_stock_units,
        "low_stock_count": low_stock_count,
        "out_of_stock_count": out_of_stock_count,
        "total_orders_count": len(orders),
        "weekly_flow": weekly_flow
    }

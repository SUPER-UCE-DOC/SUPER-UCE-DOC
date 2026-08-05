import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, Base
import app.models  # Asegura que todos los modelos estén registrados

def reset_entire_database():
    print("Vaciando completamente la base de datos (borrando todos los datos y todas las cuentas registradas)...")
    try:
        # Eliminar todas las tablas existente
        Base.metadata.drop_all(bind=engine)
        print(" -> Tablas eliminadas correctamente.")
        
        # Recrear la estructura completa limpia
        Base.metadata.create_all(bind=engine)
        print(" -> Estrcutura de tablas recreada totalmente limpia.")
        
        print("¡Proceso completado con éxito! La base de datos y todas las cuentas están 100% vacías.")
    except Exception as e:
        print(f"Error al reiniciar la base de datos: {e}")

if __name__ == "__main__":
    reset_entire_database()

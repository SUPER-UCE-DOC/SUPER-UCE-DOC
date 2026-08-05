import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, Base
from app.models import Appointment, ClinicalHistory, Prescription

print("Dropping tables...")
try:
    Prescription.__table__.drop(engine)
except Exception as e:
    print(f"Error dropping Prescription: {e}")

try:
    ClinicalHistory.__table__.drop(engine)
except Exception as e:
    print(f"Error dropping ClinicalHistory: {e}")

try:
    Appointment.__table__.drop(engine)
except Exception as e:
    print(f"Error dropping Appointment: {e}")

print("Recreating tables...")
Base.metadata.create_all(engine)
print("Done!")

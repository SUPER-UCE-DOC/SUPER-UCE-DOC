import requests
import time
from jose import jwt
import os
from dotenv import load_dotenv

load_dotenv('/var/www/super-uce-doc/BackEnd/.env')
SECRET_KEY = os.getenv("SECRET_KEY")

from sqlalchemy import create_engine
from sqlalchemy.sql import text

DB_URL = os.getenv("DATABASE_URL")
engine = create_engine(DB_URL)
conn = engine.connect()

users = conn.execute(text("SELECT id, email, role FROM users LIMIT 1")).fetchall()
if not users:
    print("No users found!")
    exit(1)

user = users[0]
print(f"Testing with user: {user.email} (Role: {user.role})")

to_encode = {"sub": user.email, "role": user.role}
token = jwt.encode(to_encode, SECRET_KEY, algorithm="HS256")

headers = {"Authorization": f"Bearer {token}"}

endpoints = [
    "/api/auth/me",
    "/api/appointments",
    "/api/appointments/waiting-room",
    "/api/invitations/my-invitations"
]

for ep in endpoints:
    url = f"http://localhost:8000{ep}"
    print(f"\nTesting endpoint: {ep}")
    start = time.time()
    res = requests.get(url, headers=headers)
    req_time = time.time() - start
    print(f"Response code: {res.status_code}")
    print(f"Time taken: {req_time:.4f} seconds")

conn.close()

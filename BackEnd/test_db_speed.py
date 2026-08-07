import time
from sqlalchemy import create_engine
from sqlalchemy.sql import text
import os
from dotenv import load_dotenv

load_dotenv('/var/www/super-uce-doc/BackEnd/.env')
DB_URL = os.getenv("DATABASE_URL")

print("Testing connection to:", DB_URL)

start = time.time()
engine = create_engine(DB_URL)
conn = engine.connect()
conn_time = time.time() - start
print(f"Connection time: {conn_time:.4f} seconds")

start = time.time()
res = conn.execute(text("SELECT 1")).scalar()
query1_time = time.time() - start
print(f"Query 'SELECT 1' time: {query1_time:.4f} seconds")

start = time.time()
res = conn.execute(text("SELECT * FROM users LIMIT 5")).fetchall()
query2_time = time.time() - start
print(f"Query 'SELECT * FROM users' time: {query2_time:.4f} seconds")

conn.close()

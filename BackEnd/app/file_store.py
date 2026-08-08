import json
import os
import fcntl

STORE_DIR = "/tmp/super_uce_doc_store"
os.makedirs(STORE_DIR, exist_ok=True)

def _get_path(store_name, room_id):
    return os.path.join(STORE_DIR, f"{store_name}_{room_id}.json")

def read_store(store_name, room_id, default=None):
    if default is None:
        default = []
    path = _get_path(store_name, room_id)
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r") as f:
            fcntl.flock(f, fcntl.LOCK_SH)
            data = json.load(f)
            fcntl.flock(f, fcntl.LOCK_UN)
            return data
    except Exception:
        return default

def append_to_store(store_name, room_id, item):
    path = _get_path(store_name, room_id)
    try:
        # We need to lock the file to read, append, and write safely
        with open(path, "a+") as f:
            fcntl.flock(f, fcntl.LOCK_EX)
            f.seek(0)
            content = f.read()
            if content:
                data = json.loads(content)
            else:
                data = []
            
            # If item is a dict and we need an auto-incrementing ID
            if isinstance(item, dict) and "id" not in item:
                item["id"] = len(data) + 1
            elif isinstance(item, dict) and item.get("id") == "auto":
                item["id"] = len(data) + 1
                
            data.append(item)
            f.seek(0)
            f.truncate()
            json.dump(data, f)
            fcntl.flock(f, fcntl.LOCK_UN)
            return data
    except Exception as e:
        print(f"Error appending to store {store_name}: {e}")
        return []

def clear_store(store_name, room_id):
    path = _get_path(store_name, room_id)
    if os.path.exists(path):
        try:
            os.remove(path)
        except:
            pass

def update_dict_store(store_name, room_id, key, value):
    path = _get_path(store_name, room_id)
    try:
        with open(path, "a+") as f:
            fcntl.flock(f, fcntl.LOCK_EX)
            f.seek(0)
            content = f.read()
            if content:
                data = json.loads(content)
            else:
                data = {}
            data[key] = value
            f.seek(0)
            f.truncate()
            json.dump(data, f)
            fcntl.flock(f, fcntl.LOCK_UN)
            return data
    except Exception:
        return {}

def read_dict_store(store_name, room_id, default=None):
    if default is None:
        default = {}
    path = _get_path(store_name, room_id)
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r") as f:
            fcntl.flock(f, fcntl.LOCK_SH)
            data = json.load(f)
            fcntl.flock(f, fcntl.LOCK_UN)
            return data
    except Exception:
        return default

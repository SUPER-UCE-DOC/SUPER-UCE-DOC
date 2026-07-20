import sqlite3

def run_migration():
    conn = sqlite3.connect('super_uce_doc.db')
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN avatar VARCHAR;")
        print("Column 'avatar' added successfully to 'users' table.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("Column 'avatar' already exists.")
        else:
            print(f"Error adding column: {e}")
            
    conn.commit()
    conn.close()

if __name__ == '__main__':
    run_migration()

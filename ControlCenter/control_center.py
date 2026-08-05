#!/usr/bin/env python3
"""
===============================================================================
 SUPER-UCE DOC - Centro de Control Multiplataforma (Windows & Linux Ubuntu)
===============================================================================
 Aplicación gráfica de administración y control del servidor, base de datos y
 despliegue en la nube para la plataforma médica SUPER-UCE DOC.
===============================================================================
"""

import os
import sys
import platform
import subprocess
import threading
import time
import requests
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext

# Cargar variables de entorno desde BackEnd/.env si existe
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
BACKEND_ENV = os.path.join(ROOT_DIR, "BackEnd", ".env")

def load_env_vars():
    env_vars = {}
    if os.path.exists(BACKEND_ENV):
        with open(BACKEND_ENV, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env_vars[k.strip()] = v.strip()
    return env_vars

ENV_VARS = load_env_vars()
DATABASE_URL = ENV_VARS.get("DATABASE_URL", os.getenv("DATABASE_URL", ""))

# Importar SQLAlchemy / psycopg2 para la BD
DB_AVAILABLE = False
try:
    from sqlalchemy import create_engine, text, inspect
    if DATABASE_URL:
        db_uri = DATABASE_URL
        if db_uri.startswith("postgres://"):
            db_uri = db_uri.replace("postgres://", "postgresql+psycopg2://", 1)
        engine = create_engine(db_uri, pool_pre_ping=True)
        DB_AVAILABLE = True
except Exception as e:
    print(f"[Warning] No se pudo inicializar la conexión a la Base de Datos: {e}")

class ControlCenterApp:
    def __init__(self, root):
        self.root = root
        self.root.title("🏥 SUPER-UCE DOC - Centro de Control Multiplataforma")
        self.root.geometry("1100x750")
        self.root.minsize(950, 600)

        self.is_linux = platform.system() == "Linux"
        self.is_windows = platform.system() == "Windows"
        self.log_streaming = True
        self.log_process = None

        # Estilo temático oscuro profesional
        self.setup_styles()

        # Contenedor Principal
        self.main_container = ttk.Frame(self.root, style="Main.TFrame")
        self.main_container.pack(fill=tk.BOTH, expand=True)

        # Encabezado Superior
        self.create_header()

        # Notebook / Pestañas
        self.notebook = ttk.Notebook(self.main_container)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=15, pady=10)

        # Pestaña 1: Control de Servidores
        self.tab_server = ttk.Frame(self.notebook, style="Card.TFrame")
        self.notebook.add(self.tab_server, text=" ⚙️ Servidor & Operaciones ")
        self.setup_tab_server()

        # Pestaña 2: Gestión de Usuarios y Roles
        self.tab_users = ttk.Frame(self.notebook, style="Card.TFrame")
        self.notebook.add(self.tab_users, text=" 👥 Usuarios y Roles ")
        self.setup_tab_users()

        # Pestaña 3: Explorador de Base de Datos
        self.tab_db = ttk.Frame(self.notebook, style="Card.TFrame")
        self.notebook.add(self.tab_db, text=" 🗄️ Base de Datos (Supabase) ")
        self.setup_tab_db()

        # Pestaña 4: Monitor de Salud del Sistema
        self.tab_health = ttk.Frame(self.notebook, style="Card.TFrame")
        self.notebook.add(self.tab_health, text=" 🟢 Salud del Sistema ")
        self.setup_tab_health()

        # Cargar datos iniciales y streaming de logs
        self.refresh_health_status()
        if DB_AVAILABLE:
            self.load_users_data()

        # Iniciar transmisión de logs en vivo
        self.start_live_logs_stream()

    def setup_styles(self):
        style = ttk.Style()
        style.theme_use("clam")

        # Paleta de Colores Médica Oscura
        self.BG_MAIN = "#0F172A"       # Slate 900
        self.BG_CARD = "#1E293B"       # Slate 800
        self.PRIMARY = "#00A69D"       # Teal
        self.SECONDARY = "#203A70"     # Navy Blue
        self.TEXT_COLOR = "#F8FAFC"
        self.TEXT_MUTED = "#94A3B8"
        self.DANGER = "#EF4444"        # Red

        self.root.configure(bg=self.BG_MAIN)
        style.configure("Main.TFrame", background=self.BG_MAIN)
        style.configure("Card.TFrame", background=self.BG_CARD)

        style.configure("Header.TLabel", background=self.BG_MAIN, foreground=self.TEXT_COLOR, font=("Helvetica", 16, "bold"))
        style.configure("SubHeader.TLabel", background=self.BG_MAIN, foreground=self.PRIMARY, font=("Helvetica", 10))

        style.configure("TNotebook", background=self.BG_MAIN, borderwidth=0)
        style.configure("TNotebook.Tab", background=self.SECONDARY, foreground=self.TEXT_COLOR, padding=[12, 6], font=("Helvetica", 10, "bold"))
        style.map("TNotebook.Tab", background=[("selected", self.PRIMARY)], foreground=[("selected", "#FFFFFF")])

        style.configure("Action.TButton", font=("Helvetica", 10, "bold"), background=self.PRIMARY, foreground="#FFFFFF", borderwidth=0, padding=8)
        style.map("Action.TButton", background=[("active", "#00837C")])

        style.configure("Danger.TButton", font=("Helvetica", 10, "bold"), background=self.DANGER, foreground="#FFFFFF", borderwidth=0, padding=8)
        style.map("Danger.TButton", background=[("active", "#DC2626")])

        style.configure("Treeview", background="#334155", foreground="#FFFFFF", fieldbackground="#334155", font=("Helvetica", 9), rowheight=25)
        style.configure("Treeview.Heading", background=self.SECONDARY, foreground="#FFFFFF", font=("Helvetica", 10, "bold"))

    def create_header(self):
        header_frame = ttk.Frame(self.main_container, style="Main.TFrame")
        header_frame.pack(fill=tk.X, padx=20, pady=(15, 5))

        title = ttk.Label(header_frame, text="🏥 SUPER-UCE DOC — Centro de Control y Gestión", style="Header.TLabel")
        title.pack(side=tk.LEFT)

        os_label = ttk.Label(header_frame, text=f"Sistema: {platform.system()} ({platform.release()})", style="SubHeader.TLabel")
        os_label.pack(side=tk.RIGHT, pady=5)

    # -------------------------------------------------------------------------
    # TAB 1: SERVIDOR Y OPERACIONES
    # -------------------------------------------------------------------------
    def setup_tab_server(self):
        top_frame = ttk.Frame(self.tab_server, style="Card.TFrame")
        top_frame.pack(fill=tk.X, padx=15, pady=15)

        lbl = tk.Label(top_frame, text="Operaciones de Servidor y Despliegue", bg=self.BG_CARD, fg=self.PRIMARY, font=("Helvetica", 12, "bold"))
        lbl.pack(anchor="w", pady=(0, 10))

        btn_frame = ttk.Frame(top_frame, style="Card.TFrame")
        btn_frame.pack(fill=tk.X)

        btn_start = tk.Button(btn_frame, text="▶️ Encender Backend", bg="#10B981", fg="white", font=("Helvetica", 10, "bold"), padx=12, pady=6, relief="flat", command=self.cmd_start_backend)
        btn_start.pack(side=tk.LEFT, padx=5)

        btn_restart = tk.Button(btn_frame, text="🔄 Reiniciar Backend", bg="#3B82F6", fg="white", font=("Helvetica", 10, "bold"), padx=12, pady=6, relief="flat", command=self.cmd_restart_backend)
        btn_restart.pack(side=tk.LEFT, padx=5)

        btn_stop = tk.Button(btn_frame, text="⏹️ Apagar Backend", bg=self.DANGER, fg="white", font=("Helvetica", 10, "bold"), padx=12, pady=6, relief="flat", command=self.cmd_stop_backend)
        btn_stop.pack(side=tk.LEFT, padx=5)

        btn_vercel = tk.Button(btn_frame, text="🚀 Actualizar Frontend (Vercel)", bg="#8B5CF6", fg="white", font=("Helvetica", 10, "bold"), padx=12, pady=6, relief="flat", command=self.cmd_deploy_vercel)
        btn_vercel.pack(side=tk.LEFT, padx=15)

        # Consola de Registros / Salida
        log_header = ttk.Frame(self.tab_server, style="Card.TFrame")
        log_header.pack(fill=tk.X, padx=15, pady=(5, 0))

        tk.Label(log_header, text="📜 Registros del Backend en Vivo (Journalctl / Uvicorn stream):", bg=self.BG_CARD, fg=self.PRIMARY, font=("Helvetica", 10, "bold")).pack(side=tk.LEFT)

        btn_clear = tk.Button(log_header, text="🧹 Limpiar Consola", bg="#475569", fg="white", font=("Helvetica", 8, "bold"), padx=8, pady=2, relief="flat", command=self.clear_console)
        btn_clear.pack(side=tk.RIGHT, padx=5)

        self.btn_toggle_logs = tk.Button(log_header, text="⏸️ Pausar Streaming", bg="#64748B", fg="white", font=("Helvetica", 8, "bold"), padx=8, pady=2, relief="flat", command=self.toggle_log_stream)
        self.btn_toggle_logs.pack(side=tk.RIGHT, padx=5)

        log_frame = ttk.Frame(self.tab_server, style="Card.TFrame")
        log_frame.pack(fill=tk.BOTH, expand=True, padx=15, pady=(5, 15))

        self.console = scrolledtext.ScrolledText(log_frame, bg="#0F172A", fg="#34D399", font=("Consolas", 9), insertbackground="white")
        self.console.pack(fill=tk.BOTH, expand=True)

    def log_message(self, msg):
        def append():
            timestamp = time.strftime("[%H:%M:%S] ")
            self.console.insert(tk.END, timestamp + msg + "\n")
            self.console.see(tk.END)
        self.root.after(0, append)

    def clear_console(self):
        self.console.delete("1.0", tk.END)

    def toggle_log_stream(self):
        self.log_streaming = not self.log_streaming
        if self.log_streaming:
            self.btn_toggle_logs.config(text="⏸️ Pausar Streaming", bg="#64748B")
            self.log_message("▶️ Streaming de registros reanudado.")
        else:
            self.btn_toggle_logs.config(text="▶️ Reanudar Streaming", bg="#10B981")
            self.log_message("⏸️ Streaming de registros pausado.")

    def start_live_logs_stream(self):
        def stream_worker():
            if self.is_linux:
                cmd = "journalctl -u super-uce-backend.service -f -n 30 --no-pager"
                try:
                    self.log_process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
                    for line in iter(self.log_process.stdout.readline, ''):
                        if not line:
                            break
                        if self.log_streaming:
                            clean_line = line.strip()
                            if clean_line:
                                self.root.after(0, lambda l=clean_line: (self.console.insert(tk.END, l + "\n"), self.console.see(tk.END)))
                except Exception as e:
                    self.log_message(f"Error iniciando transmisión de logs: {e}")
            else:
                # Monitorear archivo backend.log en Windows
                log_file_path = os.path.join(ROOT_DIR, "BackEnd", "backend.log")
                self.log_message(f"📡 Monitoreando registros de Windows ({log_file_path})...")
                while True:
                    if os.path.exists(log_file_path):
                        try:
                            with open(log_file_path, "r", encoding="utf-8", errors="ignore") as f:
                                f.seek(0, 2)
                                while True:
                                    line = f.readline()
                                    if not line:
                                        time.sleep(0.4)
                                        continue
                                    if self.log_streaming:
                                        clean_line = line.strip()
                                        if clean_line:
                                            self.root.after(0, lambda l=clean_line: (self.console.insert(tk.END, l + "\n"), self.console.see(tk.END)))
                        except Exception:
                            time.sleep(1)
                    else:
                        time.sleep(2)

        threading.Thread(target=stream_worker, daemon=True).start()

    def run_async_cmd(self, cmd, description):
        def worker():
            self.log_message(f"Ejecutando: {description}...")
            try:
                proc = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
                if proc.stdout:
                    for line in iter(proc.stdout.readline, ''):
                        if not line:
                            break
                        clean_line = line.strip()
                        if clean_line:
                            self.log_message(clean_line)
                proc.wait()
                if proc.returncode == 0:
                    self.log_message(f"✅ {description} completado exitosamente.")
                else:
                    self.log_message(f"⚠️ {description} finalizó con código {proc.returncode}.")
            except Exception as e:
                self.log_message(f"❌ Error al ejecutar {description}: {e}")
            self.refresh_health_status()
        threading.Thread(target=worker, daemon=True).start()

    def cmd_start_backend(self):
        if self.is_linux:
            self.run_async_cmd("sudo systemctl start super-uce-backend", "Encender Backend (systemd)")
        else:
            log_file = os.path.join(ROOT_DIR, "BackEnd", "backend.log")
            backend_cmd = f"cd /d \"{os.path.join(ROOT_DIR, 'BackEnd')}\" && python -m uvicorn app.main:app --port 8000 > \"{log_file}\" 2>&1"
            self.run_async_cmd(backend_cmd, "Encender Backend (Windows Local)")

    def cmd_restart_backend(self):
        if self.is_linux:
            self.run_async_cmd("sudo systemctl restart super-uce-backend", "Reiniciar Backend (systemd)")
        else:
            self.cmd_start_backend()

    def cmd_stop_backend(self):
        if self.is_linux:
            self.run_async_cmd("sudo systemctl stop super-uce-backend", "Apagar Backend (systemd)")
        else:
            self.run_async_cmd("taskkill /f /im python.exe", "Apagar Backend (Windows Taskkill)")

    def cmd_deploy_vercel(self):
        cmd = f"cd /d \"{ROOT_DIR}\" && npx vercel --prod"
        self.run_async_cmd(cmd, "Despliegue a Vercel")

    # -------------------------------------------------------------------------
    # TAB 2: USUARIOS Y ROLES (DATABASE VIEWER & DELETE)
    # -------------------------------------------------------------------------
    def setup_tab_users(self):
        top_bar = ttk.Frame(self.tab_users, style="Card.TFrame")
        top_bar.pack(fill=tk.X, padx=15, pady=12)

        # Filtro por Rol
        tk.Label(top_bar, text="Filtrar Rol:", bg=self.BG_CARD, fg=self.TEXT_COLOR, font=("Helvetica", 10, "bold")).pack(side=tk.LEFT, padx=(0, 5))
        self.role_var = tk.StringVar(value="TODOS")
        role_combo = ttk.Combobox(top_bar, textvariable=self.role_var, values=["TODOS", "paciente", "medico", "farmacia", "admin"], state="readonly", width=12)
        role_combo.pack(side=tk.LEFT, padx=5)
        role_combo.bind("<<ComboboxSelected>>", lambda e: self.load_users_data())

        # Buscador
        tk.Label(top_bar, text="Buscar:", bg=self.BG_CARD, fg=self.TEXT_COLOR, font=("Helvetica", 10, "bold")).pack(side=tk.LEFT, padx=(15, 5))
        self.user_search_var = tk.StringVar()
        entry_search = ttk.Entry(top_bar, textvariable=self.user_search_var, width=20)
        entry_search.pack(side=tk.LEFT, padx=5)
        entry_search.bind("<KeyRelease>", lambda e: self.load_users_data())

        btn_ref = tk.Button(top_bar, text="🔄 Recargar", bg=self.PRIMARY, fg="white", font=("Helvetica", 9, "bold"), command=self.load_users_data, relief="flat", padx=10)
        btn_ref.pack(side=tk.LEFT, padx=10)

        btn_details = tk.Button(top_bar, text="🔍 Ver Detalle Completo", bg="#3B82F6", fg="white", font=("Helvetica", 9, "bold"), command=self.show_user_details, relief="flat", padx=10)
        btn_details.pack(side=tk.RIGHT, padx=5)

        btn_delete = tk.Button(top_bar, text="🗑️ Eliminar Usuario", bg=self.DANGER, fg="white", font=("Helvetica", 9, "bold"), command=self.delete_selected_user, relief="flat", padx=10)
        btn_delete.pack(side=tk.RIGHT, padx=5)

        # Contadores por Rol
        self.stats_frame = ttk.Frame(self.tab_users, style="Card.TFrame")
        self.stats_frame.pack(fill=tk.X, padx=15, pady=(0, 10))
        self.lbl_stats = tk.Label(self.stats_frame, text="Cargando estadísticas...", bg=self.BG_CARD, fg=self.PRIMARY, font=("Helvetica", 10, "bold"))
        self.lbl_stats.pack(anchor="w")

        # Tabla de usuarios
        table_frame = ttk.Frame(self.tab_users, style="Card.TFrame")
        table_frame.pack(fill=tk.BOTH, expand=True, padx=15, pady=(0, 15))

        columns = ("id", "nombre", "email", "rol", "verificado", "creado")
        self.tree_users = ttk.Treeview(table_frame, columns=columns, show="headings", selectmode="browse")

        self.tree_users.heading("id", text="ID")
        self.tree_users.heading("nombre", text="Nombre / Usuario")
        self.tree_users.heading("email", text="Correo Electrónico")
        self.tree_users.heading("rol", text="Rol de Cuenta")
        self.tree_users.heading("verificado", text="Verificado")
        self.tree_users.heading("creado", text="Fecha de Registro")

        self.tree_users.column("id", width=50, anchor="center")
        self.tree_users.column("nombre", width=180)
        self.tree_users.column("email", width=220)
        self.tree_users.column("rol", width=100, anchor="center")
        self.tree_users.column("verificado", width=90, anchor="center")
        self.tree_users.column("creado", width=140, anchor="center")

        scrollbar = ttk.Scrollbar(table_frame, orient=tk.VERTICAL, command=self.tree_users.yview)
        self.tree_users.configure(yscroll=scrollbar.set)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree_users.pack(fill=tk.BOTH, expand=True)

    def load_users_data(self):
        if not DB_AVAILABLE:
            messagebox.showwarning("Sin Base de Datos", "No hay conexión activa a Supabase. Verifica la variable DATABASE_URL en BackEnd/.env")
            return

        for item in self.tree_users.get_children():
            self.tree_users.delete(item)

        role_filter = self.role_var.get()
        search_query = self.user_search_var.get().strip().lower()

        try:
            with engine.connect() as conn:
                query = text("""
                    SELECT id, full_name, email, role, is_verified, created_at 
                    FROM users 
                    ORDER BY id DESC
                """)
                result = conn.execute(query).fetchall()

                stats = {"paciente": 0, "medico": 0, "farmacia": 0, "admin": 0, "total": 0}
                
                for row in result:
                    uid, name, email, role, is_ver, created = row
                    role_str = (role or "paciente").lower()
                    if role_str in stats:
                        stats[role_str] += 1
                    stats["total"] += 1

                    # Filtro por rol
                    if role_filter != "TODOS" and role_str != role_filter:
                        continue

                    # Filtro por búsqueda
                    if search_query:
                        match_name = name and search_query in name.lower()
                        match_email = email and search_query in email.lower()
                        if not (match_name or match_email):
                            continue

                    ver_text = "✅ Sí" if is_ver else "❌ No"
                    created_str = str(created)[:16] if created else "N/D"

                    self.tree_users.insert("", tk.END, values=(uid, name or "N/A", email or "N/A", role_str.upper(), ver_text, created_str))

                self.lbl_stats.config(
                    text=f"📊 Estadísticas: Total: {stats['total']}  |  👨‍⚕️ Médicos: {stats['medico']}  |  🩺 Pacientes: {stats['paciente']}  |  💊 Farmacias: {stats['farmacia']}  |  🛡️ Admins: {stats['admin']}"
                )
        except Exception as e:
            self.log_message(f"Error consultando usuarios: {e}")

    def show_user_details(self):
        selected = self.tree_users.selection()
        if not selected:
            messagebox.showinfo("Selecciona un usuario", "Por favor selecciona un usuario de la lista.")
            return

        item = self.tree_users.item(selected[0])
        user_id, name, email, role, ver, created = item["values"]

        # Buscar detalles específicos según rol
        extra_info = "Sin detalles adicionales"
        try:
            with engine.connect() as conn:
                role_lower = str(role).lower()
                if role_lower == "medico":
                    r = conn.execute(text("SELECT exequatur, specialty, id_card, phone FROM doctors WHERE id = :uid"), {"uid": user_id}).fetchone()
                    if r:
                        extra_info = f"Exequatur: {r[0] or 'N/D'}\nEspecialidad: {r[1] or 'N/D'}\nCédula: {r[2] or 'N/D'}\nTeléfono: {r[3] or 'N/D'}"
                elif role_lower == "paciente":
                    r = conn.execute(text("SELECT cedula, phone, blood_type, risk_status FROM patients WHERE id = :uid"), {"uid": user_id}).fetchone()
                    if r:
                        extra_info = f"Cédula: {r[0] or 'N/D'}\nTeléfono: {r[1] or 'N/D'}\nTipo de Sangre: {r[2] or 'N/D'}\nEstado Clínico: {r[3] or 'Estable'}"
                elif role_lower == "farmacia":
                    r = conn.execute(text("SELECT business_name, address, phone, rnc FROM pharmacies WHERE id = :uid"), {"uid": user_id}).fetchone()
                    if r:
                        extra_info = f"Establecimiento: {r[0] or 'N/D'}\nDirección: {r[1] or 'N/D'}\nTeléfono: {r[2] or 'N/D'}\nRNC: {r[3] or 'N/D'}"
        except Exception as e:
            extra_info = f"Detalles: Perfil básico creado (ID #{user_id})"

        info_msg = (
            f"👤 INFORMACIÓN DEL USUARIO (ID #{user_id})\n"
            f"--------------------------------------------------\n"
            f"Nombre: {name}\n"
            f"Correo: {email}\n"
            f"Rol de Sistema: {role}\n"
            f"Verificado: {ver}\n"
            f"Fecha Registro: {created}\n\n"
            f"📌 DETALLES DEL ROL:\n{extra_info}"
        )
        messagebox.showinfo("Detalle de Usuario", info_msg)

    def delete_selected_user(self):
        selected = self.tree_users.selection()
        if not selected:
            messagebox.showinfo("Selecciona un usuario", "Por favor selecciona un usuario de la lista para eliminar.")
            return

        item = self.tree_users.item(selected[0])
        user_id, name, email, role, _, _ = item["values"]

        confirm = messagebox.askyesno(
            "⚠️ Confirmar Eliminación",
            f"¿Estás seguro de que deseas eliminar permanentemente al usuario?\n\n"
            f"ID: #{user_id}\nNombre: {name}\nCorreo: {email}\nRol: {role}\n\n"
            f"Esta acción no se puede deshacer y borrará sus registros asociados en Supabase."
        )

        if not confirm:
            return

        try:
            with engine.begin() as conn:
                statements = [
                    ("DELETE FROM appointments WHERE patient_id = :uid OR doctor_id = :uid", {"uid": user_id}),
                    ("DELETE FROM prescriptions WHERE patient_id = :uid OR doctor_id = :uid", {"uid": user_id}),
                    ("DELETE FROM clinical_histories WHERE patient_id = :uid OR doctor_id = :uid", {"uid": user_id}),
                    ("DELETE FROM doctor_patient_links WHERE doctor_id = :uid OR patient_id = :uid", {"uid": user_id}),
                    ("DELETE FROM pharmacy_inventory WHERE pharmacy_id = :uid", {"uid": user_id}),
                    ("DELETE FROM patients WHERE id = :uid", {"uid": user_id}),
                    ("DELETE FROM doctors WHERE id = :uid", {"uid": user_id}),
                    ("DELETE FROM pharmacies WHERE id = :uid", {"uid": user_id}),
                    ("DELETE FROM email_verification_codes WHERE email = :uemail", {"uemail": str(email)}),
                    ("DELETE FROM chat_messages WHERE session_id IN (SELECT id FROM chat_sessions WHERE user_id = :uid)", {"uid": user_id}),
                    ("DELETE FROM chat_sessions WHERE user_id = :uid", {"uid": user_id}),
                    ("DELETE FROM users WHERE id = :uid", {"uid": user_id}),
                ]
                for stmt, params in statements:
                    try:
                        conn.execute(text(stmt), params)
                    except Exception as se:
                        print(f"[Warning] Sub-delete statement skipped: {se}")

            messagebox.showinfo("Usuario Eliminado", f"El usuario {name} (#{user_id}) fue eliminado exitosamente.")
            self.load_users_data()
        except Exception as e:
            messagebox.showerror("Error al eliminar", f"No se pudo eliminar el usuario: {e}")

    # -------------------------------------------------------------------------
    # TAB 3: EXPLORADOR DE BASE DE DATOS (TABLE INSPECTOR)
    # -------------------------------------------------------------------------
    def setup_tab_db(self):
        top_bar = ttk.Frame(self.tab_db, style="Card.TFrame")
        top_bar.pack(fill=tk.X, padx=15, pady=12)

        tk.Label(top_bar, text="Seleccionar Tabla:", bg=self.BG_CARD, fg=self.TEXT_COLOR, font=("Helvetica", 10, "bold")).pack(side=tk.LEFT, padx=(0, 5))
        self.table_var = tk.StringVar()
        self.combo_tables = ttk.Combobox(top_bar, textvariable=self.table_var, state="readonly", width=25)
        self.combo_tables.pack(side=tk.LEFT, padx=5)
        self.combo_tables.bind("<<ComboboxSelected>>", lambda e: self.inspect_table())

        btn_load_tables = tk.Button(top_bar, text="🔄 Cargar Tablas", bg=self.PRIMARY, fg="white", font=("Helvetica", 9, "bold"), command=self.load_table_list, relief="flat", padx=10)
        btn_load_tables.pack(side=tk.LEFT, padx=10)

        # Vista de Tabla dinámica
        self.db_table_frame = ttk.Frame(self.tab_db, style="Card.TFrame")
        self.db_table_frame.pack(fill=tk.BOTH, expand=True, padx=15, pady=(0, 15))

        self.tree_db = None
        self.load_table_list()

    def load_table_list(self):
        if not DB_AVAILABLE:
            return

        try:
            inspector = inspect(engine)
            tables = inspector.get_table_names()
            self.combo_tables["values"] = tables
            if tables:
                self.combo_tables.current(0)
                self.inspect_table()
        except Exception as e:
            self.log_message(f"Error obteniendo lista de tablas: {e}")

    def inspect_table(self):
        table_name = self.table_var.get()
        if not table_name or not DB_AVAILABLE:
            return

        for widget in self.db_table_frame.winfo_children():
            widget.destroy()

        try:
            with engine.connect() as conn:
                res = conn.execute(text(f"SELECT * FROM {table_name} LIMIT 100"))
                columns = list(res.keys())
                rows = res.fetchall()

                self.tree_db = ttk.Treeview(self.db_table_frame, columns=columns, show="headings", selectmode="browse")
                for col in columns:
                    self.tree_db.heading(col, text=col.upper())
                    self.tree_db.column(col, width=120, anchor="center")

                sb_y = ttk.Scrollbar(self.db_table_frame, orient=tk.VERTICAL, command=self.tree_db.yview)
                sb_x = ttk.Scrollbar(self.db_table_frame, orient=tk.HORIZONTAL, command=self.tree_db.xview)
                self.tree_db.configure(yscroll=sb_y.set, xscroll=sb_x.set)

                sb_y.pack(side=tk.RIGHT, fill=tk.Y)
                sb_x.pack(side=tk.BOTTOM, fill=tk.X)
                self.tree_db.pack(fill=tk.BOTH, expand=True)

                for row in rows:
                    self.tree_db.insert("", tk.END, values=list(row))
        except Exception as e:
            self.log_message(f"Error inspeccionando tabla {table_name}: {e}")

    # -------------------------------------------------------------------------
    # TAB 4: MONITOR DE SALUD DEL SISTEMA (HEALTH CHECK)
    # -------------------------------------------------------------------------
    def setup_tab_health(self):
        container = ttk.Frame(self.tab_health, style="Card.TFrame")
        container.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)

        tk.Label(container, text="Estado en Vivo de Servicios y Conexiones", bg=self.BG_CARD, fg=self.PRIMARY, font=("Helvetica", 14, "bold")).pack(anchor="w", pady=(0, 15))

        self.cards_frame = ttk.Frame(container, style="Card.TFrame")
        self.cards_frame.pack(fill=tk.X, pady=10)

        self.card_backend = self.create_status_card(self.cards_frame, "Backend API (FastAPI)", "https://superucedoc-api.duckdns.org")
        self.card_livekit = self.create_status_card(self.cards_frame, "LiveKit Server (Videollamadas)", "wss://superucedoc-livekit.duckdns.org")
        self.card_database = self.create_status_card(self.cards_frame, "Base de Datos (Supabase)", "PostgreSQL Cloud")
        self.card_vercel = self.create_status_card(self.cards_frame, "Frontend Web (Vercel)", "https://superucedocpage.vercel.app")

        btn_check = tk.Button(container, text="🔄 Verificar Estado de Servicios Ahora", bg=self.PRIMARY, fg="white", font=("Helvetica", 11, "bold"), padx=15, pady=8, relief="flat", command=self.refresh_health_status)
        btn_check.pack(pady=20)

    def create_status_card(self, parent, title, url):
        frame = tk.Frame(parent, bg="#334155", padx=15, pady=12, bd=1, relief="ridge")
        frame.pack(fill=tk.X, pady=6)

        lbl_title = tk.Label(frame, text=title, bg="#334155", fg="#FFFFFF", font=("Helvetica", 11, "bold"))
        lbl_title.pack(side=tk.LEFT)

        lbl_url = tk.Label(frame, text=f"({url})", bg="#334155", fg=self.TEXT_MUTED, font=("Helvetica", 9))
        lbl_url.pack(side=tk.LEFT, padx=10)

        lbl_status = tk.Label(frame, text="Verificando...", bg="#334155", fg="#FBBF24", font=("Helvetica", 10, "bold"))
        lbl_status.pack(side=tk.RIGHT)

        return lbl_status

    def refresh_health_status(self):
        def worker():
            # Check Backend
            try:
                r = requests.get("https://superucedoc-api.duckdns.org/", timeout=4)
                if r.status_code == 200:
                    self.card_backend.config(text="🟢 ONLINE (200 OK)", fg="#34D399")
                else:
                    self.card_backend.config(text=f"🟡 HTTP {r.status_code}", fg="#FBBF24")
            except Exception:
                self.card_backend.config(text="🔴 OFFLINE", fg="#EF4444")

            # Check LiveKit
            try:
                r = requests.get("https://superucedoc-livekit.duckdns.org/", timeout=4)
                if r.status_code == 200:
                    self.card_livekit.config(text="🟢 ONLINE (200 OK)", fg="#34D399")
                else:
                    self.card_livekit.config(text="🔴 OFFLINE", fg="#EF4444")
            except Exception:
                self.card_livekit.config(text="🔴 OFFLINE", fg="#EF4444")

            # Check DB
            if DB_AVAILABLE:
                self.card_database.config(text="🟢 CONECTADO (Supabase)", fg="#34D399")
            else:
                self.card_database.config(text="🔴 ERROR DE CONEXIÓN", fg="#EF4444")

            # Check Vercel
            try:
                r = requests.get("https://superucedocpage.vercel.app", timeout=4)
                if r.status_code in (200, 304):
                    self.card_vercel.config(text="🟢 ONLINE (Vercel CDN)", fg="#34D399")
                else:
                    self.card_vercel.config(text=f"🟡 HTTP {r.status_code}", fg="#FBBF24")
            except Exception:
                self.card_vercel.config(text="🔴 OFFLINE", fg="#EF4444")

        threading.Thread(target=worker, daemon=True).start()

def main():
    root = tk.Tk()
    app = ControlCenterApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()

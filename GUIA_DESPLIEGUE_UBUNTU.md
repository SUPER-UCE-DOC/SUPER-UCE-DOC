# 🚀 Guía Paso a Paso: Despliegue de SUPER-UCE DOC en Linux Ubuntu, Supabase y Vercel

Esta guía te explicará de forma clara y sin complicaciones cómo instalar y poner a correr todo tu sistema **SUPER-UCE DOC** utilizando tu otra PC con **Linux Ubuntu**, la base de datos en **Supabase** y la web pública en **Vercel**.

---

## 📌 Resumen del Esquema

1. **Base de Datos**: PostgreSQL alojado en la nube gratuita de **Supabase**.
2. **Backend**: FastAPI corriendo en tu PC con **Linux Ubuntu** (con Nginx y SSL).
3. **LiveKit Server**: Videollamadas corriendo en **Docker** en la misma PC con Ubuntu.
4. **Frontend**: Tu aplicación web (React + Vite) alojada gratis en **Vercel**.

---

## 🗄️ PASO 1: Configurar la Base de Datos en Supabase

1. Entra a [Supabase.com](https://supabase.com) e inicia sesión.
2. Si no has creado el proyecto, haz clic en **New Project**, ponle nombre `super-uce-doc` y asigna la contraseña de la base de datos (por ejemplo: `SuperUceDoc2026`).
3. Para obtener tu cadena de conexión URI:
   - Haz clic en el botón verde/destacado **Connect** situado en la barra superior de tu proyecto (o haz clic en el ícono de **Database** 🗄️ —el 4.° ícono del menú lateral izquierdo).
   - En la ventana modal que se abre, selecciona la opción **Direct Connection** o **Transaction Pooler** (formato **URI / SQLAlchemy**).
   - Copia la cadena de conexión y asegúrate de reemplazar `[YOUR-PASSWORD]` por la contraseña de tu base de datos. Debe ser igual o similar a esta:
   ```text
   postgresql+psycopg2://postgres:SuperUceDoc2026@db.xxxxxx.supabase.co:5432/postgres
   ```
*(¡Listo! La base de datos creará las tablas automáticamente tan pronto tu backend en Ubuntu inicie por primera vez).*

---

## 🐧 PASO 2: Configurar tu PC con Linux Ubuntu

Abre una terminal en tu PC con Ubuntu (`Ctrl + Alt + T`) y sigue estos bloques de comandos.

### 2.1 Actualizar la PC e instalar programas básicos
```bash
# 1. Actualizar repositorios
sudo apt update && sudo apt upgrade -y

# 2. Si te da error de conflicto con containerd.io, ejecuta primero:
# sudo apt remove -y containerd.io containerd

# 3. Instalar Python, Git, Nginx, Certbot y Docker
sudo apt install -y python3 python3-pip python3-venv git nginx certbot python3-certbot-nginx docker.io docker-compose

# 4. Encender Docker y darle permisos a tu usuario
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

---

### 2.2 Copiar o clonar tu proyecto y configurar el Backend

#### OPCIÓN A: Si ya tienes la carpeta del proyecto descargada en tu carpeta Downloads (Descargas):
```bash
# 1. Crear el directorio de aplicaciones web si no existe
sudo mkdir -p /var/www

# 2. Copiar la carpeta descargada a /var/www/super-uce-doc
sudo cp -r ~/Downloads/SUPER-UCE-DOC /var/www/super-uce-doc

# 3. Asignar los permisos a tu usuario actual
sudo chown -R $USER:$USER /var/www/super-uce-doc
```

#### OPCIÓN B: Si vas a clonar desde GitHub:
```bash
# 1. Entrar a la carpeta de sitios web y clonar
cd /var/www
sudo git clone https://github.com/TU_USUARIO/SUPER-UCE-DOC.git super-uce-doc
sudo chown -R $USER:$USER /var/www/super-uce-doc
```

---

#### Configurar el Entorno de Python:
```bash
# 1. Entrar a la carpeta del Backend y crear el entorno virtual de Python
cd /var/www/super-uce-doc/BackEnd
python3 -m venv venv

# 2. Activar el entorno virtual e instalar las librerías necesarias
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn
```

---

### 2.3 Crear el archivo `.env` en Ubuntu
Crea el archivo `.env` dentro de la carpeta `/var/www/super-uce-doc/BackEnd`:

```bash
nano /var/www/super-uce-doc/BackEnd/.env
```

Pega el siguiente contenido dentro del archivo:

```ini
# Configuración General del Servidor Ubuntu
HOST=0.0.0.0
PORT=8000
SECRET_KEY=super_secret_jwt_key_for_super_uce_doc_project_12345
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Base de Datos en Supabase
DATABASE_URL=postgresql+psycopg2://postgres:SuperUceDoc2026@db.qfdbhhsqmwumuouftwkc.supabase.co:5432/postgres

# Clave para IA (Groq / OpenRouter)
OPENROUTER_API_KEY=tu_clave_de_groq_o_openrouter_aqui
OPENROUTER_MODEL=google/gemini-2.5-flash

# Credenciales de LiveKit
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=mi_super_secreto_largo_para_livekit_de_32_letras
```
*(Guarda los cambios presionando `Ctrl + O`, luego `Enter`, y sal con `Ctrl + X`).*

---

### 2.4 Dejar el Backend corriendo en segundo plano (`systemd`)
Para que tu backend FastAPI nunca se apague aunque reinicies la PC:

```bash
# 1. Copiar el archivo de servicio que preparamos en el proyecto
sudo cp /var/www/super-uce-doc/BackEnd/super-uce-backend.service /etc/systemd/system/

# 2. Recargar los servicios de Ubuntu y encenderlo
sudo systemctl daemon-reload
sudo systemctl enable --now super-uce-backend

# 3. Comprobar que esté corriendo bien (debe decir active / running en verde)
sudo systemctl status super-uce-backend
```

---

## 🐳 PASO 3: Encender el Servidor LiveKit con Docker

En la misma PC con Ubuntu, entra a la carpeta `BackEnd` y ejecuta LiveKit con Docker:

```bash
cd /var/www/super-uce-doc/BackEnd

# Levantar el contenedor en segundo plano (usa con espacio o con guion)
docker compose -f docker-compose.livekit.yml up -d
# Si la versión de tu sistema requiere el paquete clásico: sudo apt install docker-compose -y

# Verificar que el contenedor esté activo
docker ps
```
*(Verás un contenedor llamado `livekit-server` corriendo alegremente).*

---

## 🌐 PASO 4: Configurar Nginx y Certificados SSL (HTTPS / WSS)

Las cámaras web de los navegadores **exigen** que la página esté bajo conexión segura `https://` o `wss://`.

### 4.1 Abrir puertos en tu Firewall o Router
Asegúrate de que los puertos `80`, `443`, `7880`, `7881` y el rango UDP `50000-60000` estén abiertos en tu router hacia la IP de tu PC con Ubuntu.

### 4.2 Configurar Nginx
Crea un archivo de configuración para Nginx:

```bash
sudo nano /etc/nginx/sites-available/super-uce-doc
```

Pega esta configuración (reemplazando `api.midominio.com` y `livekit.midominio.com` por tu dominio o subdominio):

```nginx
server {
    server_name api.midominio.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    server_name livekit.midominio.com;

    location / {
        proxy_pass http://127.0.0.1:7880;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Activa el sitio en Nginx y recarga:
```bash
sudo ln -s /etc/nginx/sites-available/super-uce-doc /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4.3 Ponerle SSL Gratis con Certbot
```bash
sudo certbot --nginx -d api.midominio.com -d livekit.midominio.com
```

---

## ⚡ PASO 5: Desplegar el Frontend en Vercel (Gratis)

1. Entra a [Vercel.com](https://vercel.com) e inicia sesión con tu cuenta de GitHub.
2. Haz clic en **Add New...** -> **Project**.
3. Selecciona tu repositorio `SUPER-UCE-DOC`.
4. En **Root Directory**, haz clic en `Edit` y selecciona la carpeta **`FrontEnd`**.
5. En la sección **Environment Variables**, añade estas dos variables:
   * **`VITE_API_BASE_URL`**: `https://api.midominio.com` *(la dirección de tu backend en Ubuntu)*.
   * **`VITE_LIVEKIT_URL`**: `wss://livekit.midominio.com` *(la dirección WebSocket de LiveKit en Ubuntu)*.
6. Haz clic en **Deploy**.

---

## 🎉 ¡Listo! Tu plataforma está 100% en la nube pública

Ahora cualquier paciente o médico podrá:
1. Abrir la página desde su celular o PC en Vercel.
2. Registrarse e iniciar sesión conectándose a tu servidor en Ubuntu y Supabase.
3. Entrar a teleconsultas con cámara, voz y subtítulos en vivo a través de LiveKit en Docker.

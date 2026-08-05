# 🚀 Guía de Instalación y Ejecución del Proyecto: SUPER-UCE DOC

Esta guía contiene las instrucciones paso a paso para instalar dependencias y poner en marcha los tres módulos del sistema **SUPER-UCE DOC**:
1. **LiveKit Server** (Servidor de teleconsultas y videollamadas en Docker)
2. **Backend** (API REST en Python con FastAPI)
3. **Frontend** (Aplicación web en React con Vite)

---

## 📋 1. Requisitos Previos

Antes de comenzar, asegúrate de tener instalado el siguiente software en tu equipo:

> [!IMPORTANT]
> 🐳 **REQUISITO OBLIGATORIO: DOCKER INSTALADO Y EN EJECUCIÓN**
> Debes tener **Docker Desktop** (en Windows/macOS) o **Docker Engine + Docker Compose** (en Linux) instalado y abierto en tu computadora antes de iniciar los servicios. Sin Docker no se podrá levantar el módulo de videollamadas integradas.

- **Node.js**: v18.0.0 o superior (incluye `npm`).
- **Python**: v3.10 o superior (con `pip` configurado en las variables de entorno del sistema).
- **Git**: Para la gestión del código fuente.

---

## 🛠️ 2. Paso a Paso para Levantar el Proyecto

### 🐋 Paso 1: Servidor de Videollamadas LiveKit (Docker)

El módulo de teleconsultas integradas de la plataforma utiliza LiveKit corriendo dentro de un contenedor de Docker.

1. Abre una terminal y navega a la carpeta del servidor local de LiveKit:
   ```bash
   cd LiveKit-Local
   ```

2. Verifica que **Docker Desktop** esté abierto y ejecutándose.

3. Levanta el contenedor de Docker:
   ```bash
   docker compose up -d
   ```
   *(En versiones antiguas de Docker Compose se ejecuta `docker-compose up -d`).*

4. **Verificación:** Puedes confirmar que el contenedor está activo corriendo:
   ```bash
   docker ps
   ```
   Deberías ver el contenedor `livekit/livekit-server:latest` activo en los puertos `7880`, `7881`, entre otros.

---

### 🐍 Paso 2: Instalación y Ejecución del Backend (FastAPI)

1. Abre una **nueva terminal** en la raíz del proyecto y navega a la carpeta del backend:
   ```bash
   cd BackEnd
   ```

2. Instala directamente las dependencias de Python:
   ```bash
   pip install -r requirements.txt
   ```

3. Crea el archivo de variables de entorno `.env` copiando la plantilla:
   - **En Windows:**
     ```cmd
     copy .env.example .env
     ```
   - **En Linux / macOS:**
     ```bash
     cp .env.example .env
     ```

4. *(Opcional)* Abre el archivo `.env` para verificar o agregar llaves adicionales como `OPENROUTER_API_KEY`.

5. Ejecuta el servidor del backend:
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

6. **Verificación:** Puedes probar el API y ver la documentación interactiva (Swagger UI) ingresando a:
   [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

### ⚛️ Paso 3: Instalación y Ejecución del Frontend (React + Vite)

1. Abre una **tercera terminal** en la raíz del proyecto y navega a la carpeta del frontend:
   ```bash
   cd FrontEnd
   ```

2. Instala las dependencias de Node.js:
   ```bash
   npm install
   ```

3. Crea el archivo de variables de entorno `.env`:
   - **En Windows:**
     ```cmd
     copy .env.example .env
     ```
   - **En Linux / macOS:**
     ```bash
     cp .env.example .env
     ```

4. Inicia el servidor de desarrollo de Vite:
   ```bash
   npm run dev
   ```

5. **Verificación:** Abre tu navegador e ingresa a la aplicación:
   [http://localhost:5173](http://localhost:5173)

---

## 📌 3. Resumen de Puertos y Servicios

| Servicio | Tecnología | URL / Dirección |
| :--- | :--- | :--- |
| **Aplicación Frontend** | React + Vite | [http://localhost:5173](http://localhost:5173) |
| **API Backend** | FastAPI / Python | [http://127.0.0.1:8000](http://127.0.0.1:8000) |
| **Documentación API (Swagger)** | OpenAPI | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) |
| **Servidor LiveKit** | Docker (WebRTC) | `ws://localhost:7880` |

---

## 💡 4. Consejos Útiles

- **Mantener 3 Terminales Abiertas:** Deja cada uno de los tres comandos corriendo en una terminal diferente durante tu sesión de desarrollo.
- **Base de Datos SQLite:** El backend genera y gestiona automáticamente el archivo `super_uce_doc.db` dentro de la carpeta `BackEnd`.
- **Apagar Docker al finalizar:** Cuando termines de trabajar, puedes detener el servicio de LiveKit ejecutando:
  ```bash
  cd LiveKit-Local
  docker compose down
  ```

# Guía de Proyecto: Arquitectura y Despliegue Híbrido - SUPER-UCE DOC

¡Hola equipo! Este documento contiene toda la información esencial sobre la arquitectura de **SUPER-UCE DOC**, cómo ejecutar el sistema en modo de desarrollo para hacer pruebas en sus computadoras, y el diseño de infraestructura "híbrida" propuesto para lanzar el sistema de forma profesional y segura con un costo mensual de $0.00.

---

## 1. Instrucciones: Cómo Correr el Proyecto para Pruebas (Local)

Para probar la plataforma en tu computadora, debes iniciar ambos "motores" (el BackEnd y el FrontEnd) en dos ventanas de terminal separadas. Asegúrate de estar ubicado en la carpeta raíz del proyecto (`SUPER-UCE-DOC`).

### Paso A: Iniciar el BackEnd (Cerebro e Inteligencia Artificial)
Abre una terminal y ejecuta estos comandos uno por uno:
1. Entra a la carpeta del BackEnd:
   ```bash
   cd .\BackEnd\
   ```
2. Enciende el servidor de Python (FastAPI):
   ```bash
   python -m uvicorn app.main:app --reload
   ```
*(El servidor de validación e inteligencia artificial quedará corriendo en `http://localhost:8000`)*

### Paso B: Iniciar el FrontEnd (Interfaz Visual)
Abre una **nueva** terminal (sin cerrar la del BackEnd, para que ambos corran al mismo tiempo) y ejecuta:
1. Entra a la carpeta del FrontEnd:
   ```bash
   cd .\FrontEnd\
   ```
2. Enciende el servidor de la página web (React/Vite):
   ```bash
   npm run dev
   ```
*(La aplicación web quedará lista en `http://localhost:5173`. ¡Abre ese enlace en tu navegador para empezar a usar la app!)*

---

## 2. La Arquitectura Híbrida (Despliegue Profesional a $0.00)

Para lanzar el sistema al mundo real sin incurrir en altísimos costos por servidores que puedan correr Inteligencia Artificial, hemos diseñado una **Arquitectura Híbrida** altamente eficiente. Esto combina lo mejor de la seguridad de la nube pública con la potencia gratuita de nuestra computadora local.

El sistema en producción se dividirá en tres partes conectadas entre sí:

### 1. El FrontEnd (En la Nube - Vercel o Netlify)
* **Qué es:** Toda la interfaz visual, dashboards médicos y menús interactivos.
* **Dónde vivirá:** En la plataforma de *Vercel* de forma **gratuita**.
* **Ventaja:** La página web cargará instantáneamente en los celulares de los médicos, farmacias y pacientes, y estará siempre en línea bajo un dominio profesional y seguro (ej. `super-ucedoc.vercel.app`).

### 2. La Base de Datos (En la Nube - Neon.tech o Supabase)
* **Qué es:** El lugar de máxima seguridad donde se guardan las contraseñas encriptadas, recetas médicas y el historial clínico de los pacientes (PostgreSQL).
* **Dónde vivirá:** En la capa gratuita empresarial de *Supabase* o *Neon*.
* **Ventaja Crítica:** La información médica y confidencial de los pacientes nunca se perderá. Incluso si hay un incendio o falla eléctrica en nuestras oficinas, la base de datos está respaldada en tiempo real en los servidores profesionales de la nube.

### 3. El BackEnd y la IA (En PC Local - Servidor Propio)
* **Qué es:** El motor que valida inicios de sesión, guarda las recetas, ejecuta el chatbot médico y traduce el lenguaje de señas en vivo.
* **Dónde vivirá:** ¡En nuestra propia computadora en la oficina o casa!
* **Ventaja Económica (Costo $0):** Los modelos de IA consumen muchísima memoria (RAM/GPU). Al correr esta parte tan pesada en nuestra propia computadora, ahorramos cientos de dólares al mes en servidores de IA. Además, al estar encendida en local, responde instantáneamente sin los "tiempos de espera" de los servidores gratuitos de internet.
* **¿Cómo se conecta con Vercel?:** Utilizaremos un túnel seguro llamado **Cloudflare Tunnels**. Esto crea un puente invisible y encriptado que permite que la página en Vercel se comunique directamente con nuestra PC para solicitar diagnósticos de IA sin exponer nuestra red ni tener que configurar el módem de internet.

---

## 3. Funcionalidades Clave y Seguridad Integrada

* **Inicio de Sesión (Google Auth y Cuentas Propias)**: El sistema permite crear cuentas tradicionales con contraseñas matemáticamente irrompibles (`bcrypt`). Además, implementamos el sistema oficial de **Google Identity**, que permite iniciar sesión con un solo clic de forma segura sin revelar la contraseña original.
* **Módulos de IA Avanzados**:
  * *Chatbot Médico*: Analiza síntomas en tiempo real con una base de conocimiento médico especializada.
  * *Traductor LSE*: Inteligencia artificial visual para interpretar el Lenguaje de Señas local y traducirlo a texto al instante.
* **Flexibilidad de la Base de Datos**: Como nuestro código fue programado usando `SQLAlchemy` (un traductor inteligente de bases de datos), cuando queramos cambiar de la base de datos local a la base de datos de Supabase/Neon, ¡nadie tendrá que reescribir código! Solo se necesita abrir el archivo `BackEnd/.env` y cambiar el texto de la variable `DATABASE_URL`. El sistema creará las tablas médicas allá arriba por sí solo.

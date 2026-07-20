# Documentación Maestra de Arquitectura y Backend: SUPER-UCE DOC

¡Hola equipo! 👋
Esta es nuestra hoja de ruta oficial. Como somos un grupo grande, necesitamos que todos hablemos el mismo idioma técnico. Este documento explica exactamente cómo funciona el "cerebro" (Backend) de nuestra aplicación, qué herramientas gratuitas y de nivel profesional vamos a utilizar, y cómo se conectan todas las piezas para dar vida a los tres portales: Paciente, Médico y Farmacia.

Nuestra meta es construir el sistema más robusto e innovador de la Universidad Central del Este (UCE). ¡Vamos a desglosarlo!

---

## ✅ Lo que ya hemos implementado (Progreso Actual)

Hasta el momento, hemos sentado unas bases sólidas y funcionales en el proyecto:
- **Cuentas y Autenticación 100% Funcionales:** Sistema de login y registro por roles (Paciente, Médico, Farmacia), incluyendo autenticación segura mediante Google OAuth y cifrado bcrypt.
- **Chat de IA Integrado:** El asistente médico inteligente ya está conectado y funcionando en el portal del paciente.
- **Estructura Base del Dashboard:** La interfaz gráfica (Frontend) ya está enlazada al Backend para redirigir correctamente a cada usuario según su rol a sus vistas correspondientes.
- **Soporte de Avatares y Perfiles:** Interfaz fluida y con arrastrar-y-soltar para que los usuarios gestionen sus fotos de perfil.

> [!IMPORTANT]
> **Nota para el Equipo de Base de Datos:**
> ¡Buenas noticias! La estructura relacional de la base de datos (tablas, roles, y conexiones a nivel de código local) **ya está completamente creada y funcionando mediante SQLAlchemy**. 
> **Su siguiente paso clave:** Solo tienen que subir y migrar esta base de datos a la nube (utilizando **Supabase** como indica la arquitectura) y configurar las reglas de seguridad. El código backend se adaptará automáticamente con solo cambiar la variable `DATABASE_URL` en el `.env`.

---

## 🛠️ 1. Nuestro Stack Tecnológico (La Caja de Herramientas)

Todo el proyecto se construirá utilizando herramientas modernas, escalables y con planes gratuitos para desarrolladores.

- **[HECHO] Motor del Servidor: FastAPI (Python)**. Usaremos Python porque es el estándar absoluto de la industria para Inteligencia Artificial. FastAPI es moderno, rapidísimo y crea automáticamente la documentación técnica de nuestras rutas (Swagger) para que el equipo de frontend sepa qué datos pedir. (Ya configurado y corriendo localmente).
- **[HECHO PARCIAL] Base de Datos y Autenticación: Supabase**. Es nuestra plataforma principal (la alternativa a Firebase). Nos proporciona una base de datos relacional **PostgreSQL** ultra segura y maneja el registro de usuarios. (La estructura relacional y los roles ya están creados mediante SQLAlchemy, falta subirla a la nube).
- **[HECHO] Inteligencia Artificial**: **Google MediaPipe** (para leer las manos en la cámara), **Groq API** (reemplazando a Gemini por ser más rápido para procesamiento de texto) y **Modelos Locales como Qwen** (para mayor privacidad y reducción de costos).
- **Mapas: Mapbox API** para renderizar las calles y ubicaciones.
- **Videollamadas: PeerJS o LiveKit Cloud** para conectar las cámaras sin saturar nuestro servidor.

## 🔒 2. Seguridad, Identidad y Accesos (Auth & Roles)

El sistema debe proteger la privacidad médica en todo momento.

- **[HECHO] El Guardián (Supabase Auth / Google OAuth)**: Se encarga de guardar las contraseñas encriptadas y nos permitió habilitar el botón de "Iniciar Sesión con Google" de forma automática (El sistema local ya usa OAuth y cifrado bcrypt).
- **[HECHO] Control de Roles Estricto (RBAC)**: En nuestra base de datos PostgreSQL, cada persona que se registre tiene una etiqueta inmutable: paciente, medico o farmacia. El servidor en FastAPI ya tiene "candados" funcionales. Si un usuario con etiqueta de paciente intenta hacer una petición (HTTP Request) para ver el inventario de una farmacia, el servidor lo bloqueará y devolverá un error 403 (Acceso Denegado).

## 🧠 3. El Ecosistema de Inteligencia Artificial (El Diferenciador)

Este es el módulo estrella del proyecto y requiere una arquitectura especial de 3 fases durante la teleconsulta:
1. **Detección de Movimiento (MediaPipe)**: En la pantalla de la videollamada, el modelo de visión artificial rastreará los 21 puntos clave de las manos del paciente. Esta parte procesa video puro.
2. **Traducción a Texto en Vivo**: Los gestos capturados se envían a nuestro backend en FastAPI, donde se traducen a palabras sueltas.
3. **[HECHO] Procesamiento de Lenguaje Natural (Groq API / Qwen)**: Esas palabras sueltas viajan a la API de Groq (o modelo local Qwen), el cual devuelve oraciones médicas coherentes con gramática perfecta. Estas oraciones se empujan a la pantalla del médico como **subtítulos en tiempo real**.
4. **[HECHO] Generación de Resumen (Post-Consulta)**: Al darle clic a "Finalizar Consulta", nuestro servidor tomará todo el texto hablado en la sesión, se lo pasará a Groq API con un *prompt* clínico oculto, y generará el bloque de "Resumen Clínico IA" (diagnósticos, síntomas) que se guardará en el expediente del paciente.

## 📡 4. Tiempo Real y Comunicación (WebSockets & WebRTC)

Para que la aplicación se sienta "viva" y no tengamos que estar recargando la página.
- **Las Videoconsultas (WebRTC)**: Cuando el médico y el paciente entran a la sala, sus navegadores se conectan directamente entre sí utilizando **PeerJS/LiveKit**. Esto significa que el video HD no pasa por nuestro servidor de Python (lo cual lo haría explotar), sino que viaja de computadora a computadora.
- **Notificaciones Instantáneas (Supabase Realtime)**: Usaremos esta función para los eventos del sistema. Ejemplos críticos:
  - Cuando el paciente entra a la sala, la etiqueta del médico cambia a "En Espera" al instante.
  - Cuando el médico emite una receta, la campana de notificaciones de la farmacia suena en ese mismo milisegundo.

## 🏥 5. Flujos Operativos y Base de Datos Lógica

El equipo de backend tiene que programar reglas matemáticas y de negocio para que nada falle:
- **Geolocalización Avanzada (PostGIS)**: Usaremos una extensión matemática dentro de PostgreSQL llamada PostGIS. Cuando la aplicación necesite buscar "Farmacias Cercanas", nuestra base de datos calculará solita la distancia radial usando latitud y longitud, y le mandará a Mapbox solo las farmacias que estén dentro del rango de 2 kilómetros.
- **Transacciones Seguras (Farmacia e Inventarios)**: Cuando la farmacia le da al botón "Validar y Despachar Receta", el servidor ejecutará una *Transacción ACID*. Esto significa que cambiar el estado de la receta y restar las pastillas del stock del inventario se hace al mismo tiempo. Si el internet se cae en ese segundo, el servidor cancela ambas acciones para que el inventario nunca se corrompa.
- **Limpieza Automática (Cron Jobs)**: Programaremos pequeños scripts en Python que se ejecutarán automáticamente a las 12:00 AM todos los días para limpiar la base de datos (por ejemplo, cambiar el estado de las recetas de "Activa" a "Vencida" si ya pasó su tiempo límite).

## 💻 6. Entorno de Desarrollo y Despliegue (Cómo vamos a trabajar)

Para que el proyecto se pueda presentar y usar en cualquier parte del mundo de forma eficiente:
- **Despliegue del Frontend (Vercel)**: Todo el código visual (React/Tailwind) vivirá en la nube de Vercel. Cada vez que hagamos un cambio en GitHub, la página web se actualizará sola.
- **Despliegue de Base de Datos (Supabase)**: Nuestra base de datos relacional (PostgreSQL) y el sistema de autenticación vivirán en la nube bajo los servidores de Supabase, garantizando que la información médica esté segura las 24 horas.
- **Despliegue del Backend (Servidor Local)**: Nuestro "cerebro" en Python (FastAPI) será alojado y ejecutado directamente en la computadora personal de **Brayan Mateo**, utilizando una partición de Linux (Ubuntu). Esto nos permite tener un servidor ultra-rápido y con la máxima potencia de hardware (sin las limitaciones y esperas de los servidores gratuitos en la nube).

---

## 🎯 Tareas Pendientes por Módulos (Roadmap)

*(Nota: Las tareas del Módulo 1 referentes a Inteligencia Artificial han sido omitidas de esta lista de pendientes, ya que serán manejadas internamente por la gerencia del proyecto).*

### 🗄️ Módulo 2: Arquitectura de Base de Datos y Seguridad (Supabase/PostgreSQL)
**Misión:** Consolidar la base de datos relacional y su seguridad en la nube.
**Responsables:** Ángel, Ancell, Lucero, Enyel, Yeray, Yariely.
- [ ] **Migración a la Nube:** Subir y conectar la estructura de la base de datos actual a **Supabase** (actualmente corriendo en local).
- [ ] **Políticas RLS (Seguridad):** Configurar reglas de acceso a nivel de fila (Row Level Security) en Supabase para que un paciente no pueda ver información confidencial de un médico u otro paciente.
- [ ] **PostGIS en la Nube:** Habilitar la extensión espacial de PostGIS en Supabase para que la ruta de geolocalización de farmacias funcione de manera óptima (el código backend ya está preparado con un *fallback*).

### 🩺 Módulo 3: Lógica Core Médica y Citas (FastAPI)
**Misión:** Programar en Python las rutas de negocio para la agenda médica.
**Responsables:** Sebastián, Dariel, Robert, Estarlin, Justin.
- [ ] **Cron Jobs Automáticos:** Programar scripts de mantenimiento nocturno (12:00 AM) para actualizar estados automáticamente (ej. cambiar las recetas caducadas al estado "vencida").
*(Nota: Las rutas de agenda, estados de citas y recetas digitales ya han sido completamente implementadas en el backend).*

### 💊 Módulo 4: Lógica de Farmacia, Inventario y Mapas (FastAPI)
**Misión:** Programar el sistema de transacciones matemáticas y geolocalización.
**Responsables:** Aquilino, Franklin, Franklelin, Carlos, Héctor.
- [ ] **Conexión Geográfica (Mapbox):** Aunque el backend ya calcula y devuelve correctamente la distancia radial usando latitud/longitud (PostGIS/Haversine), falta integrar la API real de **Mapbox** en el frontend (React) para pintar el mapa interactivo (actualmente hay un mapa falso simulado con CSS en `FarmaciasMapaView.tsx`).
*(Nota: Las transacciones ACID de recetas y el sistema de estados de pedidos a proveedores ya han sido implementados).*

### 📡 Módulo 5: Infraestructura de Videollamadas y Tiempo Real (WebRTC / WebSockets)
**Misión:** Construir los túneles de conexión en vivo y alertas del sistema.
**Responsables:** Enyer, Ismalby, Rey, Adian, Michael.
- [ ] **Integración Frontend de Videollamada (WebRTC):** Aunque el servidor de WebSockets para la señalización ya está construido en FastAPI, falta integrar el cliente de PeerJS/LiveKit en la pantalla (UI) de videollamadas del frontend para conectar los flujos de cámara y micrófono.
*(Nota: El servidor de WebSockets para señalización y transmisión de subtítulos en vivo ya está implementado en el backend).*

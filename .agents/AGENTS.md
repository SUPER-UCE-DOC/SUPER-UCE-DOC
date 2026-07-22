# Reglas y Estándares del Chatbot Clínico SUPER-UCE-DOC

## 1. Separación del Contexto de Citas (Pasadas vs Futuras)
- En `app/routers/ai.py`, separar estrictamente las citas en:
  - `CITAS FUTURAS Y PENDIENTES`: Citas con fecha posterior/igual a hoy y estado `pendiente` o `confirmada`.
  - `CONSULTAS PASADAS Y FINALIZADAS`: Citas con estado `completada` y resúmenes en `models.ClinicalHistory`.
  - `CITAS RECHAZADAS (OCULTAS)`: Solo mencionables si el usuario pregunta explícitamente por qué se rechazó su cita (motivo: disponibilidad o agenda del médico).

## 2. Comportamiento Conversacional RAG
- **Cero repetición de contexto previo**: Cada respuesta debe ir directo al grano según lo que el usuario preguntó en su último mensaje. Queda prohibido repetir frases introductorias o resúmenes de estatus de turnos anteriores.
- **Formato directo**: Sin viñetas excesivas ni muletillas como "Según la base de datos".

## 3. Funcionalidades Inalterables de la Plataforma
- **Teleconsultas 100% Integradas**: Ocurren directamente dentro de la plataforma SUPER-UCE DOC (videollamada integrada). Jamás decir que se usará llamada telefónica, Zoom, WhatsApp o enlaces externos.
- **Historial y Resultados**: Los doctores visualizan las analíticas del paciente directamente en su panel de SUPER-UCE DOC.
- **Geolocalización de Farmacias**: Incluye mapa interactivo para ubicar farmacias cercanas y disponibilidad de medicamentos.
- **Coherencia Total**: Cero contradicciones con respuestas emitidas en turnos anteriores.

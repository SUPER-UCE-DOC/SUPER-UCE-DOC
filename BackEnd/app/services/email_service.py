import smtplib
from email.message import EmailMessage
from email.utils import make_msgid
import logging
import os
from app.config import settings

logger = logging.getLogger("email_service")

class EmailService:
    def _get_logo_path(self) -> str:
        # Subir 4 niveles desde BackEnd/app/services/email_service.py hasta la raíz del proyecto
        root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        target = os.path.join(root_dir, "FrontEnd", "src", "imports", "image-1.png")
        if os.path.exists(target):
            return target
        # Fallback alternativo
        alt_target = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "FrontEnd", "src", "imports", "image-1.png"))
        if os.path.exists(alt_target):
            return alt_target
        return target

    def send_verification_code(self, to_email: str, code: str) -> bool:
        """
        Envía un correo electrónico con el código OTP de 6 dígitos.
        Si no hay credenciales SMTP configuradas, imprime el código de forma visible en la consola para desarrollo local.
        """
        # 1. Notificación legible en consola de desarrollo
        print(f"\n=======================================================")
        print(f" [CODIGO DE VERIFICACION DE CORREO SUPER-UCE DOC]")
        print(f" -> Para: {to_email}")
        print(f" -> CODIGO DE 6 DIGITOS:  *** {code} ***")
        print(f" -> Validez: 15 minutos")
        print(f"=======================================================\n")

        smtp_user = settings.SMTP_USER
        smtp_password = settings.SMTP_PASSWORD

        if not smtp_user or not smtp_password:
            logger.info("Modo Desarrollo: Sin credenciales SMTP configuradas. Código impreso en consola.")
            return True

        # 2. Enviar correo SMTP real con EmailMessage + add_related (estándar RFC 2392 para Gmail)
        try:
            subject = "Código de Verificación de Cuenta - SUPER-UCE DOC"
            
            msg = EmailMessage()
            msg["Subject"] = subject
            msg["From"] = f"SUPER-UCE DOC <{smtp_user}>"
            msg["To"] = to_email

            # Generar Content-ID único para la imagen según estándar Gmail/Python 3.6+
            cid = make_msgid(domain="superucedoc.org")
            cid_clean = cid[1:-1] # Quitar corchetes < > para el atributo src en el HTML

            logo_path = self._get_logo_path()
            has_logo_file = os.path.exists(logo_path)

            logo_html_tag = f'<img src="cid:{cid_clean}" alt="SUPER-UCE DOC" class="logo-img" />' if has_logo_file else '''
            <div class="vector-logo">
              <div class="brand-text"><span class="b-super">SUPER-UCE</span><span class="b-doc">DOC</span></div>
            </div>
            '''

            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {{
                  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background-color: #F8FAFC;
                  margin: 0;
                  padding: 40px 16px;
                  -webkit-font-smoothing: antialiased;
                }}
                .wrapper {{
                  max-width: 520px;
                  margin: 0 auto;
                  text-align: center;
                }}
                .logo-container {{
                  margin-bottom: 24px;
                  text-align: center;
                }}
                .logo-img {{
                  max-height: 80px;
                  height: 80px;
                  width: auto;
                  display: block;
                  margin: 0 auto 6px auto;
                  object-fit: contain;
                }}
                .vector-logo {{
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  gap: 12px;
                  margin-bottom: 6px;
                }}
                .brand-text {{
                  font-size: 26px;
                  font-weight: 900;
                  letter-spacing: -0.5px;
                }}
                .b-super {{ color: #00A69D; }}
                .b-doc {{ color: #203A70; margin-left: 3px; }}
                .subtitle {{
                  font-size: 13.5px;
                  color: #64748B;
                  font-weight: 500;
                  margin-top: 4px;
                  margin-bottom: 0;
                }}
                .card {{
                  background: #FFFFFF;
                  border: 2px solid #203A70;
                  border-radius: 24px;
                  padding: 38px 32px;
                  box-shadow: 0 10px 30px rgba(32, 58, 112, 0.08);
                  text-align: center;
                }}
                .title {{
                  font-size: 21px;
                  font-weight: 800;
                  color: #203A70;
                  margin-top: 0;
                  margin-bottom: 14px;
                  line-height: 1.3;
                }}
                .text {{
                  font-size: 14.5px;
                  color: #475569;
                  line-height: 1.6;
                  margin-bottom: 24px;
                }}
                .code-digits {{
                  font-size: 44px;
                  font-weight: 800;
                  color: #00A69D;
                  letter-spacing: 14px;
                  margin: 28px 0;
                  padding-left: 14px;
                  text-align: center;
                  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }}
                .notice {{
                  font-size: 13px;
                  color: #64748B;
                  font-style: italic;
                  line-height: 1.5;
                  margin-bottom: 28px;
                }}
                .card-footer {{
                  border-top: 1px solid #E2E8F0;
                  padding-top: 18px;
                  font-size: 12px;
                  color: #94A3B8;
                  font-weight: 500;
                }}
                .outer-footer {{
                  margin-top: 24px;
                  font-size: 12px;
                  color: #94A3B8;
                  font-weight: 500;
                }}
              </style>
            </head>
            <body>
              <div class="wrapper">
                <!-- Encabezado con Logo oficial SUPER-UCE DOC mediante EmailMessage add_related CID -->
                <div class="logo-container">
                  {logo_html_tag}
                  <div class="subtitle">Plataforma Médica Interdisciplinaria</div>
                </div>

                <!-- Tarjeta Principal con Estilo de la Plataforma (Borde Azul Marino) -->
                <div class="card">
                  <div class="title">Verificación de Cuenta</div>
                  <div class="text">
                    Hola, para completar el registro de tu cuenta y garantizar la seguridad de tus datos, ingresa el siguiente código de verificación de 6 dígitos:
                  </div>

                  <!-- Código de 6 Dígitos Limpio sin cuadro punteado -->
                  <div class="code-digits">{code}</div>

                  <div class="notice">
                    Este código expira en 15 minutos. Si no solicitaste este registro, por favor ignora este correo.
                  </div>

                  <div class="card-footer">
                    Plataforma segura conforme a estándares de salud — HIPAA / HL7
                  </div>
                </div>

                <!-- Pie de página exterior -->
                <div class="outer-footer">
                  © 2026 SUPER-UCE DOC · Universidad Central del Este
                </div>
              </div>
            </body>
            </html>
            """

            msg.add_alternative(html_content, subtype="html")

            # Adjuntar la parte relacional de la imagen usando EmailMessage add_related
            if has_logo_file:
                with open(logo_path, "rb") as f:
                    img_data = f.read()
                    msg.get_payload()[0].add_related(
                        img_data,
                        maintype="image",
                        subtype="png",
                        cid=cid
                    )

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.send_message(msg)

            logger.info(f"Correo de verificación enviado exitosamente a {to_email}")
            return True
        except Exception as e:
            logger.error(f"Error enviando correo SMTP a {to_email}: {e}")
            return False

    def _format_doctor_name(self, name: str) -> str:
        if not name:
            return "Dr."
        name_clean = name.strip()
        lower = name_clean.lower()
        if lower.startswith("dr.") or lower.startswith("dra.") or lower.startswith("dr ") or lower.startswith("dra "):
            return name_clean
        return f"Dr. {name_clean}"

    def send_appointment_status_email(self, to_email: str, patient_name: str, doctor_name: str, date_time_str: str, status_name: str, reason: str = "", is_created_by_doctor: bool = False) -> bool:
        """
        Envía una notificación por correo al paciente cuando el estado de su cita cambia o cuando el médico agenda una nueva cita.
        """
        print(f"\n=======================================================")
        print(f" [NOTIFICACION DE CITA MEDICA SUPER-UCE DOC]")
        print(f" -> Para: {to_email}")
        print(f" -> Paciente: {patient_name} | Doctor: {doctor_name}")
        print(f" -> Estado: {status_name.upper()} | Agendada por Médico: {is_created_by_doctor}")
        print(f"=======================================================\n")

        smtp_user = settings.SMTP_USER
        smtp_password = settings.SMTP_PASSWORD

        if not smtp_user or not smtp_password:
            logger.info("Modo Desarrollo: Sin credenciales SMTP. Notificación de cita impresa en consola.")
            return True

        try:
            doc_display = self._format_doctor_name(doctor_name)
            clean_status = status_name.replace("_", " ")
            is_confirmed = status_name.lower() in ["confirmada", "en_curso"]
            status_color = "#00A69D" if is_confirmed else "#EF4444"
            status_bg = "#F0FFFE" if is_confirmed else "#FEF2F2"
            status_title = "CITA CONFIRMADA" if status_name.lower() == "confirmada" else f"CITA {clean_status.upper()}"

            if is_created_by_doctor:
                subject = f"Nueva Cita Médica Agendada (CITA CONFIRMADA) - SUPER-UCE DOC"
                card_title = "Nueva Cita Médica Agendada"
                intro_text = f"Hola <strong>{patient_name}</strong>, te notificamos que el <strong>{doc_display}</strong> ha agendado una nueva cita médica que se encuentra <strong>confirmada</strong>:"
            else:
                subject = f"Actualización de Cita Médica ({status_title}) - SUPER-UCE DOC"
                card_title = "Actualización de Cita Médica"
                intro_text = f"Hola <strong>{patient_name}</strong>, se ha registrado un cambio en el estado de tu consulta médica:"

            msg = EmailMessage()
            msg["Subject"] = subject
            msg["From"] = f"SUPER-UCE DOC <{smtp_user}>"
            msg["To"] = to_email

            cid = make_msgid(domain="superucedoc.org")
            cid_clean = cid[1:-1]

            logo_path = self._get_logo_path()
            has_logo_file = os.path.exists(logo_path)
            logo_html_tag = f'<img src="cid:{cid_clean}" alt="SUPER-UCE DOC" class="logo-img" />' if has_logo_file else '<div class="brand-text"><span class="b-super">SUPER-UCE</span><span class="b-doc">DOC</span></div>'

            reason_html = f'<p style="margin: 6px 0 0 0; font-size: 13px; color: #64748B;"><strong>Motivo / Nota:</strong> {reason}</p>' if reason else ''

            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {{
                  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background-color: #F8FAFC;
                  margin: 0;
                  padding: 40px 16px;
                  -webkit-font-smoothing: antialiased;
                }}
                .wrapper {{
                  max-width: 520px;
                  margin: 0 auto;
                  text-align: center;
                }}
                .logo-container {{
                  margin-bottom: 24px;
                  text-align: center;
                }}
                .logo-img {{
                  max-height: 80px;
                  height: 80px;
                  width: auto;
                  display: block;
                  margin: 0 auto 6px auto;
                  object-fit: contain;
                }}
                .subtitle {{
                  font-size: 13.5px;
                  color: #64748B;
                  font-weight: 500;
                  margin-top: 4px;
                  margin-bottom: 0;
                }}
                .card {{
                  background: #FFFFFF;
                  border: 2px solid #203A70;
                  border-radius: 24px;
                  padding: 38px 32px;
                  box-shadow: 0 10px 30px rgba(32, 58, 112, 0.08);
                  text-align: center;
                }}
                .title {{
                  font-size: 21px;
                  font-weight: 800;
                  color: #203A70;
                  margin-top: 0;
                  margin-bottom: 14px;
                  line-height: 1.3;
                }}
                .text {{
                  font-size: 14.5px;
                  color: #475569;
                  line-height: 1.6;
                  margin-bottom: 20px;
                }}
                .badge {{
                  display: inline-block;
                  padding: 10px 20px;
                  border-radius: 14px;
                  font-weight: 800;
                  font-size: 15px;
                  letter-spacing: 0.5px;
                  margin: 10px 0 20px 0;
                  background-color: {status_bg};
                  color: {status_color};
                  border: 1px solid {status_color}40;
                }}
                .info-box {{
                  background-color: #F8FAFC;
                  border-radius: 16px;
                  padding: 18px 20px;
                  border: 1px solid #E2E8F0;
                  text-align: left;
                  margin-bottom: 24px;
                  font-size: 14px;
                  color: #334155;
                  line-height: 1.7;
                }}
                .notice {{
                  font-size: 13px;
                  color: #64748B;
                  font-style: italic;
                  line-height: 1.5;
                  margin-bottom: 28px;
                }}
                .card-footer {{
                  border-top: 1px solid #E2E8F0;
                  padding-top: 18px;
                  font-size: 12px;
                  color: #94A3B8;
                  font-weight: 500;
                }}
                .outer-footer {{
                  margin-top: 24px;
                  font-size: 12px;
                  color: #94A3B8;
                  font-weight: 500;
                }}
              </style>
            </head>
            <body>
              <div class="wrapper">
                <div class="logo-container">
                  {logo_html_tag}
                  <div class="subtitle">Plataforma Médica Interdisciplinaria</div>
                </div>

                <div class="card">
                  <div class="title">{card_title}</div>
                  <div class="text">
                    {intro_text}
                  </div>

                  <div class="badge">{status_title}</div>

                  <div class="info-box">
                    <p style="margin: 0 0 6px 0;"><strong>Médico Especialista:</strong> {doc_display}</p>
                    <p style="margin: 0 0 6px 0;"><strong>Fecha y Hora:</strong> {date_time_str}</p>
                    <p style="margin: 0;"><strong>Modalidad:</strong> Teleconsulta Integrada SUPER-UCE DOC</p>
                    {reason_html}
                  </div>

                  <div class="notice">
                    Ingresa a la plataforma SUPER-UCE DOC para revisar los detalles completos o unirte a la teleconsulta.
                  </div>

                  <div class="card-footer">
                    Plataforma segura conforme a estándares de salud — HIPAA / HL7
                  </div>
                </div>

                <div class="outer-footer">
                  © 2026 SUPER-UCE DOC · Universidad Central del Este
                </div>
              </div>
            </body>
            </html>
            """

            msg.add_alternative(html_content, subtype="html")

            if has_logo_file:
                with open(logo_path, "rb") as f:
                    msg.get_payload()[0].add_related(f.read(), maintype="image", subtype="png", cid=cid)

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.send_message(msg)

            logger.info(f"Correo de actualización de cita enviado exitosamente a {to_email}")
            return True
        except Exception as e:
            logger.error(f"Error enviando correo de cita a {to_email}: {e}")
            return False

    def send_prescription_email(self, to_email: str, patient_name: str, doctor_name: str, medicine: str, dose: str, frequency: str, rx_id: str) -> bool:
        """
        Envía una notificación por correo al paciente cuando su médico emite una nueva receta médica.
        """
        print(f"\n=======================================================")
        print(f" [NOTIFICACION DE RECETA MEDICA SUPER-UCE DOC]")
        print(f" -> Para: {to_email}")
        print(f" -> Paciente: {patient_name} | Doctor: {doctor_name}")
        print(f" -> Folio Rx: {rx_id} | Medicamento: {medicine}")
        print(f"=======================================================\n")

        smtp_user = settings.SMTP_USER
        smtp_password = settings.SMTP_PASSWORD

        if not smtp_user or not smtp_password:
            logger.info("Modo Desarrollo: Sin credenciales SMTP. Notificación de receta impresa en consola.")
            return True

        try:
            doc_display = self._format_doctor_name(doctor_name)
            subject = f"Nueva Receta Médica Emitida (Folio {rx_id}) - SUPER-UCE DOC"
            
            msg = EmailMessage()
            msg["Subject"] = subject
            msg["From"] = f"SUPER-UCE DOC <{smtp_user}>"
            msg["To"] = to_email

            cid = make_msgid(domain="superucedoc.org")
            cid_clean = cid[1:-1]

            logo_path = self._get_logo_path()
            has_logo_file = os.path.exists(logo_path)
            logo_html_tag = f'<img src="cid:{cid_clean}" alt="SUPER-UCE DOC" class="logo-img" />' if has_logo_file else '<div class="brand-text"><span class="b-super">SUPER-UCE</span><span class="b-doc">DOC</span></div>'

            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {{
                  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background-color: #F8FAFC;
                  margin: 0;
                  padding: 40px 16px;
                  -webkit-font-smoothing: antialiased;
                }}
                .wrapper {{
                  max-width: 520px;
                  margin: 0 auto;
                  text-align: center;
                }}
                .logo-container {{
                  margin-bottom: 24px;
                  text-align: center;
                }}
                .logo-img {{
                  max-height: 80px;
                  height: 80px;
                  width: auto;
                  display: block;
                  margin: 0 auto 6px auto;
                  object-fit: contain;
                }}
                .subtitle {{
                  font-size: 13.5px;
                  color: #64748B;
                  font-weight: 500;
                  margin-top: 4px;
                  margin-bottom: 0;
                }}
                .card {{
                  background: #FFFFFF;
                  border: 2px solid #203A70;
                  border-radius: 24px;
                  padding: 38px 32px;
                  box-shadow: 0 10px 30px rgba(32, 58, 112, 0.08);
                  text-align: center;
                }}
                .title {{
                  font-size: 21px;
                  font-weight: 800;
                  color: #203A70;
                  margin-top: 0;
                  margin-bottom: 14px;
                  line-height: 1.3;
                }}
                .text {{
                  font-size: 14.5px;
                  color: #475569;
                  line-height: 1.6;
                  margin-bottom: 20px;
                }}
                .rx-box {{
                  background-color: #F0FFFE;
                  border: 2px solid #00A69D;
                  border-radius: 18px;
                  padding: 22px 20px;
                  text-align: left;
                  margin-bottom: 24px;
                }}
                .rx-folio {{
                  font-size: 13px;
                  font-weight: 800;
                  color: #203A70;
                  border-bottom: 1px solid #CCFBF6;
                  padding-bottom: 8px;
                  margin-bottom: 12px;
                }}
                .rx-item {{
                  font-size: 14px;
                  color: #334155;
                  margin-bottom: 6px;
                  line-height: 1.5;
                }}
                .notice {{
                  font-size: 13px;
                  color: #64748B;
                  font-style: italic;
                  line-height: 1.5;
                  margin-bottom: 28px;
                }}
                .card-footer {{
                  border-top: 1px solid #E2E8F0;
                  padding-top: 18px;
                  font-size: 12px;
                  color: #94A3B8;
                  font-weight: 500;
                }}
                .outer-footer {{
                  margin-top: 24px;
                  font-size: 12px;
                  color: #94A3B8;
                  font-weight: 500;
                }}
              </style>
            </head>
            <body>
              <div class="wrapper">
                <div class="logo-container">
                  {logo_html_tag}
                  <div class="subtitle">Plataforma Médica Interdisciplinaria</div>
                </div>

                <div class="card">
                  <div class="title">Nueva Receta Médica Disponible</div>
                  <div class="text">
                    Hola <strong>{patient_name}</strong>, el <strong>{doc_display}</strong> ha emitido una receta médica digital para tu tratamiento:
                  </div>

                  <div class="rx-box">
                    <div class="rx-folio">📄 FOLIO DIGITAL: {rx_id}</div>
                    <div class="rx-item"><strong>Medicamento:</strong> {medicine}</div>
                    <div class="rx-item"><strong>Dosis:</strong> {dose}</div>
                    <div class="rx-item"><strong>Frecuencia / Indicaciones:</strong> {frequency}</div>
                  </div>

                  <div class="notice">
                    Puedes consultar el mapa interactivo de farmacias cercanas y disponibilidad de medicamentos directamente en SUPER-UCE DOC.
                  </div>

                  <div class="card-footer">
                    Plataforma segura conforme a estándares de salud — HIPAA / HL7
                  </div>
                </div>

                <div class="outer-footer">
                  © 2026 SUPER-UCE DOC · Universidad Central del Este
                </div>
              </div>
            </body>
            </html>
            """

            msg.add_alternative(html_content, subtype="html")

            if has_logo_file:
                with open(logo_path, "rb") as f:
                    msg.get_payload()[0].add_related(f.read(), maintype="image", subtype="png", cid=cid)

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.send_message(msg)

            logger.info(f"Correo de receta médica enviado exitosamente a {to_email}")
            return True
        except Exception as e:
            logger.error(f"Error enviando correo de receta a {to_email}: {e}")
            return False

email_service = EmailService()

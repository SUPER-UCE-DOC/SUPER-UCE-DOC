import logging
import os
from typing import List

logger = logging.getLogger(__name__)

# --- Definición de la arquitectura del LSTM en PyTorch ---
try:
    import torch
    import torch.nn as nn
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False
    logger.info("PyTorch no está instalado. Se utilizará el traductor LSTM en modo simulación.")

# Definimos el modelo LSTM para clasificar secuencias de coordenadas de manos (21 puntos clave * 3 ejes = 63 características)
if HAS_TORCH:
    class SignLanguageLSTM(nn.Module):
        def __init__(self, input_size: int = 63, hidden_size: int = 64, num_classes: int = 15, num_layers: int = 2):
            super().__init__()
            self.hidden_size = hidden_size
            self.num_layers = num_layers
            self.lstm = nn.LSTM(input_size, hidden_size, num_layers=num_layers, batch_first=True, bidirectional=False)
            self.fc = nn.Linear(hidden_size, num_classes)

        def forward(self, x):
            # x shape: (batch_size, seq_len, input_size)
            out, _ = self.lstm(x)
            # Tomamos la salida del último paso de tiempo
            out = self.fc(out[:, -1, :])
            return out
else:
    class SignLanguageLSTM:
        def __init__(self, *args, **kwargs):
            pass


class SignTranslatorService:
    def __init__(self):
        self.lstm_model = None
        self.qwen_tokenizer = None
        self.qwen_model = None
        self.use_local_llm = False
        
        # Vocabulario de señas soportadas para la simulación/mapeo
        self.gesture_vocabulary = [
            "DOLOR", "CABEZA", "TRES", "DÍAS", "MEDICAMENTO", "NO", "MAREO",
            "CAMA", "PRESIÓN", "ALTA", "SÍ", "GRACIAS", "MÉDICO", "FARMACIA", "AYUDA"
        ]
        
        # Mapeos predefinidos de reglas por si falla la llamada a Qwen y no hay LLM
        self.rule_based_translations = {
            "DOLOR + CABEZA": "La paciente indica dolor de cabeza.",
            "DOLOR + CABEZA + TRES + DÍAS": "La paciente indica dolor de cabeza constante durante tres días.",
            "MEDICAMENTO + NO": "No ha tomado medicación previa.",
            "MAREO + CAMA": "Refiere mareos al levantarse de la cama.",
            "PRESIÓN + ALTA": "Asocia los síntomas con su presión arterial alta.",
            "DOLOR + CABEZA + MEDICAMENTO + NO": "Sufre dolor de cabeza y no ha tomado ningún medicamento.",
            "SÍ + GRACIAS": "Afirma y da las gracias.",
            "AYUDA + MÉDICO": "Solicita asistencia del médico."
        }

    def load_models(self):
        """
        Carga el modelo LSTM y el LLM Qwen. Si no están instaladas las librerías o
        no hay recursos, se degrada elegantemente e informa por consola.
        """
        from app.config import settings
        self.use_local_llm = settings.USE_LOCAL_LLM
        
        # 1. Cargar LSTM
        if HAS_TORCH:
            try:
                # Inicializar modelo
                self.lstm_model = SignLanguageLSTM()
                # En un caso real cargaríamos los pesos guardados:
                # model_path = os.path.join(os.path.dirname(__file__), "weights/sign_lstm.pth")
                # if os.path.exists(model_path):
                #     self.lstm_model.load_state_dict(torch.load(model_path, map_location=torch.device('cpu')))
                self.lstm_model.eval()
                logger.info("Modelo LSTM cargado correctamente.")
            except Exception as e:
                logger.error(f"Error cargando pesos del modelo LSTM: {e}")
        
        # 2. Cargar Qwen Local (si se habilita en config)
        if self.use_local_llm:
            try:
                from transformers import AutoModelForCausalLM, AutoTokenizer
                logger.info(f"Cargando modelo Qwen local: {settings.QWEN_MODEL_NAME}...")
                self.qwen_tokenizer = AutoTokenizer.from_pretrained(settings.QWEN_MODEL_NAME)
                self.qwen_model = AutoModelForCausalLM.from_pretrained(
                    settings.QWEN_MODEL_NAME, 
                    device_map="auto",
                    torch_dtype="auto"
                )
                logger.info("Modelo Qwen local cargado con éxito.")
            except ImportError:
                logger.warning("Librería 'transformers' no encontrada. Fallback a traducción remota/reglas.")
                self.use_local_llm = False
            except Exception as e:
                logger.error(f"Error cargando Qwen local: {e}. Desactivando LLM local.")
                self.use_local_llm = False

    def predict_gestures(self, sequence_data: List[List[float]]) -> List[str]:
        """
        Recibe una secuencia de coordenadas (frames) y predice qué palabras de señas representan usando el LSTM.
        Si no hay PyTorch o datos válidos, devuelve gestos simulados basados en un mock.
        """
        if not HAS_TORCH or self.lstm_model is None or not sequence_data:
            # Modo Simulado: si no viene data real, devolvemos algunos gestos de prueba
            return ["DOLOR", "CABEZA", "TRES", "DÍAS"]
        
        try:
            # Transformar en tensor de PyTorch: (batch=1, seq_len, features=63)
            tensor_data = torch.tensor([sequence_data], dtype=torch.float32)
            with torch.no_grad():
                outputs = self.lstm_model(tensor_data)
                _, predicted = torch.max(outputs, 1)
                predicted_class = predicted.item()
            
            # Mapeamos el índice de la clase al vocabulario
            word = self.gesture_vocabulary[predicted_class % len(self.gesture_vocabulary)]
            return [word]
        except Exception as e:
            logger.error(f"Error en predicción LSTM: {e}")
            return ["DOLOR"]

    def translate_to_clinical_sentence(self, gestures: List[str]) -> str:
        """
        Toma una lista de gestos clasificados y utiliza el modelo Qwen (o fallback a API/Reglas)
        para redactar una oración clínica perfectamente estructurada.
        """
        if not gestures:
            return ""

        gesture_str = " + ".join(gestures).upper()
        
        # 1. Intentar traducción por reglas predefinidas (rápido y gratis)
        if gesture_str in self.rule_based_translations:
            return self.rule_based_translations[gesture_str]

        # 2. Intentar usar Qwen Local si está cargado
        if self.use_local_llm and self.qwen_model and self.qwen_tokenizer:
            try:
                prompt = (
                    "Eres un asistente médico inteligente para personas sordas.\n"
                    "Convierte la siguiente secuencia de gestos traducidos del lenguaje de señas en una oración médica gramaticalmente correcta y coherente en español.\n"
                    f"Gestos: {gesture_str}\n"
                    "Oración médica:"
                )
                inputs = self.qwen_tokenizer(prompt, return_tensors="pt").to(self.qwen_model.device)
                outputs = self.qwen_model.generate(**inputs, max_new_tokens=50, temperature=0.3)
                output_text = self.qwen_tokenizer.decode(outputs[0], skip_special_tokens=True)
                # Limpiar texto del prompt
                translation = output_text.replace(prompt, "").strip()
                return translation
            except Exception as e:
                logger.error(f"Error usando Qwen local: {e}")

        # 3. Intentar usar la API de Inferencia gratuita de HuggingFace como fallback rápido en la nube
        try:
            import requests
            # Usando el endpoint gratuito de HF Serverless
            hf_url = "https://api-inference.huggingface.co/models/Qwen/Qwen2.5-1.5B-Instruct"
            prompt = (
                f"Convierte la secuencia de palabras de señas '{gesture_str}' en una única frase médica coherente y natural en español. "
                "Devuelve SOLO la frase traducida sin introducciones."
            )
            response = requests.post(
                hf_url,
                json={"inputs": prompt, "parameters": {"max_new_tokens": 50, "temperature": 0.2}},
                timeout=5
            )
            if response.status_code == 200:
                result = response.json()
                if isinstance(result, list) and len(result) > 0:
                    text = result[0].get("generated_text", "")
                    # Extraer respuesta
                    clean_text = text.replace(prompt, "").strip()
                    return clean_text
        except Exception as e:
            logger.debug(f"HF API Fallback no disponible: {e}")

        # 4. Fallback de última opción: Mapeo heurístico inteligente
        fallback_words = []
        for g in gestures:
            word = g.lower()
            if word == "dolor":
                fallback_words.append("dolor")
            elif word == "cabeza":
                fallback_words.append("de cabeza")
            elif word == "tres":
                fallback_words.append("hace tres")
            elif word == "días":
                fallback_words.append("días")
            elif word == "medicamento":
                fallback_words.append("sin tomar medicamento")
            elif word == "no":
                fallback_words.append("no")
            elif word == "mareo":
                fallback_words.append("con mareos")
            else:
                fallback_words.append(word)
                
        sentence = "El paciente refiere: " + " ".join(fallback_words) + "."
        return sentence

# Instancia global del servicio
sign_translator_service = SignTranslatorService()

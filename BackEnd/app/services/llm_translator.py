import asyncio
import re
import threading
from typing import List
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
import concurrent.futures

# Singleton para el modelo de MarianMT (Traducción rápida In-Memory)
_model_name = "Helsinki-NLP/opus-mt-en-es"
_tokenizer = None
_model = None
_model_lock = threading.Lock()
_executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)

def _load_model_if_needed():
    global _tokenizer, _model
    with _model_lock:
        if _tokenizer is None or _model is None:
            print("[Traductor Local] Cargando modelo en RAM...")
            _tokenizer = AutoTokenizer.from_pretrained(_model_name)
            _model = AutoModelForSeq2SeqLM.from_pretrained(_model_name)
            print("[Traductor Local] Modelo cargado exitosamente.")

class SpanishNaturalizer:
    """
    Capa lingüística determinista basada en reglas estrictas.
    Prioriza fidelidad absoluta médica. No inventa información.
    """
    def __init__(self):
        self.safe_replacements = [
            (r"\bdolor de estómago vómito\b", "dolor de estómago y vómito"),
            (r"\bfiebre fría\b", "fiebre y escalofríos"),
            (r"\bcomida para la camisa\b", "ropa y comida"),
            (r"\bmedicina hoy\b", "medicina hoy"),
            (r"\bsin dolor torácico\b", "sin dolor de pecho"),
            (r"\bpíldora 2 hoy\b", "2 pastillas hoy"),
        ]

    def naturalize(self, gloss: str, marian_text: str) -> str:
        gloss_lower = gloss.lower().strip()
        marian_lower = marian_text.lower().strip()

        # 1. Reglas directas de Gloss (Máxima Seguridad Médica)
        if gloss_lower == "no chest pain":
            return "Sin dolor de pecho."
        if gloss_lower == "no pill" or gloss_lower == "no medicine":
            return "Ninguna pastilla."
        if gloss_lower == "head pain":
            return "Dolor de cabeza."
        if gloss_lower == "chest pain":
            return "Dolor de pecho."
        if gloss_lower == "pain":
            return "Dolor."
        if gloss_lower == "pill 2 today":
            return "2 pastillas hoy."
        if gloss_lower == "medicine today":
            return "Medicina hoy."
        if gloss_lower == "chest pain yesterday":
            return "Dolor de pecho ayer."
        if gloss_lower == "stomach pain vomit fever":
            return "Dolor de estómago, vómito y fiebre."
        if gloss_lower == "stomach pain vomit today":
            return "Dolor de estómago y vómito hoy."
            
        # 2. Si no hay patrón estricto, aplicar reemplazos limpios a MarianMT
        text = marian_text
        for pattern, replacement in self.safe_replacements:
            text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)

        # Capitalización y punto final (Fallback seguro)
        if text:
            text = text[0].upper() + text[1:]
            if not text.endswith("."):
                text += "."

        return text

_naturalizer = SpanishNaturalizer()

def _run_marian_and_naturalize(gloss_sentence: str) -> str:
    """ Función síncrona que ejecuta el modelo local. """
    _load_model_if_needed()
    
    # Inferencia rápida
    inputs = _tokenizer(gloss_sentence, return_tensors="pt")
    outputs = _model.generate(**inputs, max_length=50)
    marian_out = _tokenizer.decode(outputs[0], skip_special_tokens=True)
    
    # Naturalización determinista
    final_out = _naturalizer.naturalize(gloss_sentence, marian_out)
    return final_out

async def translate_signs_to_sentence(words: List[str]) -> str:
    """
    Toma una lista de palabras aisladas en inglés (o español) producidas por el modelo visual ISLR
    y usa el traductor local veloz MarianMT + NLP Naturalizer.
    """
    if not words:
        return ""

    gloss_sentence = " ".join(words).strip()
    
    try:
        loop = asyncio.get_event_loop()
        # Ejecutamos la inferencia en un ThreadPool para no bloquear el loop de WebSockets
        final_sentence = await loop.run_in_executor(_executor, _run_marian_and_naturalize, gloss_sentence)
        
        with open("llm_debug.log", "a", encoding="utf-8") as f:
            f.write(f"[Traductor Local] IN: {gloss_sentence} | OUT: {final_sentence}\n")
            
        return final_sentence
    except Exception as e:
        import traceback
        error_msg = f"[Traductor Local] Error: {type(e).__name__} - {repr(e)}\n{traceback.format_exc()}"
        print(error_msg)
        with open("llm_debug.log", "a", encoding="utf-8") as f:
            f.write(error_msg + "\n")
        return gloss_sentence # Fallback absoluto si falla la traducción

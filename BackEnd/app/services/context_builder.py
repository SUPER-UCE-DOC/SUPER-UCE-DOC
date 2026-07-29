class ContextBuilder:
    def build_context(self, system_prompt: str, medical_rules: str, 
                      patient_memories: str, teleconsultations: str, 
                      conversation_summary: str, recent_history: list, 
                      rag_chunks: str, user_message: str) -> dict:
        """
        Devuelve una estructura de contexto separada para ensamblar el prompt nativo de la API.
        """
        # Unir reglas estáticas
        system_instruction = ""
        if system_prompt:
            system_instruction += f"{system_prompt}\n"
        if medical_rules:
            system_instruction += f"{medical_rules}\n"
            
        return {
            "system_instruction": system_instruction.strip(),
            "patient_context": patient_memories,
            "teleconsultation_context": teleconsultations,
            "conversation_summary": conversation_summary,
            "rag_context": rag_chunks,
            "conversation_history": recent_history,
            "user_message": user_message
        }

context_builder = ContextBuilder()

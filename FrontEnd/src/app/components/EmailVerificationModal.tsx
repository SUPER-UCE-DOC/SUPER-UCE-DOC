"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Mail, ShieldCheck, AlertCircle, X, Loader2 } from "lucide-react";
import { api } from "../utils/api";

interface EmailVerificationModalProps {
  email: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
}

export function EmailVerificationModal({
  email,
  isOpen,
  onClose,
  onSuccess,
}: EmailVerificationModalProps) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setDigits(["", "", "", "", "", ""]);
      setErrorMsg(null);
      setIsClosing(false);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  const handleChange = (index: number, value: string) => {
    setErrorMsg(null);
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];
    // Manejar pegado de código completo (6 dígitos)
    if (value.length > 1) {
      const pastedDigits = value.slice(0, 6).split("");
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pastedDigits[i] || "";
      }
      setDigits(newDigits);
      inputRefs.current[Math.min(pastedDigits.length, 5)]?.focus();
      return;
    }

    newDigits[index] = value.slice(-1);
    setDigits(newDigits);

    // Mover foco automáticamente a la siguiente casilla
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const code = digits.join("");
    if (code.length < 6) {
      setErrorMsg("Por favor ingrese los 6 dígitos del código de verificación.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await api.verifyEmailCode(email, code);
      localStorage.setItem("lsa_preference", "true");
      localStorage.setItem("settings_video_subtitles_enabled", "true");
      onSuccess(res.user);
    } catch (err: any) {
      setErrorMsg(err.message || "Código de verificación inválido o expirado.");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm ${
        isClosing ? "anim-fade-out" : "anim-fade-in"
      }`}
      onClick={handleClose}
    >
      <div
        className={`bg-white w-full max-w-md rounded-2xl p-6 sm:p-8 shadow-2xl ${
          isClosing ? "anim-scale-out" : "anim-scale-in"
        }`}
        style={{ border: "1px solid #E5E7EB" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado con Botón cerrar */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "#F0FFFE", color: "#00A69D", border: "1px solid #CCFBF6" }}
            >
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold" style={{ color: "#203A70" }}>
                Verificación de Correo
              </h3>
              <p className="text-xs text-gray-500">Ingresa el código recibido</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Descripción del Correo */}
        <div className="mb-6 p-3 bg-gray-50 rounded-xl border border-gray-100 text-center">
          <p className="text-xs text-gray-500 mb-0.5">Código enviado a:</p>
          <p className="text-sm font-bold text-[#00A69D] break-all">{email}</p>
        </div>

        {/* Mensaje de error */}
        {errorMsg && (
          <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-xs font-medium animate-shake">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Formulario OTP */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center gap-2 sm:gap-2.5">
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => (inputRefs.current[idx] = el)}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={digit}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className={`w-10 h-12 sm:w-11 sm:h-13 text-center text-xl font-bold rounded-xl border transition-all outline-none ${
                  digit
                    ? "border-[#00A69D] bg-[#F0FFFE] text-[#00A69D] shadow-xs"
                    : "border-gray-200 bg-gray-50/50 text-[#203A70] focus:border-[#00A69D] focus:bg-white focus:ring-2 focus:ring-[#00A69D]/20"
                }`}
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || digits.join("").length < 6}
            className="w-full py-2.5 px-4 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            style={{ background: "#00A69D", boxShadow: "0 2px 10px rgba(0,166,157,0.3)" }}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Verificando...</span>
              </>
            ) : (
              <span>Verificar Código</span>
            )}
          </button>
        </form>

        {/* Pie informativo */}
        <div className="mt-5 pt-4 border-t border-gray-100 text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
          <Mail size={14} className="text-gray-400" />
          <span>Revisa también tu carpeta de Spam.</span>
        </div>
      </div>
    </div>,
    document.body
  );
}

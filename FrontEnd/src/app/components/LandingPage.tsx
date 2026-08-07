import {
  Brain, MapPin, ShieldCheck, Hand, Users, Building2,
  ArrowRight, ChevronDown, Github, BookOpen, Globe,
  HeartPulse, Stethoscope, Zap, CheckCircle, Menu, X
} from "lucide-react";
import { useState } from "react";

const logoImg = new URL("../../imports/image-1.png", import.meta.url).href;
const heroVideo = new URL("../../imports/hands.mp4", import.meta.url).href;

interface LandingPageProps {
  onEnterPortal: (role?: "patient" | "doctor" | "pharmacy") => void;
}

export function LandingPage({ onEnterPortal }: LandingPageProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#F9FAFB", color: "#203A70" }}>

      {/* ═══════════════════════════════════════
          HEADER — NAVEGACIÓN SUPERIOR
      ═══════════════════════════════════════ */}
      <header
        className="sticky top-0 z-50"
        style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid #E5E7EB" }}
      >
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between" style={{ height: "68px" }}>
          {/* Logo */}
          <img src={logoImg} alt="SUPER-UCE DOC" style={{ height: "42px", width: "auto" }} />

          {/* Nav links — desktop */}
          <nav className="hidden md:flex items-center gap-8">
            {[
              { label: "Inicio", id: "hero" },
              { label: "Cómo Funciona", id: "features" },
              { label: "Impacto Social", id: "impact" },
            ].map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className="text-sm transition-colors duration-200"
                style={{ color: "#6B7280", fontWeight: 500 }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "#203A70")}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "#6B7280")}
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* CTA + hamburger */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onEnterPortal()}
              className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm transition-all duration-200"
              style={{ background: "#00A69D", fontWeight: 700 }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#009690")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "#00A69D")}
            >
              Acceder al Portal <ArrowRight size={15} />
            </button>
            <button
              className="md:hidden p-2 rounded-lg"
              style={{ color: "#203A70" }}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden px-6 pb-4 space-y-3 border-t" style={{ borderColor: "#E5E7EB", background: "white" }}>
            {["Inicio", "Cómo Funciona", "Impacto Social"].map((label, i) => (
              <button
                key={i}
                onClick={() => scrollTo(["hero", "features", "impact"][i])}
                className="block w-full text-left py-2 text-sm"
                style={{ color: "#6B7280" }}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => onEnterPortal()}
              className="w-full py-2.5 rounded-xl text-white text-sm"
              style={{ background: "#00A69D", fontWeight: 700 }}
            >
              Acceder al Portal
            </button>
          </div>
        )}
      </header>

      {/* ═══════════════════════════════════════
          HERO SECTION
      ═══════════════════════════════════════ */}
      <section
        id="hero"
        className="relative overflow-hidden"
        style={{
          paddingTop: "96px",
          paddingBottom: "96px",
        }}
      >
        <video
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "right center" }}
          src={heroVideo}
        />

        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, #F9FAFB 45%, rgba(249,250,251,0.85) 60%, rgba(249,250,251,0.2) 80%, transparent 100%)",
          }}
        />

        {/* Decoraciones de fondo */}
        <div
          className="absolute top-0 right-0 w-2/3 h-full pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 80% 40%, rgba(0,198,192,0.04) 0%, transparent 65%)",
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-1/2 h-full pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 20% 80%, rgba(32,58,112,0.04) 0%, transparent 60%)",
          }}
        />

        <div className="max-w-6xl mx-auto px-6 relative">
          <div className="max-w-3xl">
            {/* Pill badge */}
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm mb-8"
              style={{ background: "#F0FFFE", color: "#00A69D", border: "1px solid #00C7C0", fontWeight: 600 }}
            >
              <Hand size={16} />
              Plataforma de código abierto · UCE 2026
            </div>

            {/* Título H1 */}
            <h1
              style={{
                fontSize: "clamp(36px, 5vw, 60px)",
                fontWeight: 800,
                color: "#203A70",
                lineHeight: 1.15,
                letterSpacing: "-1px",
                marginBottom: "24px",
              }}
            >Rompiendo Barreras  <span style={{ color: "#00A69D" }}>en la Salud </span>con Inteligencia Artificial.</h1>

            {/* Subtítulo */}
            <p
              style={{
                fontSize: "clamp(17px, 2vw, 20px)",
                color: "#4B5563",
                lineHeight: 1.65,
                marginBottom: "40px",
                maxWidth: "640px",
              }}
            >
              La primera  plataforma de telemedicina de código abierto que{" "}
              <strong style={{ color: "#203A70" }}>traduce el lenguaje de señas en tiempo real</strong>,
              conectando a pacientes sordos, médicos y farmacias en un solo ecosistema inclusivo.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => onEnterPortal()}
                className="flex items-center gap-2 px-7 py-4 rounded-xl text-white transition-all duration-200"
                style={{ background: "#00A69D", fontWeight: 700, fontSize: "16px" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#009690")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "#00A69D")}
              >
                Unirse a la Plataforma <ArrowRight size={18} />
              </button>
              <a
                href="https://github.com/SUPER-UCE-DOC/SUPER-UCE-DOC#readme"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-7 py-4 rounded-xl transition-all duration-200"
                style={{
                  background: "white",
                  color: "#203A70",
                  fontWeight: 700,
                  fontSize: "16px",
                  border: "2px solid #203A70",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#203A70";
                  (e.currentTarget as HTMLElement).style.color = "white";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "white";
                  (e.currentTarget as HTMLElement).style.color = "#203A70";
                }}
              >
                <BookOpen size={18} /> Leer la Investigación Académica
              </a>
            </div>

            {/* Métricas rápidas */}
            <div className="flex flex-wrap gap-8 mt-14">
              {[
                { value: "100K+", label: "Personas con discapacidad auditiva en RD" },
                { value: "3 roles", label: "Paciente · Médico · Farmacia" },
                { value: "IA en vivo", label: "Traducción LSA tiempo real" },
              ].map((m) => (
                <div key={m.label}>
                  <div style={{ fontSize: "26px", fontWeight: 800, color: "#00A69D", lineHeight: 1 }}>
                    {m.value}
                  </div>
                  <div style={{ fontSize: "13px", color: "#9CA3AF", marginTop: "4px" }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="flex justify-center mt-16">
          <button
            onClick={() => scrollTo("features")}
            className="flex flex-col items-center gap-1 animate-bounce"
            style={{ color: "#9CA3AF" }}
          >
            <span className="text-xs">Descubre más</span>
            <ChevronDown size={20} />
          </button>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          FEATURES — ¿POR QUÉ ELEGIRNOS?
      ═══════════════════════════════════════ */}
      <section id="features" style={{ paddingTop: "80px", paddingBottom: "80px", background: "white" }}>
        <div className="max-w-6xl mx-auto px-6">
          {/* Encabezado */}
          <div className="text-center mb-16">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs mb-5"
              style={{ background: "#F0FFFE", color: "#00A69D", border: "1px solid #00C7C0", fontWeight: 600 }}
            >
              <Zap size={13} /> Tecnología de vanguardia
            </div>
            <h2
              style={{ fontSize: "clamp(28px, 3.5vw, 42px)", fontWeight: 800, color: "#203A70", letterSpacing: "-0.5px" }}
            >
              Innovación al Servicio de la Vida
            </h2>
            <p className="mt-4 max-w-xl mx-auto" style={{ color: "#6B7280", fontSize: "17px", lineHeight: 1.6 }}>
              Tres pilares tecnológicos que transforman la experiencia médica para la comunidad con discapacidad auditiva.
            </p>
          </div>

          {/* Cards de características */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <Brain size={32} style={{ color: "#00A69D" }} />,
                iconBg: "#F0FFFE",
                title: "Traducción IA Bidireccional",
                desc: "Modelos de visión artificial que interpretan gestos clínicos en lenguaje de señas americano (LSA) en tiempo real, generando texto y subtítulos para el médico.",
                tag: "Computer Vision · NLP",
              },
              {
                icon: <MapPin size={32} style={{ color: "#203A70" }} />,
                iconBg: "#EEF2FF",
                title: "Red de Farmacias Geolocalizadas",
                desc: "Recetas digitales firmadas electrónicamente, conectadas a mapas de precisión para encontrar el medicamento más cercano al paciente al instante.",
                tag: "Geolocalización · Receta Digital",
              },
              {
                icon: <ShieldCheck size={32} style={{ color: "#10B981" }} />,
                iconBg: "#F0FDF4",
                title: "Expediente Clínico Seguro",
                desc: "Historial médico encriptado de extremo a extremo, accesible de forma segura para el personal de salud autorizado bajo estándares HL7 / FHIR.",
                tag: "HIPAA · HL7 · FHIR",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl p-8 border transition-all duration-300"
                style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#00A69D";
                  (e.currentTarget as HTMLElement).style.background = "white";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(0,166,157,0.10)";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#E5E7EB";
                  (e.currentTarget as HTMLElement).style.background = "#FAFAFA";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                }}
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                  style={{ background: card.iconBg }}
                >
                  {card.icon}
                </div>
                <h3 style={{ fontSize: "20px", fontWeight: 700, color: "#203A70", marginBottom: "12px" }}>
                  {card.title}
                </h3>
                <p style={{ color: "#6B7280", lineHeight: 1.65, fontSize: "15px", marginBottom: "16px" }}>
                  {card.desc}
                </p>
                <span
                  className="inline-block px-3 py-1 rounded-full text-xs"
                  style={{ background: "#F0FFFE", color: "#00A69D", fontWeight: 600, border: "1px solid #00C7C0" }}
                >
                  {card.tag}
                </span>
              </div>
            ))}
          </div>

          {/* Fila de ventajas adicionales */}
          <div
            className="mt-12 rounded-2xl p-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center"
            style={{ background: "#F0FFFE", border: "1px solid #00C7C0" }}
          >
            {[
              { icon: <HeartPulse size={24} style={{ color: "#00A69D" }} />, label: "Accesibilidad Universal" },
              { icon: <Globe size={24} style={{ color: "#203A70" }} />, label: "Open Source" },
              { icon: <Stethoscope size={24} style={{ color: "#00A69D" }} />, label: "Validado Clínicamente" },
              { icon: <CheckCircle size={24} style={{ color: "#10B981" }} />, label: "Sin Costo para el Paciente" },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-2">
                {item.icon}
                <span style={{ color: "#203A70", fontWeight: 600, fontSize: "14px" }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          IMPACTO SOCIAL
      ═══════════════════════════════════════ */}
      <section id="impact" style={{ paddingTop: "80px", paddingBottom: "80px", background: "#F9FAFB" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Texto */}
            <div>
              <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs mb-5"
                style={{ background: "#EEF2FF", color: "#203A70", border: "1px solid #C7D2FE", fontWeight: 600 }}
              >
                <HeartPulse size={13} /> Impacto Social
              </div>
              <h2
                style={{ fontSize: "clamp(26px, 3vw, 38px)", fontWeight: 800, color: "#203A70", lineHeight: 1.2, letterSpacing: "-0.5px" }}
              >
                Un sistema de salud que finalmente{" "}
                <span style={{ color: "#00A69D" }}>habla todos los idiomas.</span>
              </h2>
              <p className="mt-5" style={{ color: "#6B7280", lineHeight: 1.7, fontSize: "16px" }}>
                En República Dominicana, más de 478,000 personas viven con alguna discapacidad (Censo ONE 2022) y sobre 100,000 enfrentan barreras comunicativas por discapacidad auditiva. SUPER-UCE DOC nace como una respuesta académica, tecnológica y humana a esta realidad, desarrollada desde la Universidad Central del Este.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  "Reducción de barreras comunicativas en consultas médicas",
                  "Integración con el sistema nacional de farmacias de la República Dominicana",
                  "Código abierto: libre para ser adoptado por hospitales públicos",
                  "Diseñado bajo estándares internacionales de accesibilidad (WCAG 2.1 AA)",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: "#DCFCE7" }}
                    >
                      <CheckCircle size={12} style={{ color: "#10B981" }} />
                    </div>
                    <span style={{ color: "#374151", fontSize: "15px" }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: "100K+", label: "Personas con discapacidad auditiva en RD", color: "#00A69D", bg: "#F0FFFE", border: "#00C7C0" },
                { value: "478K+", label: "Población con discapacidad (Censo ONE 2022)", color: "#203A70", bg: "#EEF2FF", border: "#C7D2FE" },
                { value: "Ley 43-23", label: "Reconocimiento de Lenguaje de Señas en RD", color: "#10B981", bg: "#F0FDF4", border: "#BBF7D0" },
                { value: "IA", label: "Interpretación clínica en tiempo real", color: "#00A69D", bg: "#F0FFFE", border: "#00C7C0" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl p-6 border"
                  style={{ background: s.bg, borderColor: s.border }}
                >
                  <div style={{ fontSize: "36px", fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: "13px", color: "#6B7280", marginTop: "8px", lineHeight: 1.4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          ACCESOS DIRECTOS — PORTALES
      ═══════════════════════════════════════ */}
      <section style={{ background: "#203A70", paddingTop: "80px", paddingBottom: "80px" }}>
        <div className="max-w-6xl mx-auto px-6">
          {/* Encabezado */}
          <div className="text-center mb-12">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs mb-5"
              style={{ background: "rgba(0,198,192,0.15)", color: "#00C7C0", border: "1px solid rgba(0,198,192,0.3)", fontWeight: 600 }}
            >
              <Zap size={13} /> Acceso inmediato
            </div>
            <h2
              style={{ fontSize: "clamp(26px, 3vw, 38px)", fontWeight: 800, color: "white", letterSpacing: "-0.5px" }}
            >
              El puente hacia tu módulo
            </h2>
            <p className="mt-3" style={{ color: "rgba(255,255,255,0.65)", fontSize: "16px" }}>
              Selecciona tu perfil y accede directamente a tu espacio de trabajo personalizado.
            </p>
          </div>

          {/* Tres portales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                role: "patient" as const,
                icon: <Hand size={36} style={{ color: "#00A69D" }} />,
                title: "Para Pacientes",
                subtitle: "Sala de Telemedicina Inclusiva",
                desc: "Consultas por videollamada con intérprete de LSA en tiempo real, subtítulos automáticos y acceso a tus recetas.",
                cta: "Entrar a la Sala Inclusiva",
                accentColor: "#00A69D",
              },
              {
                role: "doctor" as const,
                icon: <Stethoscope size={36} style={{ color: "#00C7C0" }} />,
                title: "Para Médicos",
                subtitle: "Panel Clínico Profesional",
                desc: "Gestiona tu agenda, conduce teleconsultas con traductor IA activo y emite recetas digitales geolocalizadas.",
                cta: "Gestionar Consultas y Recetas",
                accentColor: "#00C7C0",
              },
              {
                role: "pharmacy" as const,
                icon: <Building2 size={36} style={{ color: "#10B981" }} />,
                title: "Para Farmacias",
                subtitle: "Dashboard de Recepción",
                desc: "Recibe y valida recetas entrantes en tu zona geográfica con un solo clic y gestiona tu inventario en tiempo real.",
                cta: "Validar Recetas en la Zona",
                accentColor: "#10B981",
              },
            ].map((portal) => (
              <div
                key={portal.role}
                className="rounded-2xl p-8 flex flex-col transition-all duration-300 cursor-pointer"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.12)";
                  (e.currentTarget as HTMLElement).style.borderColor = portal.accentColor;
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                }}
              >
                {/* Ícono */}
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                  style={{ background: "rgba(255,255,255,0.1)" }}
                >
                  {portal.icon}
                </div>

                {/* Contenido */}
                <div className="flex-1">
                  <p className="text-xs mb-1" style={{ color: portal.accentColor, fontWeight: 600 }}>
                    {portal.subtitle}
                  </p>
                  <h3 style={{ fontSize: "22px", fontWeight: 800, color: "white", marginBottom: "12px" }}>
                    {portal.title}
                  </h3>
                  <p style={{ color: "rgba(255,255,255,0.60)", fontSize: "14px", lineHeight: 1.65 }}>
                    {portal.desc}
                  </p>
                </div>

                {/* Botón de acceso */}
                <button
                  onClick={() => onEnterPortal(portal.role)}
                  className="mt-8 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
                  style={{
                    background: portal.accentColor,
                    color: "white",
                    fontWeight: 700,
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.9")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
                >
                  {portal.cta} <ArrowRight size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════ */}
      <footer style={{ background: "white", borderTop: "1px solid #E5E7EB", paddingTop: "48px", paddingBottom: "48px" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
            {/* Brand */}
            <div>
              <img src={logoImg} alt="SUPER-UCE DOC" style={{ height: "40px", marginBottom: "16px" }} />
              <p style={{ color: "#6B7280", fontSize: "14px", lineHeight: 1.7, maxWidth: "280px" }}>
                Plataforma interdisciplinaria de telemedicina inclusiva, desarrollada como iniciativa académica y de código abierto en la Universidad Central del Este.
              </p>
              <div className="flex items-center gap-3 mt-5">
                <a
                  href="https://github.com/SUPER-UCE-DOC/SUPER-UCE-DOC.git"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-colors"
                  style={{ borderColor: "#E5E7EB", color: "#6B7280" }}
                >
                  <Github size={14} /> GitHub Open Source
                </a>
              </div>
            </div>

            {/* Plataforma */}
            <div>
              <h4 style={{ color: "#203A70", fontWeight: 700, marginBottom: "16px", fontSize: "15px" }}>Plataforma</h4>
              <ul className="space-y-2">
                {["Portal del Paciente", "Portal del Médico", "Portal de Farmacia", "Asistente IA — MediBot"].map((item) => (
                  <li key={item}>
                    <button
                      onClick={() => onEnterPortal()}
                      className="text-sm transition-colors"
                      style={{ color: "#6B7280" }}
                      onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "#00A69D")}
                      onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "#6B7280")}
                    >
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Proyecto */}
            <div>
              <h4 style={{ color: "#203A70", fontWeight: 700, marginBottom: "16px", fontSize: "15px" }}>Proyecto Académico</h4>
              <ul className="space-y-2">
                {[
                  "Universidad Central del Este",
                  "Facultad de Ingeniería y Ciencias Aplicadas",
                  "Iniciativa Open Source",
                  "Estándares HIPAA · HL7 · WCAG 2.1",
                ].map((item) => (
                  <li key={item} style={{ color: "#6B7280", fontSize: "14px" }}>{item}</li>
                ))}
              </ul>
              <div
                className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                style={{ background: "#F0FFFE", color: "#00A69D", border: "1px solid #00C7C0", fontWeight: 600 }}
              >
                <Users size={13} /> Proyecto Interdisciplinario 2026
              </div>
            </div>
          </div>

          {/* Línea divisoria */}
          <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: "#E5E7EB" }}>
            <p style={{ color: "#9CA3AF", fontSize: "13px" }}>
              © 2026 SUPER-UCE DOC · Universidad Central del Este · Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-4">
              <span
                className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full"
                style={{ background: "#F0FDF4", color: "#10B981", fontWeight: 600 }}
              >
                <CheckCircle size={12} /> Open Source
              </span>
              <span
                className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full"
                style={{ background: "#F0FFFE", color: "#00A69D", fontWeight: 600 }}
              >
                <Hand size={12} /> Accesible LSA
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

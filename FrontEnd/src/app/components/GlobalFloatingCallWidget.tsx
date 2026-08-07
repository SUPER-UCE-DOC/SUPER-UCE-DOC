import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Maximize2 } from "lucide-react";
import { api } from "../utils/api";
import {
  LiveKitRoom,
  VideoTrack,
  useTracks,
  useRemoteParticipants,
  RoomAudioRenderer
} from "@livekit/components-react";
import { Track } from "livekit-client";

interface GlobalFloatingCallWidgetProps {
  role: "doctor" | "patient";
  counterpartName: string;
  counterpartAvatar?: string;
  counterpartRole?: string;
  counterpartSpecialty?: string;
  appointmentId?: number;
  onReturnToCall: () => void;
}

export function GlobalFloatingCallWidget({
  role,
  counterpartName,
  counterpartAvatar,
  appointmentId,
  onReturnToCall
}: GlobalFloatingCallWidgetProps) {
  type CornerPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";
  const [pipCorner, setPipCorner] = useState<CornerPosition>("bottom-right");
  const [isDragging, setIsDragging] = useState(false);
  const [dragDelta, setDragDelta] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [tokenToUse, setTokenToUse] = useState<string>("");
  const [initialVideoOn, setInitialVideoOn] = useState(true);
  const [initialAudioOn, setInitialAudioOn] = useState(true);

  const widgetRef = useRef<HTMLDivElement | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasDraggedRef = useRef<boolean>(false);

  const roomCode = String(appointmentId || "1");

  useEffect(() => {
    const savedVideoOff = localStorage.getItem("local_video_off") === "true";
    const savedAudioMuted = localStorage.getItem("local_audio_muted") === "true";
    setInitialVideoOn(!savedVideoOff);
    setInitialAudioOn(!savedAudioMuted);
  }, []);

  // Fetch LiveKit Token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const res = await api.getLiveKitToken(roomCode);
        setTokenToUse(res.token);
      } catch (err) {
        console.error("Error fetching LiveKit token in PiP:", err);
      }
    };
    fetchToken();
  }, [roomCode]);

  const getInitials = (name?: string) => {
    if (!name) return "US";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  const cornerStyles: Record<CornerPosition, React.CSSProperties> = {
    "top-left": { top: "80px", left: "20px", bottom: "auto", right: "auto" },
    "top-right": { top: "80px", left: "calc(100% - 196px)", bottom: "auto", right: "auto" },
    "bottom-left": { top: "calc(100% - 140px)", left: "20px", bottom: "auto", right: "auto" },
    "bottom-right": { top: "calc(100% - 140px)", left: "calc(100% - 196px)", bottom: "auto", right: "auto" }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    hasDraggedRef.current = false;
    setIsDragging(true);
    setDragDelta({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartPosRef.current.x;
      const dy = e.clientY - dragStartPosRef.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        hasDraggedRef.current = true;
      }
      setDragDelta({ x: dx, y: dy });
    };

    const handleMouseUp = () => {
      setIsDragging(false);

      if (widgetRef.current) {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const rect = widgetRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const isLeft = centerX < windowWidth / 2;
        const isTop = centerY < windowHeight / 2;

        let newCorner: CornerPosition = "bottom-right";
        if (isLeft && isTop) newCorner = "top-left";
        else if (!isLeft && isTop) newCorner = "top-right";
        else if (isLeft && !isTop) newCorner = "bottom-left";
        else if (!isLeft && !isTop) newCorner = "bottom-right";

        setPipCorner(newCorner);
      }
      setDragDelta({ x: 0, y: 0 });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasDraggedRef.current) {
      onReturnToCall();
    }
  };

  return (
    <div
      ref={widgetRef}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      style={{
        ...cornerStyles[pipCorner],
        transform: isDragging
          ? `translate3d(${dragDelta.x}px, ${dragDelta.y}px, 0px)`
          : "translate3d(0px, 0px, 0px)",
        transition: isDragging
          ? "none"
          : "top 350ms cubic-bezier(0.16, 1, 0.3, 1), left 350ms cubic-bezier(0.16, 1, 0.3, 1), transform 350ms cubic-bezier(0.16, 1, 0.3, 1)",
        zIndex: 9999
      }}
      className={`fixed w-44 h-30 rounded-2xl overflow-hidden bg-slate-800 border-2 border-[#00A69D] shadow-2xl flex flex-col items-center justify-center select-none cursor-grab active:cursor-grabbing group hover:ring-2 hover:ring-[#00C7C0] transition-all ${
        isDragging ? "scale-105 shadow-2xl border-[#00C7C0]" : ""
      }`}
      title="Haz clic para volver a la videollamada o arrastra a cualquier esquina"
    >
      {/* ÍCONO DE VOLVER A LLAMADA EN HOVER */}
      <div className="absolute top-2 right-2 p-1.5 bg-black/70 backdrop-blur-md rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center shadow-md">
        <Maximize2 size={13} className="text-[#00C7C0]" />
      </div>

      {tokenToUse ? (
        <LiveKitRoom
          serverUrl={(import.meta as any).env?.VITE_LIVEKIT_URL || "ws://127.0.0.1:7880"}
          token={tokenToUse}
          connect={true}
          video={initialVideoOn}
          audio={initialAudioOn}
          className="w-full h-full"
        >
          <FloatingRoomContent
            counterpartAvatar={counterpartAvatar}
            counterpartName={counterpartName}
            getInitials={getInitials}
            elapsedSecs={elapsedSecs}
          />
          <RoomAudioRenderer />
        </LiveKitRoom>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center relative p-2 bg-slate-800">
           <div className="w-5 h-5 rounded-full border-2 border-[#00A69D] border-t-transparent animate-spin mb-2"></div>
           <span className="text-[10px] text-white font-bold">Conectando...</span>
        </div>
      )}
    </div>
  );
}

function FloatingRoomContent({
  counterpartAvatar,
  counterpartName,
  getInitials
}: any) {
  const remoteParticipants = useRemoteParticipants();
  const isCounterpartConnected = remoteParticipants.length > 0;

  const cameraTracks = useTracks([Track.Source.Camera]);
  const audioTracks = useTracks([Track.Source.Microphone]);
  const remoteCameraTrack = cameraTracks.find(t => !t.participant.isLocal);
  const remoteAudioTrack = audioTracks.find(t => !t.participant.isLocal);
  
  const isCounterpartVideoOff = !remoteCameraTrack || remoteCameraTrack.publication?.isMuted || remoteCameraTrack.participant?.isCameraEnabled === false;
  const isCounterpartMuted = !remoteAudioTrack || remoteAudioTrack.publication?.isMuted || remoteAudioTrack.participant?.isMicrophoneEnabled === false;

  if (!isCounterpartConnected) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center relative p-2 bg-slate-800">
        <div className="relative mb-1">
          <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs overflow-hidden shadow-md border border-slate-700/60 opacity-60">
            {counterpartAvatar && (counterpartAvatar.startsWith("http") || counterpartAvatar.startsWith("data:")) ? (
              <img src={counterpartAvatar} alt={counterpartName} className="w-full h-full object-cover" />
            ) : (
              getInitials(counterpartName)
            )}
          </div>
          <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 bg-amber-500" title="Desconectado" />
        </div>
        <span className="text-xs text-white font-bold truncate max-w-[130px]">{counterpartName}</span>
        <span className="text-[10px] text-amber-400 font-semibold mt-0.5">Desconectado</span>
      </div>
    );
  }

  if (isCounterpartVideoOff) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center relative p-2 bg-slate-800">
        <div className="relative mb-1">
          <div className="w-10 h-10 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-xs overflow-hidden shadow-md border border-slate-700/60">
            {counterpartAvatar && (counterpartAvatar.startsWith("http") || counterpartAvatar.startsWith("data:")) ? (
              <img src={counterpartAvatar} alt={counterpartName} className="w-full h-full object-cover" />
            ) : (
              getInitials(counterpartName)
            )}
          </div>
          <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 bg-[#00A69D]" title="Conectado" />
        </div>
        <span className="text-xs text-white font-bold truncate max-w-[130px]">{counterpartName}</span>
        {isCounterpartMuted && <span className="text-[9px] text-red-400 font-bold mt-0.5">Micrófono Desactivado</span>}
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-slate-900 flex items-center justify-center overflow-hidden">
      {remoteCameraTrack && (
        <VideoTrack trackRef={remoteCameraTrack} className="absolute inset-0 w-full h-full object-cover -scale-x-100" />
      )}
      <div className="absolute bottom-2 left-2 z-10 font-bold text-[10px] text-white bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 flex items-center gap-1.5 max-w-[150px]">
        <span className="truncate">{counterpartName}</span>
        {isCounterpartMuted ? (
          <MicOff size={11} className="text-red-400 flex-shrink-0" title="Micrófono Desactivado" />
        ) : (
          <Mic size={11} className="text-white/80 flex-shrink-0" title="Micrófono Activo" />
        )}
      </div>
    </div>
  );
}

"use client";

import { useStore } from "@/lib/store";
import { VIXORA_COLORS } from "@/lib/types";
import { Calendar, Users, BarChart3, Eye, EyeOff, RefreshCw, LogIn, LogOut, Pencil, Download, MapPin, Settings } from "lucide-react";
import { useState } from "react";
import { ModalExportar } from "@/components/vixora/ModalExportar";

interface Props {
  onNavigate: (seccion: "cronograma" | "tecnicos" | "estadisticas" | "mapa" | "admin") => void;
  seccionActual: "cronograma" | "tecnicos" | "estadisticas" | "mapa" | "admin";
}

export function SidebarLeft({ onNavigate, seccionActual }: Props) {
  const { modoAcceso, setLoginModalAbierto, logout, mostrarDetalles, toggleMostrarDetalles, regenerarVisual, fechaActual, setModalExportarAbierto } = useStore();
  const [regenerando, setRegenerando] = useState(false);

  const handleRegenerar = async () => {
    setRegenerando(true);
    await regenerarVisual(fechaActual.getFullYear());
    setRegenerando(false);
  };

  return (
    <>
      {/* Reducido a w-48 (192px) para ajustar al ancho de la imagen con un pequeño margen */}
      <aside className="w-16 lg:w-48 shrink-0 flex flex-col text-white" style={{ backgroundColor: VIXORA_COLORS.dark }}>
        <div className="px-2 py-2 border-b border-white/10 flex items-center justify-center overflow-hidden">
          <img 
            src="https://i.postimg.cc/YqT9Wy0V/Gemini-Generated-Image-t218vtt218vtt218-Photoroom.png" 
            alt="VIXORA Cronograma" 
            className="h-12 w-full lg:h-14 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
        
        <nav className="flex-1 p-1.5 space-y-1">
          <SidebarButton icon={<Calendar size={18} />} label="Cronograma" active={seccionActual === "cronograma"} onClick={() => onNavigate("cronograma")} />
          
          {modoAcceso === "editor" && (
            <>
              <SidebarButton icon={<Users size={18} />} label="Técnicos" active={seccionActual === "tecnicos"} onClick={() => onNavigate("tecnicos")} />
              <SidebarButton icon={<BarChart3 size={18} />} label="Dashboard" active={seccionActual === "estadisticas"} onClick={() => onNavigate("estadisticas")} />
            </>
          )}

          <SidebarButton icon={<MapPin size={18} />} label="Mapa Minas" active={seccionActual === "mapa"} onClick={() => onNavigate("mapa")} />
          
          {modoAcceso === "editor" && (
            <SidebarButton icon={<Settings size={18} />} label="Admin" active={seccionActual === "admin"} onClick={() => onNavigate("admin")} />
          )}
        </nav>

        {seccionActual === "cronograma" && (
          <div className="p-1.5 space-y-1 border-t border-white/10">
            <SidebarButton icon={mostrarDetalles ? <Eye size={18} /> : <EyeOff size={18} />} label={mostrarDetalles ? "Ocultar" : "Detalles"} active={false} onClick={toggleMostrarDetalles} />
            
            {modoAcceso === "editor" && (
              <>
                <SidebarButton icon={<Download size={18} />} label="Exportar" active={false} onClick={() => setModalExportarAbierto(true)} />
                <SidebarButton icon={<RefreshCw size={18} className={regenerando ? "animate-spin" : ""} />} label={regenerando ? "Act..." : "Sincronizar Excel"} active={false} onClick={handleRegenerar} />
              </>
            )}
          </div>
        )}

        <div className="p-1.5 border-t border-white/10">
          {modoAcceso === "editor" ? (
            <>
              <div className="hidden lg:flex items-center gap-1 px-2 py-1 mb-1 text-[10px] text-green-400"><Pencil size={12} /><span>Editor</span></div>
              <SidebarButton icon={<LogOut size={18} />} label="Salir" active={false} onClick={logout} />
            </>
          ) : (
            <SidebarButton icon={<LogIn size={18} />} label="Entrar" active={false} onClick={() => setLoginModalAbierto(true)} />
          )}
        </div>
      </aside>
      <ModalExportar />
    </>
  );
}

function SidebarButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-2 py-2 rounded text-[11px] font-medium transition-colors ${active ? "bg-[#E91E63] text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`} title={label}>
      <span className="shrink-0">{icon}</span>
      <span className="hidden lg:block truncate">{label}</span>
    </button>
  );
}

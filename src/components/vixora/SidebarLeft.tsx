"use client";

import { useStore } from "@/lib/store";
import { VIXORA_COLORS } from "@/lib/types";
import { Calendar, Users, BarChart3, Eye, EyeOff, RefreshCw, LogIn, LogOut, Pencil, Download, MapPin } from "lucide-react";
import { useState } from "react";
import { ModalExportar } from "@/components/vixora/ModalExportar";

interface Props {
  onNavigate: (seccion: "cronograma" | "tecnicos" | "estadisticas" | "mapa") => void;
  seccionActual: "cronograma" | "tecnicos" | "estadisticas" | "mapa";
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
      <aside className="w-16 lg:w-56 shrink-0 flex flex-col text-white" style={{ backgroundColor: VIXORA_COLORS.dark }}>
        <div className="p-3 border-b border-white/10 flex items-center gap-2">
          <div className="px-2 py-1 rounded font-bold text-sm flex items-center" style={{ backgroundColor: VIXORA_COLORS.primary }}>VIX</div>
          <span className="hidden lg:block text-xs text-white/70">Cronograma</span>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          <SidebarButton icon={<Calendar size={18} />} label="Cronograma" active={seccionActual === "cronograma"} onClick={() => onNavigate("cronograma")} />
          <SidebarButton icon={<Users size={18} />} label="Técnicos" active={seccionActual === "tecnicos"} onClick={() => onNavigate("tecnicos")} />
          <SidebarButton icon={<BarChart3 size={18} />} label="Dashboard" active={seccionActual === "estadisticas"} onClick={() => onNavigate("estadisticas")} />
          <SidebarButton icon={<MapPin size={18} />} label="Mapa Minas" active={seccionActual === "mapa"} onClick={() => onNavigate("mapa")} />
        </nav>
        {seccionActual === "cronograma" && (
          <div className="p-2 space-y-1 border-t border-white/10">
            <SidebarButton icon={mostrarDetalles ? <Eye size={18} /> : <EyeOff size={18} />} label={mostrarDetalles ? "Ocultar detalles" : "Mostrar detalles"} active={false} onClick={toggleMostrarDetalles} />
            <SidebarButton icon={<Download size={18} />} label="Exportar" active={false} onClick={() => setModalExportarAbierto(true)} />
            {modoAcceso === "editor" && (
              <SidebarButton icon={<RefreshCw size={18} className={regenerando ? "animate-spin" : ""} />} label={regenerando ? "Actualizando..." : "Actualizar Excel visual (365 días)"} active={false} onClick={handleRegenerar} />
            )}
          </div>
        )}
        <div className="p-2 border-t border-white/10">
          {modoAcceso === "editor" ? (
            <>
              <div className="hidden lg:flex items-center gap-2 px-2 py-1 mb-1 text-xs text-green-400"><Pencil size={14} /><span>Modo Editor</span></div>
              <SidebarButton icon={<LogOut size={18} />} label="Salir de editor" active={false} onClick={logout} />
            </>
          ) : (
            <SidebarButton icon={<LogIn size={18} />} label="Entrar como editor" active={false} onClick={() => setLoginModalAbierto(true)} />
          )}
        </div>
      </aside>
      <ModalExportar />
    </>
  );
}

function SidebarButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-2 py-2 rounded text-xs font-medium transition-colors ${active ? "bg-[#E91E63] text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`} title={label}>
      <span className="shrink-0">{icon}</span>
      <span className="hidden lg:block truncate">{label}</span>
    </button>
  );
}

"use client";

import { useStore } from "@/lib/store";
import { VIXORA_COLORS } from "@/lib/types";
import {
  Calendar, Users, BarChart3, Map, Shield,
  Eye, EyeOff, RefreshCw, LogIn, LogOut, Pencil,
  Database, Save, Download, ChevronDown, RotateCcw
} from "lucide-react";
import { useState } from "react";

interface Props {
  onNavigate: (seccion: "cronograma" | "tecnicos" | "estadisticas" | "mapa" | "habilitaciones" | "admin") => void;
  seccionActual: "cronograma" | "tecnicos" | "estadisticas" | "mapa" | "habilitaciones" | "admin";
}

export function SidebarLeft({ onNavigate, seccionActual }: Props) {
  const {
    modoAcceso, setLoginModalAbierto, logout,
    mostrarDetalles, toggleMostrarDetalles,
    regenerarVisual, guardarCambiosEnExcel,
    cargarDatosSilencioso, fechaActual, cambiosSinGuardar, showToast
  } = useStore();

  const [regenerando, setRegenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);

  const handleRegenerar = async () => {
    setRegenerando(true);
    await regenerarVisual(fechaActual.getFullYear());
    setRegenerando(false);
  };

  const handleGuardar = async () => {
    setGuardando(true);
    const ok = await guardarCambiosEnExcel();
    setGuardando(false);
    if (ok) showToast("Cambios guardados en Excel correctamente", "ok");
  };

  const handleRestaurar = async () => {
    if (cambiosSinGuardar) {
      if (!confirm("Tienes cambios sin guardar en la página. ¿Seguro que quieres descartarlos y restaurar desde el Excel?")) return;
    }
    setRestaurando(true);
    await cargarDatosSilencioso(); // Esto vuelve a jalar del Excel
    setRestaurando(false);
    showToast("Cronograma restaurado desde Excel", "info");
  };

  const esEditor = modoAcceso === "editor";

  return (
    <aside
      className="w-16 lg:w-56 shrink-0 flex flex-col text-white"
      style={{ backgroundColor: VIXORA_COLORS.dark }}
    >
      {/* Logo arriba */}
      <div className="p-3 border-b border-white/10 flex items-center gap-2">
        <div
          className="px-2 py-1 rounded font-bold text-sm flex items-center"
          style={{ backgroundColor: VIXORA_COLORS.primary }}
        >
          VIX
        </div>
        <span className="hidden lg:block text-xs text-white/70">Cronograma</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        <SidebarButton
          icon={<Calendar size={18} />}
          label="Cronograma"
          active={seccionActual === "cronograma"}
          onClick={() => onNavigate("cronograma")}
        />
        <SidebarButton
          icon={<Map size={18} />}
          label="Mapa Minas"
          active={seccionActual === "mapa"}
          onClick={() => onNavigate("mapa")}
        />

        {esEditor && (
          <>
            <SidebarButton
              icon={<Users size={18} />}
              label="Técnicos"
              active={seccionActual === "tecnicos"}
              onClick={() => onNavigate("tecnicos")}
            />
            <SidebarButton
              icon={<Shield size={18} />}
              label="Habilitaciones"
              active={seccionActual === "habilitaciones"}
              onClick={() => onNavigate("habilitaciones")}
              highlight={seccionActual === "habilitaciones"}
            />
            <SidebarButton
              icon={<BarChart3 size={18} />}
              label="Estadísticas"
              active={seccionActual === "estadisticas"}
              onClick={() => onNavigate("estadisticas")}
            />
            <SidebarButton
              icon={<Database size={18} />}
              label="Admin"
              active={seccionActual === "admin"}
              onClick={() => onNavigate("admin")}
            />
          </>
        )}
      </nav>

      {/* Acciones rápidas - solo en Cronograma */}
      {seccionActual === "cronograma" && (
        <div className="p-2 space-y-1 border-t border-white/10">
          <SidebarButton
            icon={mostrarDetalles ? <Eye size={18} /> : <EyeOff size={18} />}
            label={mostrarDetalles ? "Ocultar detalles" : "Mostrar detalles"}
            active={false}
            onClick={toggleMostrarDetalles}
          />

          {esEditor && (
            <>
              {/* Indicador de cambios sin guardar */}
              {cambiosSinGuardar && (
                <div className="hidden lg:flex items-center gap-2 px-2 py-1 text-[10px] text-yellow-400 bg-yellow-400/10 rounded">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></div>
                  <span>Cambios sin guardar</span>
                </div>
              )}

              {/* Botón Guardar en Excel (Batch) */}
              <SidebarButton
                icon={guardando ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                label={guardando ? "Guardando..." : "Guardar en Excel"}
                active={false}
                onClick={handleGuardar}
                highlight={cambiosSinGuardar}
              />

              {/* Botón Restaurar desde Excel */}
              <SidebarButton
                icon={restaurando ? <RefreshCw size={18} className="animate-spin" /> : <RotateCcw size={18} />}
                label={restaurando ? "Restaurando..." : "Descartar cambios"}
                active={false}
                onClick={handleRestaurar}
              />

              {/* Botón Actualizar Excel Visual */}
              <SidebarButton
                icon={<RefreshCw size={18} className={regenerando ? "animate-spin" : ""} />}
                label={regenerando ? "Actualizando..." : "Actualizar Visual"}
                active={false}
                onClick={handleRegenerar}
              />
            </>
          )}
        </div>
      )}

      {/* Auth abajo */}
      <div className="p-2 border-t border-white/10">
        {esEditor ? (
          <>
            <div className="hidden lg:flex items-center gap-2 px-2 py-1 mb-1 text-xs text-green-400">
              <Pencil size={14} />
              <span>Modo Editor</span>
            </div>
            <SidebarButton
              icon={<LogOut size={18} />}
              label="Salir de editor"
              active={false}
              onClick={logout}
            />
          </>
        ) : (
          <SidebarButton
            icon={<LogIn size={18} />}
            label="Entrar como editor"
            active={false}
            onClick={() => setLoginModalAbierto(true)}
          />
        )}
      </div>
    </aside>
  );
}

function SidebarButton({
  icon,
  label,
  active,
  onClick,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-2 rounded text-xs font-medium transition-colors ${
        active
          ? "bg-[#E91E63] text-white"
          : highlight
          ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
      title={label}
    >
      <span className="shrink-0">{icon}</span>
      <span className="hidden lg:block truncate flex-1 text-left">{label}</span>
      {highlight && (
        <span className="hidden lg:block ml-auto w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
      )}
    </button>
  );
}

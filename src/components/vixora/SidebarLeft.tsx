"use client";

import { useStore } from "@/lib/store";
import { VIXORA_COLORS } from "@/lib/types";
import {
  Calendar, Users, BarChart3, Map, Shield,
  Eye, EyeOff, RefreshCw, LogIn, LogOut, Pencil,
  Database, Download, Save, ChevronDown
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
    regenerarVisual, generarBackup, restaurarBackup,
    fechaActual
  } = useStore();

  const [regenerando, setRegenerando] = useState(false);
  const [generandoBackup, setGenerandoBackup] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [menuBackupAbierto, setMenuBackupAbierto] = useState(false);

  const handleRegenerar = async () => {
    setRegenerando(true);
    await regenerarVisual(fechaActual.getFullYear());
    setRegenerando(false);
  };

  const handleGenerarBackup = async () => {
    setGenerandoBackup(true);
    setMenuBackupAbierto(false);
    await generarBackup(fechaActual.getFullYear());
    setGenerandoBackup(false);
  };

  const handleRestaurarBackup = async () => {
    setMenuBackupAbierto(false);
    if (!confirm("¿Restaurar el cronograma desde el Backup? Esto regenerará la hoja Visual con los datos del Backup.")) return;
    setRestaurando(true);
    await restaurarBackup(fechaActual.getFullYear());
    setRestaurando(false);
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
              {/* Botón Actualizar Excel Visual */}
              <SidebarButton
                icon={<RefreshCw size={18} className={regenerando ? "animate-spin" : ""} />}
                label={regenerando ? "Actualizando..." : "Actualizar Excel Visual"}
                active={false}
                onClick={handleRegenerar}
              />

              {/* FIX: Menú desplegable de Backup */}
              <div className="relative">
                <SidebarButton
                  icon={
                    generandoBackup || restaurando
                      ? <RefreshCw size={18} className="animate-spin" />
                      : <Save size={18} />
                  }
                  label={
                    generandoBackup ? "Generando backup..." :
                    restaurando ? "Restaurando..." :
                    "Backup"
                  }
                  active={false}
                  onClick={() => setMenuBackupAbierto(!menuBackupAbierto)}
                  extraIcon={<ChevronDown size={12} className={`transition-transform ${menuBackupAbierto ? "rotate-180" : ""}`} />}
                />

                {menuBackupAbierto && (
                  <div className="absolute left-full bottom-0 ml-2 w-48 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 overflow-hidden">
                    <button
                      onClick={handleGenerarBackup}
                      disabled={generandoBackup}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-left"
                    >
                      <Save size={12} className="text-[#E91E63]" />
                      <span>Generar Backup</span>
                    </button>
                    <div className="border-t border-gray-100" />
                    <button
                      onClick={handleRestaurarBackup}
                      disabled={restaurando}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-left"
                    >
                      <Download size={12} className="text-blue-600" />
                      <span>Restaurar desde Backup</span>
                    </button>
                  </div>
                )}
              </div>
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
  extraIcon,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
  extraIcon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-2 rounded text-xs font-medium transition-colors ${
        active
          ? "bg-[#E91E63] text-white"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
      title={label}
    >
      <span className="shrink-0">{icon}</span>
      <span className="hidden lg:block truncate flex-1 text-left">{label}</span>
      {extraIcon && <span className="hidden lg:block shrink-0">{extraIcon}</span>}
      {highlight && (
        <span className="hidden lg:block ml-auto w-1.5 h-1.5 rounded-full bg-[#E91E63] animate-pulse" />
      )}
    </button>
  );
}

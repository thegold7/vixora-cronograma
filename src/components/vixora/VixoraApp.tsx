"use client";

import { useStore } from "@/lib/store";
import { SidebarLeft } from "@/components/vixora/SidebarLeft";
import { SidebarRight } from "@/components/vixora/SidebarRight";
import { Topbar } from "@/components/vixora/Topbar";
import { Calendario } from "@/components/vixora/Calendario";
import { ModalEdicion } from "@/components/vixora/ModalEdicion";
import { LoginModal } from "@/components/vixora/LoginModal";
import { Toast } from "@/components/vixora/Toast";
import { TecnicosManager } from "@/components/vixora/TecnicosManager";
import { Estadisticas } from "@/components/vixora/Estadisticas";
import { useEffect, useState, useRef } from "react";
import { Loader2 } from "lucide-react";

export function VixoraApp() {
  const {
    tecnicos,
    ots,
    actividades,
    cronograma,
    modoAcceso,
    cargando,
    actualizando,
    error,
    cargarDatos,
    limpiarSeleccionRango,
    seleccionRango,
    modalEdicion,
    loginModalAbierto,
  } = useStore();

  const [seccion, setSeccion] = useState<"cronograma" | "tecnicos" | "estadisticas">("cronograma");

  // Ref para detectar clicks fuera del calendario
  const calendarioRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Click fuera del calendario → deseleccionar rango
  // (solo si no hay modal abierto y hay selección activa)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Si hay modal abierto, no hacer nada
      if (modalEdicion?.abierto || loginModalAbierto) return;
      // Si no hay selección, no hacer nada
      if (!seleccionRango.inicio) return;
      // Si el click fue dentro del calendario, no hacer nada
      if (calendarioRef.current && calendarioRef.current.contains(e.target as Node)) {
        return;
      }
      // Si llegó aquí, el click fue fuera → deseleccionar
      limpiarSeleccionRango();
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [modalEdicion, loginModalAbierto, seleccionRango, limpiarSeleccionRango]);

  // Pantalla de carga SOLO al inicio (cargando=true)
  if (cargando) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 size={36} className="animate-spin text-[#E91E63]" />
        <p className="mt-3 text-sm text-gray-500">Cargando cronograma VIXORA…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <div className="bg-white border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-lg font-bold text-red-700 mb-2">Error al cargar</h2>
          <p className="text-sm text-gray-600 mb-3">{error}</p>
          <button
            onClick={() => cargarDatos()}
            className="px-3 py-1.5 text-xs text-white rounded bg-[#E91E63]"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Indicador sutil de actualización (barra fina arriba) */}
      {actualizando && (
        <div className="fixed top-0 left-0 right-0 z-[60] h-1 bg-[#E91E63] animate-pulse" />
      )}

      <div className="flex-1 flex overflow-hidden">
        <SidebarLeft onNavigate={setSeccion} seccionActual={seccion} />

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {seccion === "cronograma" && <Topbar />}

          <div className="flex-1 flex min-h-0 overflow-hidden">
            <div className="flex-1 overflow-auto" ref={calendarioRef}>
              {seccion === "cronograma" && (
                <div className="p-4">
                  <Calendario
                    tecnicos={tecnicos}
                    actividades={actividades}
                    cronograma={cronograma}
                    ots={ots}
                    modoAcceso={modoAcceso}
                  />
                  {modoAcceso === "lector" && (
                    <p className="mt-3 text-xs text-gray-400 italic">
                      Estás en modo lector. Click en "Entrar como editor" para asignar tareas.
                    </p>
                  )}
                  {modoAcceso === "editor" && (
                    <p className="mt-3 text-xs text-gray-400 italic">
                      💡 Click en celda para editar · Arrastra mouse para seleccionar rango · Click fuera del calendario para deseleccionar
                    </p>
                  )}
                </div>
              )}

              {seccion === "tecnicos" && (
                <TecnicosManager tecnicos={tecnicos} modoAcceso={modoAcceso} />
              )}

              {seccion === "estadisticas" && (
                <Estadisticas
                  tecnicos={tecnicos}
                  actividades={actividades}
                  cronograma={cronograma}
                  ots={ots}
                />
              )}
            </div>

            {seccion === "cronograma" && (
              <SidebarRight ots={ots} modoAcceso={modoAcceso} />
            )}
          </div>
        </main>
      </div>

      <ModalEdicion actividades={actividades} ots={ots} modoAcceso={modoAcceso} />
      <LoginModal />
      <Toast />
    </div>
  );
}

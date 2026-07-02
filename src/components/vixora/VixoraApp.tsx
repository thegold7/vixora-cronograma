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
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export function VixoraApp() {
  const {
    tecnicos,
    ots,
    actividades,
    cronograma,
    modoAcceso,
    cargando,
    error,
    cargarDatos,
  } = useStore();

  const [seccion, setSeccion] = useState<"cronograma" | "tecnicos" | "estadisticas">("cronograma");

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

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
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      <SidebarLeft onNavigate={setSeccion} seccionActual={seccion} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {seccion === "cronograma" && <Topbar />}

        <div className="flex-1 flex min-h-0 overflow-hidden">
          <div className="flex-1 overflow-auto">
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
                    💡 Click en celda para editar · Arrastra mouse horizontalmente para seleccionar rango · Shift+Click para extender · Arrastra OTs desde el panel derecho
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

      <ModalEdicion actividades={actividades} ots={ots} modoAcceso={modoAcceso} />
      <LoginModal />
      <Toast />
    </div>
  );
}

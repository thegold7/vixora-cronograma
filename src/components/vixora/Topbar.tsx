"use client";

import { useStore } from "@/lib/store";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

const MESES_ES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export function Topbar() {
  const {
    vista,
    setVista,
    fechaActual,
    setFechaActual,
    avanzaMes,
    retrocedeMes,
    avanzaSemana,
    retrocedeSemana,
    tecnicos,
    cronograma,
  } = useStore();

  const hoy = new Date();
  const irHoy = () => setFechaActual(new Date());

  const titulo =
    vista === "mes"
      ? `${MESES_ES[fechaActual.getMonth()]} ${fechaActual.getFullYear()}`
      : `Semana del ${formatCorto(fechaActual)}`;

  const avanzar = vista === "mes" ? avanzaMes : avanzaSemana;
  const retroceder = vista === "mes" ? retrocedeMes : retrocedeSemana;

  // estadísticas rápidas
  const activos = tecnicos.filter((t) => t.activo).length;
  const totalActividades = Object.keys(cronograma).length;

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={retroceder}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
          title="Anterior"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-sm font-semibold text-gray-900 min-w-[180px] text-center">
          {titulo}
        </div>
        <button
          onClick={avanzar}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
          title="Siguiente"
        >
          <ChevronRight size={18} />
        </button>
        <button
          onClick={irHoy}
          className="ml-2 px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 text-gray-600"
        >
          Hoy
        </button>
      </div>

      <div className="flex items-center gap-2">
        {/* Stats rápidas */}
        <div className="hidden md:flex items-center gap-3 mr-3 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span>{activos} activos</span>
          </div>
          <div className="flex items-center gap-1">
            <CalendarIcon size={12} />
            <span>{totalActividades} asignaciones</span>
          </div>
        </div>

        {/* Toggle vista */}
        <div className="flex border border-gray-200 rounded overflow-hidden">
          <button
            onClick={() => setVista("mes")}
            className={`px-3 py-1.5 text-xs font-medium ${
              vista === "mes"
                ? "bg-[#E91E63] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Mes
          </button>
          <button
            onClick={() => setVista("semana")}
            className={`px-3 py-1.5 text-xs font-medium ${
              vista === "semana"
                ? "bg-[#E91E63] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Semana
          </button>
        </div>
      </div>
    </header>
  );
}

function formatCorto(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

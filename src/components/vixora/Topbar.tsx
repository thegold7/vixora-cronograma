"use client";

import { useStore } from "@/lib/store";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from "lucide-react";

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
    seleccionRango,
    setSeleccionRango,
  } = useStore();

  const hoy = new Date();
  const irHoy = () => setFechaActual(new Date());

  const titulo =
    vista === "mes"
      ? `${MESES_ES[fechaActual.getMonth()]} ${fechaActual.getFullYear()}`
      : `Semana del ${formatCorto(fechaActual)}`;

  const avanzar = vista === "mes" ? avanzaMes : avanzaSemana;
  const retroceder = vista === "mes" ? retrocedeMes : retrocedeSemana;

  const activos = tecnicos.filter((t) => t.activo).length;
  const totalActividades = Object.keys(cronograma).length;

  const tieneRango = seleccionRango.inicio && seleccionRango.fin;
  const rangoDias = tieneRango
    ? Math.round(
        (new Date(seleccionRango.fin!).getTime() - new Date(seleccionRango.inicio!).getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1
    : 0;

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between gap-4 flex-wrap">
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

      {tieneRango && (
        <div className="flex items-center gap-2 px-3 py-1 bg-pink-50 border border-pink-200 rounded">
          <span className="text-xs font-semibold text-pink-700">
            📅 Rango: {formatearFecha(seleccionRango.inicio!)} → {formatearFecha(seleccionRango.fin!)}
          </span>
          <span className="text-[10px] text-pink-600">
            ({rangoDias} día{rangoDias !== 1 ? "s" : ""})
          </span>
          <button
            onClick={() => setSeleccionRango({ inicio: null, fin: null })}
            className="text-pink-700 hover:text-pink-900"
            title="Limpiar rango"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
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

function formatearFecha(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

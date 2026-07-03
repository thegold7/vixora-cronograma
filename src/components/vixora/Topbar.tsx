"use client";

import { useStore, formatFechaISO } from "@/lib/store";
import { COLOR_HEX } from "@/lib/types";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, Plus, Eraser, RefreshCw, ChevronDown, Trash2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";

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
    abrirModalEdicion,
    modoAcceso,
    limpiarSeleccionRango,
    cambiarEstadoRango,
    actividades,
    borrarEntrada,
    showToast,
  } = useStore();

  const hoy = new Date();
  const irHoy = () => setFechaActual(new Date());

  const titulo =
    vista === "mes"
      ? `${MESES_ES[fechaActual.getMonth()]} ${fechaActual.getFullYear()}`
      : vista === "semana"
      ? `Semana del ${formatCorto(fechaActual)}`
      : `Año ${fechaActual.getFullYear()}`;

  const avanzarAno = () => {
    const d = new Date(fechaActual);
    d.setFullYear(d.getFullYear() + 1);
    setFechaActual(d);
  };
  const retrocederAno = () => {
    const d = new Date(fechaActual);
    d.setFullYear(d.getFullYear() - 1);
    setFechaActual(d);
  };

  const avanzar = vista === "mes" ? avanzaMes : vista === "semana" ? avanzaSemana : avanzarAno;
  const retroceder = vista === "mes" ? retrocedeMes : vista === "semana" ? retrocedeSemana : retrocederAno;

  const activos = tecnicos.filter((t) => t.activo).length;
  const totalActividades = Object.keys(cronograma).length;

  const tieneRango = seleccionRango.inicio && seleccionRango.fin && seleccionRango.tecnico_id;
  const rangoDias = tieneRango
    ? Math.round(
        (new Date(seleccionRango.fin!).getTime() - new Date(seleccionRango.inicio!).getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1
    : 0;

  const tecnicoRango = tieneRango
    ? tecnicos.find((t) => t.id === seleccionRango.tecnico_id)
    : null;

  const handleAsignarRango = () => {
    if (tieneRango) {
      abrirModalEdicion(seleccionRango.tecnico_id!, seleccionRango.inicio!, true);
    }
  };

  // NUEVO: borrar datos del rango
  const handleBorrarRango = async () => {
    if (!tieneRango || !seleccionRango.tecnico_id) return;
    if (!confirm(`¿Borrar todas las asignaciones de ${seleccionRango.inicio} a ${seleccionRango.fin} para ${tecnicoRango?.nombre}?`)) return;

    const inicio = new Date(seleccionRango.inicio! + "T00:00:00");
    const fin = new Date(seleccionRango.fin! + "T00:00:00");
    const actual = new Date(inicio);
    let count = 0;

    while (actual <= fin) {
      const fecha = formatFechaISO(actual);
      const existing = cronograma[`${seleccionRango.tecnico_id}|${fecha}`];
      if (existing) {
        await borrarEntrada(seleccionRango.tecnico_id, fecha);
        count++;
      }
      actual.setDate(actual.getDate() + 1);
    }

    if (count > 0) {
      showToast(`Borradas ${count} asignación(es)`, "ok");
    } else {
      showToast("No había asignaciones en el rango", "info");
    }
    limpiarSeleccionRango();
  };

  // Menú desplegable para cambiar estado
  const [menuEstadoAbierto, setMenuEstadoAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuEstadoAbierto(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCambiarEstado = async (nuevaActividad: string) => {
    if (tieneRango && seleccionRango.tecnico_id) {
      await cambiarEstadoRango(
        seleccionRango.tecnico_id,
        seleccionRango.inicio!,
        seleccionRango.fin!,
        nuevaActividad
      );
      setMenuEstadoAbierto(false);
    }
  };

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

      {/* Indicador de rango seleccionado + botones */}
      {tieneRango && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1 bg-pink-50 border border-pink-200 rounded">
            <span className="text-xs font-semibold text-pink-700">
              📅 {formatearFecha(seleccionRango.inicio!)} → {formatearFecha(seleccionRango.fin!)}
            </span>
            <span className="text-[10px] text-pink-600">
              ({rangoDias} día{rangoDias !== 1 ? "s" : ""})
            </span>
            {tecnicoRango && (
              <span className="text-[10px] text-pink-700 font-medium hidden md:inline">
                · {tecnicoRango.nombre}
              </span>
            )}
          </div>

          {modoAcceso === "editor" && (
            <>
              {/* Botón Asignar a rango */}
              <button
                onClick={handleAsignarRango}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-white rounded font-semibold hover:opacity-90"
                style={{ backgroundColor: "#E91E63" }}
                title="Asignar actividad/OTs a todo el rango"
              >
                <Plus size={12} />
                Asignar
              </button>

              {/* Botón Cambiar estado - menú desplegable */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuEstadoAbierto(!menuEstadoAbierto)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded font-semibold hover:bg-gray-50 text-gray-700"
                  title="Cambiar estado/actividad a todo el rango"
                >
                  <RefreshCw size={12} />
                  Cambiar estado
                  <ChevronDown size={10} />
                </button>
                {menuEstadoAbierto && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 min-w-[180px] max-h-96 overflow-y-auto">
                    <div className="p-1">
                      <div className="text-[10px] font-bold text-gray-500 uppercase px-2 py-1">
                        Cambiar actividad a:
                      </div>
                      {actividades.map((a) => {
                        const hex = COLOR_HEX[a.color as keyof typeof COLOR_HEX];
                        return (
                          <button
                            key={a.codigo}
                            onClick={() => handleCambiarEstado(a.nombre)}
                            className="w-full text-left px-2 py-1.5 text-[11px] hover:bg-gray-100 rounded flex items-center gap-2"
                          >
                            <span
                              className="w-3 h-3 rounded shrink-0"
                              style={{ backgroundColor: hex.border }}
                            />
                            <span>{a.nombre}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Botón Borrar datos del rango */}
              <button
                onClick={handleBorrarRango}
                className="flex items-center gap-1 px-3 py-1.5 text-xs border border-red-300 rounded font-semibold hover:bg-red-50 text-red-600"
                title="Borrar todas las asignaciones del rango"
              >
                <Trash2 size={12} />
                Borrar datos
              </button>

              {/* Botón Limpiar selección */}
              <button
                onClick={limpiarSeleccionRango}
                className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded font-semibold hover:bg-gray-50 text-gray-700"
                title="Limpiar selección (no borra datos)"
              >
                <Eraser size={12} />
                Limpiar
              </button>
            </>
          )}

          {/* X para cerrar */}
          <button
            onClick={limpiarSeleccionRango}
            className="text-gray-400 hover:text-red-500 ml-1"
            title="Cerrar"
          >
            <X size={14} />
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

        {/* Toggle vista: Mes / Semana / Año */}
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
          <button
            onClick={() => setVista("año")}
            className={`px-3 py-1.5 text-xs font-medium ${
              vista === "año"
                ? "bg-[#E91E63] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Año
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

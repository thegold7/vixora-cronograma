"use client";

import { useStore, formatFechaISO } from "@/lib/store";
import { COLOR_HEX } from "@/lib/types";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, Plus, Eraser, RefreshCw, ChevronDown, Trash2, Search, Filter, Copy, ClipboardPaste, Repeat, CopyPlus } from "lucide-react";
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
    busquedaTecnico,
    setBusquedaTecnico,
    filtroCargo,
    setFiltroCargo,
    filtroActividad,
    setFiltroActividad,
    limpiarFiltros,
    // portapapeles
    clipboard,
    copiarRango,
    pegarEnCelda,
    duplicarDia,
    repetirPatron,
    limpiarClipboard,
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

  const handleBorrarRango = async () => {
    if (!tieneRango || !seleccionRango.tecnico_id) return;

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

  // Menús desplegables
  const [menuEstadoAbierto, setMenuEstadoAbierto] = useState(false);
  const [menuAccionesAbierto, setMenuAccionesAbierto] = useState(false);
  const [vecesRepetir, setVecesRepetir] = useState(2);
  const menuEstadoRef = useRef<HTMLDivElement>(null);
  const menuAccionesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuEstadoRef.current && !menuEstadoRef.current.contains(e.target as Node)) {
        setMenuEstadoAbierto(false);
      }
      if (menuAccionesRef.current && !menuAccionesRef.current.contains(e.target as Node)) {
        setMenuAccionesAbierto(false);
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

  const handleCopiar = () => {
    copiarRango();
    setMenuAccionesAbierto(false);
  };

  // FIX: pegar directamente en la celda seleccionada actualmente
  const handlePegar = () => {
    if (!clipboard) {
      showToast("Copia algo primero (Ctrl+C)", "info");
      return;
    }
    if (!seleccionRango.inicio || !seleccionRango.tecnico_id) {
      showToast("Selecciona la celda destino primero", "info");
      return;
    }
    pegarEnCelda(seleccionRango.tecnico_id, seleccionRango.inicio);
    setMenuAccionesAbierto(false);
  };

  const handleDuplicar = async () => {
    await duplicarDia();
    setMenuAccionesAbierto(false);
  };

  const handleRepetir = async () => {
    await repetirPatron(vecesRepetir);
    setMenuAccionesAbierto(false);
  };

  const cargosUnicos = Array.from(new Set(tecnicos.map((t) => t.cargo)));
  const hayFiltrosActivos = busquedaTecnico || filtroCargo || filtroActividad;
  const esUnSoloDia = tieneRango && seleccionRango.inicio === seleccionRango.fin;

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-2 space-y-2">
      {/* Fila 1: navegación + rango + vistas */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
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
                <button
                  onClick={handleAsignarRango}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-white rounded font-semibold hover:opacity-90"
                  style={{ backgroundColor: "#E91E63" }}
                  title="Asignar actividad/OTs a todo el rango"
                >
                  <Plus size={12} />
                  Asignar
                </button>

                {/* Menú de acciones: Copiar/Pegar/Duplicar/Repetir */}
                <div className="relative" ref={menuAccionesRef}>
                  <button
                    onClick={() => setMenuAccionesAbierto(!menuAccionesAbierto)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded font-semibold hover:bg-gray-50 text-gray-700"
                    title="Acciones avanzadas"
                  >
                    <Repeat size={12} />
                    Acciones
                    <ChevronDown size={10} />
                  </button>
                  {menuAccionesAbierto && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 min-w-[220px]">
                      <div className="p-1">
                        <div className="text-[10px] font-bold text-gray-500 uppercase px-2 py-1">
                          Copiar / Pegar
                        </div>
                        <button
                          onClick={handleCopiar}
                          className="w-full text-left px-2 py-1.5 text-[11px] hover:bg-gray-100 rounded flex items-center gap-2"
                        >
                          <Copy size={12} />
                          Copiar rango <kbd className="ml-auto text-[9px] bg-gray-100 px-1 rounded">Ctrl+C</kbd>
                        </button>
                        <button
                          onClick={handlePegar}
                          disabled={!clipboard}
                          className="w-full text-left px-2 py-1.5 text-[11px] hover:bg-gray-100 rounded flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ClipboardPaste size={12} />
                          Pegar en celda sel. <kbd className="ml-auto text-[9px] bg-gray-100 px-1 rounded">Ctrl+V</kbd>
                        </button>

                        <div className="border-t border-gray-100 my-1"></div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase px-2 py-1">
                          Duplicar / Repetir
                        </div>
                        <button
                          onClick={handleDuplicar}
                          disabled={!esUnSoloDia}
                          className="w-full text-left px-2 py-1.5 text-[11px] hover:bg-gray-100 rounded flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={esUnSoloDia ? "Duplica al día siguiente" : "Selecciona un solo día"}
                        >
                          <CopyPlus size={12} />
                          Duplicar día siguiente
                        </button>

                        <div className="px-2 py-1.5">
                          <div className="text-[10px] text-gray-600 mb-1 flex items-center gap-1">
                            <Repeat size={10} />
                            Repetir patrón:
                          </div>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              max={52}
                              value={vecesRepetir}
                              onChange={(e) => setVecesRepetir(Math.max(1, Math.min(52, parseInt(e.target.value) || 1)))}
                              className="w-14 px-1 py-0.5 text-[11px] border border-gray-200 rounded"
                            />
                            <span className="text-[10px] text-gray-500">veces</span>
                            <button
                              onClick={handleRepetir}
                              className="ml-auto px-2 py-0.5 text-[10px] text-white rounded bg-[#E91E63] hover:opacity-90"
                            >
                              Aplicar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative" ref={menuEstadoRef}>
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

                <button
                  onClick={handleBorrarRango}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs border border-red-300 rounded font-semibold hover:bg-red-50 text-red-600"
                  title="Borrar todas las asignaciones del rango"
                >
                  <Trash2 size={12} />
                  Borrar datos
                </button>

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

            <button
              onClick={limpiarSeleccionRango}
              className="text-gray-400 hover:text-red-500 ml-1"
              title="Cerrar"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Indicador clipboard con datos */}
        {clipboard && (
          <div className="flex items-center gap-2 px-2 py-1 bg-yellow-50 border border-yellow-200 rounded">
            <Copy size={12} className="text-yellow-700" />
            <span className="text-[10px] text-yellow-700">
              {clipboard.entradas.length} copiada(s) — Selecciona destino + Ctrl+V
            </span>
            <button
              onClick={limpiarClipboard}
              className="text-yellow-700 hover:text-red-600"
              title="Vaciar portapapeles"
            >
              <X size={10} />
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
      </div>

      {/* Fila 2: búsqueda y filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-[260px]">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busquedaTecnico}
            onChange={(e) => setBusquedaTecnico(e.target.value)}
            placeholder="Buscar técnico por nombre..."
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-pink-400"
          />
        </div>

        <div className="relative">
          <Filter size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select
            value={filtroCargo}
            onChange={(e) => setFiltroCargo(e.target.value)}
            className="pl-7 pr-6 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-pink-400 bg-white appearance-none cursor-pointer"
          >
            <option value="">Todos los cargos</option>
            {cargosUnicos.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="relative">
          <Filter size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select
            value={filtroActividad}
            onChange={(e) => setFiltroActividad(e.target.value)}
            className="pl-7 pr-6 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-pink-400 bg-white appearance-none cursor-pointer"
          >
            <option value="">Todas las actividades</option>
            {actividades.map((a) => (
              <option key={a.codigo} value={a.nombre}>{a.nombre}</option>
            ))}
          </select>
        </div>

        {hayFiltrosActivos && (
          <button
            onClick={limpiarFiltros}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-600 hover:text-red-600 hover:bg-red-50 rounded border border-gray-200"
            title="Limpiar filtros"
          >
            <X size={12} />
            Limpiar filtros
          </button>
        )}

        {hayFiltrosActivos && (
          <span className="text-[10px] text-pink-600 font-semibold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></span>
            Filtros activos
          </span>
        )}
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

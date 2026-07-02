"use client";

import { useStore, formatFechaISO } from "@/lib/store";
import { COLOR_HEX, type Tecnico, type Actividad, type EntradaCronograma, type CronogramaMap, type OT } from "@/lib/types";
import { useState, useRef, useEffect } from "react";

const DOW_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

interface Props {
  tecnicos: Tecnico[];
  actividades: Actividad[];
  cronograma: CronogramaMap;
  ots: OT[];
  modoAcceso: "lector" | "editor";
}

function getColorHex(actividades: Actividad[], nombre: string) {
  const a = actividades.find((x) => x.nombre === nombre);
  if (!a) return null;
  return COLOR_HEX[a.color];
}

function getDiasMes(year: number, month: number): Date[] {
  const last = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: last }, (_, i) => new Date(year, month, i + 1));
}

function getDiasSemana(fecha: Date): Date[] {
  const d = new Date(fecha);
  const diaSemana = d.getDay();
  const offset = diaSemana === 0 ? -6 : 1 - diaSemana;
  d.setDate(d.getDate() + offset);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(x.getDate() + i);
    return x;
  });
}

export function Calendario({ tecnicos, actividades, cronograma, ots, modoAcceso }: Props) {
  const {
    vista,
    fechaActual,
    mostrarDetalles,
    abrirModalEdicion,
    seleccionRango,
    setSeleccionRango,
  } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragHover, setDragHover] = useState<string | null>(null);

  const [dragSelectStart, setDragSelectStart] = useState<string | null>(null);
  const [dragSelectEnd, setDragSelectEnd] = useState<string | null>(null);

  const tecnicosVisibles = tecnicos.filter((t) => t.activo);

  const dias = vista === "mes"
    ? getDiasMes(fechaActual.getFullYear(), fechaActual.getMonth())
    : getDiasSemana(fechaActual);

  const otMap: Record<string, OT> = {};
  for (const o of ots) otMap[o.codigo] = o;

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      if (modoAcceso !== "editor") return;
      e.preventDefault();
      const target = (e.target as HTMLElement).closest("[data-cell-key]");
      if (target) {
        const key = target.getAttribute("data-cell-key");
        setDragHover(key);
      }
    };
    const handleDragLeave = () => setDragHover(null);
    const handleDrop = (e: DragEvent) => {
      if (modoAcceso !== "editor") return;
      e.preventDefault();
      setDragHover(null);
      const target = (e.target as HTMLElement).closest("[data-cell-key]");
      if (!target) return;
      const key = target.getAttribute("data-cell-key")!;
      const [tecnico_id, fecha] = key.split("|");
      const otsData = e.dataTransfer?.getData("text/plain");
      if (otsData) {
        try {
          const otsArr = JSON.parse(otsData);
          abrirModalEdicion(tecnico_id, fecha);
          useStore.getState().limpiarOTsSeleccionadas();
          otsArr.forEach((c: string) => {
            useStore.getState().toggleOTSeleccionada(c);
          });
        } catch {
          /* ignore */
        }
      }
    };

    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("dragover", handleDragOver);
    el.addEventListener("dragleave", handleDragLeave);
    el.addEventListener("drop", handleDrop);
    return () => {
      el.removeEventListener("dragover", handleDragOver);
      el.removeEventListener("dragleave", handleDragLeave);
      el.removeEventListener("drop", handleDrop);
    };
  }, [modoAcceso, abrirModalEdicion]);

  const handleCellClick = (tecnico_id: string, fecha: string, e: React.MouseEvent) => {
    if (modoAcceso !== "editor") return;
    if (e.shiftKey && seleccionRango.inicio) {
      const inicio = seleccionRango.inicio <= fecha ? seleccionRango.inicio : fecha;
      const fin = seleccionRango.inicio <= fecha ? fecha : seleccionRango.inicio;
      setSeleccionRango({ inicio, fin });
      return;
    }
    abrirModalEdicion(tecnico_id, fecha);
  };

  const handleCellMouseDown = (tecnico_id: string, fecha: string, e: React.MouseEvent) => {
    if (modoAcceso !== "editor") return;
    if (e.button !== 0) return;
    if (e.shiftKey || e.ctrlKey || e.metaKey) return;
    setDragSelectStart(`${tecnico_id}|${fecha}`);
    setDragSelectEnd(`${tecnico_id}|${fecha}`);
  };

  const handleCellMouseEnter = (tecnico_id: string, fecha: string) => {
    if (dragSelectStart) {
      const [tecStart] = dragSelectStart.split("|");
      if (tecStart === tecnico_id) {
        setDragSelectEnd(`${tecnico_id}|${fecha}`);
      }
    }
  };

  const handleCellMouseUp = (tecnico_id: string, fecha: string) => {
    if (!dragSelectStart) return;
    const [tecStart, fechaStart] = dragSelectStart.split("|");
    const fechaEnd = fecha;

    if (tecStart === tecnico_id && fechaStart !== fechaEnd) {
      const inicio = fechaStart <= fechaEnd ? fechaStart : fechaEnd;
      const fin = fechaStart <= fechaEnd ? fechaEnd : fechaStart;
      setSeleccionRango({ inicio, fin });
    }
    setDragSelectStart(null);
    setDragSelectEnd(null);
  };

  const isCellInRango = (fecha: string) => {
    if (!seleccionRango.inicio) return false;
    if (!seleccionRango.fin) return fecha === seleccionRango.inicio;
    return fecha >= seleccionRango.inicio! && fecha <= seleccionRango.fin!;
  };

  const isCellInDragRange = (tecnico_id: string, fecha: string) => {
    if (!dragSelectStart || !dragSelectEnd) return false;
    const [tecStart, fechaStart] = dragSelectStart.split("|");
    const [, fechaEnd] = dragSelectEnd.split("|");
    if (tecStart !== tecnico_id) return false;
    const inicio = fechaStart <= fechaEnd ? fechaStart : fechaEnd;
    const fin = fechaStart <= fechaEnd ? fechaEnd : fechaStart;
    return fecha >= inicio && fecha <= fin;
  };

  const renderCellContent = (entrada: EntradaCronograma) => {
    const colorHex = getColorHex(actividades, entrada.actividad);
    return (
      <div className="text-[10px] leading-tight">
        <div
          className="font-bold"
          style={{ color: colorHex?.text }}
        >
          {entrada.actividad}
        </div>
        {mostrarDetalles && entrada.ots_asignadas && entrada.ots_asignadas !== "—" && (
          <div className="mt-0.5 space-y-0.5">
            {entrada.ots_asignadas.split(",").map((cod, i) => {
              const c = cod.trim();
              const ot = otMap[c];
              const desc = ot ? `${ot.cliente}${ot.sede ? " " + ot.sede : ""}`.trim() : "";
              return (
                <div key={i} className="text-gray-700">
                  <div className="font-medium">{c}</div>
                  {desc && <div className="text-gray-500 text-[9px] leading-tight">{desc}</div>}
                </div>
              );
            })}
          </div>
        )}
        {mostrarDetalles && entrada.notas && (
          <div className="mt-0.5 text-gray-600 italic text-[9px]">{entrada.notas}</div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="overflow-auto border border-gray-200 rounded-lg bg-white"
      onMouseLeave={() => {
        if (dragSelectStart) {
          setDragSelectStart(null);
          setDragSelectEnd(null);
        }
      }}
    >
      <div className="sticky top-0 z-20 bg-[#1d1d1f] text-white flex">
        <div className="sticky left-0 z-30 bg-[#1d1d1f] border-r border-gray-700 min-w-[220px] p-2 text-xs font-semibold">
          TÉCNICO
        </div>
        <div className="flex">
          {dias.map((d) => {
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const iso = formatFechaISO(d);
            const inRango = isCellInRango(iso);
            return (
              <div
                key={iso}
                className={`border-r border-gray-700 min-w-[120px] text-center py-2 ${
                  isWeekend ? "bg-[#2a2a2c]" : ""
                } ${inRango ? "bg-[#E91E63]/40" : ""}`}
              >
                <div className="text-xs font-semibold">{d.getDate()}</div>
                <div className="text-[10px] opacity-70">{DOW_ES[d.getDay()]}</div>
              </div>
            );
          })}
        </div>
      </div>

      {tecnicosVisibles.length === 0 ? (
        <div className="p-8 text-center text-gray-500 text-sm">
          No hay técnicos activos. Activa técnicos desde el panel de gestión.
        </div>
      ) : (
        tecnicosVisibles.map((t, idx) => (
          <div key={t.id} className="flex border-b border-gray-200 hover:bg-gray-50/50">
            <div className="sticky left-0 z-10 bg-white border-r border-gray-200 min-w-[220px] p-2 flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#E91E63] text-white text-xs flex items-center justify-center font-bold">
                {idx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-gray-900 truncate">{t.nombre}</div>
                <div className="text-[10px] text-gray-500">{t.cargo}</div>
              </div>
            </div>
            <div className="flex">
              {dias.map((d) => {
                const iso = formatFechaISO(d);
                const key = `${t.id}|${iso}`;
                const entrada = cronograma[key];
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const colorHex = entrada ? getColorHex(actividades, entrada.actividad) : null;
                const isDragHover = dragHover === key;
                const inRango = isCellInRango(iso);
                const inDragRange = isCellInDragRange(t.id, iso);

                return (
                  <div
                    key={iso}
                    data-cell-key={key}
                    onClick={(e) => handleCellClick(t.id, iso, e)}
                    onDoubleClick={() => modoAcceso === "editor" && abrirModalEdicion(t.id, iso)}
                    onMouseDown={(e) => handleCellMouseDown(t.id, iso, e)}
                    onMouseEnter={() => handleCellMouseEnter(t.id, iso)}
                    onMouseUp={() => handleCellMouseUp(t.id, iso)}
                    className={`border-r border-gray-200 min-w-[120px] min-h-[64px] p-1 ${
                      modoAcceso === "editor" ? "cursor-pointer" : "cursor-default"
                    } transition-colors select-none ${
                      isWeekend ? "bg-gray-50" : ""
                    } ${inRango ? "ring-2 ring-[#E91E63] ring-inset" : ""} ${
                      isDragHover ? "bg-[#E91E63]/20 ring-2 ring-[#E91E63] ring-inset" : ""
                    } ${inDragRange ? "bg-[#E91E63]/30" : ""}`}
                    style={
                      colorHex && entrada
                        ? {
                            backgroundColor: colorHex.soft,
                            borderLeft: `3px solid ${colorHex.border}`,
                          }
                        : undefined
                    }
                    title={
                      modoAcceso === "editor"
                        ? "Click: editar · Arrastra mouse: rango · Shift+Click: extender · Arrastra OT aquí: asignar"
                        : undefined
                    }
                  >
                    {entrada ? (
                      renderCellContent(entrada)
                    ) : (
                      <div className="text-[10px] text-gray-300 opacity-50">—</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

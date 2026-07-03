"use client";

import { useStore, formatFechaISO } from "@/lib/store";
import { COLOR_HEX, type Tecnico, type Actividad, type EntradaCronograma, type CronogramaMap, type OT } from "@/lib/types";
import { useState, useRef, useEffect } from "react";

const DOW_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES_COMPLETOS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

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

function getDiasAño(year: number): Date[] {
  const dias: Date[] = [];
  for (let m = 0; m < 12; m++) {
    const last = new Date(year, m + 1, 0).getDate();
    for (let d = 1; d <= last; d++) {
      dias.push(new Date(year, m, d));
    }
  }
  return dias;
}

function getIniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  if (partes.length >= 2) {
    return (partes[0][0] + partes[1][0]).toUpperCase();
  }
  return nombre.substring(0, 2).toUpperCase();
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
  const [isDragging, setIsDragging] = useState(false);

  const tecnicosVisibles = tecnicos.filter((t) => t.activo);

  const dias = vista === "mes"
    ? getDiasMes(fechaActual.getFullYear(), fechaActual.getMonth())
    : vista === "semana"
    ? getDiasSemana(fechaActual)
    : getDiasAño(fechaActual.getFullYear());

  // Anchos FIJOS (en px) — garantiza alineación perfecta con Grid
  const anchoColDia = vista === "año" ? 50 : 120;
  const anchoColFija = vista === "año" ? 160 : 220;

  // Template de columnas para Grid: 1 columna fija + N columnas de días
  const gridTemplate = `${anchoColFija}px repeat(${dias.length}, ${anchoColDia}px)`;

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
    if (isDragging) {
      setIsDragging(false);
      return;
    }
    if (e.shiftKey && seleccionRango.inicio) {
      const tid = seleccionRango.tecnico_id || tecnico_id;
      const inicio = seleccionRango.inicio <= fecha ? seleccionRango.inicio : fecha;
      const fin = seleccionRango.inicio <= fecha ? fecha : seleccionRango.inicio;
      setSeleccionRango({ inicio, fin, tecnico_id: tid });
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
    setIsDragging(false);
  };

  const handleCellMouseEnter = (tecnico_id: string, fecha: string) => {
    if (!dragSelectStart) return;
    const [tecStart] = dragSelectStart.split("|");
    if (tecStart === tecnico_id) {
      setDragSelectEnd(`${tecnico_id}|${fecha}`);
      setIsDragging(true);
    }
  };

  const handleCellMouseUp = (tecnico_id: string, fecha: string) => {
    if (!dragSelectStart) return;
    const [tecStart, fechaStart] = dragSelectStart.split("|");
    const fechaEnd = fecha;

    if (tecStart === tecnico_id && fechaStart !== fechaEnd) {
      const inicio = fechaStart <= fechaEnd ? fechaStart : fechaEnd;
      const fin = fechaStart <= fechaEnd ? fechaEnd : fechaStart;
      setSeleccionRango({ inicio, fin, tecnico_id: tecStart });
      setIsDragging(false);
    }
    setDragSelectStart(null);
    setDragSelectEnd(null);
  };

  const isCellInRango = (tecnico_id: string, fecha: string) => {
    if (!seleccionRango.inicio) return false;
    if (seleccionRango.tecnico_id !== tecnico_id) return false;
    if (!seleccionRango.fin) return fecha === seleccionRango.inicio;
    return fecha >= seleccionRango.inicio! && fecha <= seleccionRango.fin!;
  };

  const isDateInRango = (fecha: string) => {
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
      <div className="text-[10px] leading-tight overflow-hidden">
        <div className="font-bold truncate" style={{ color: colorHex?.text }}>
          {entrada.actividad}
        </div>
        {mostrarDetalles && entrada.ots_asignadas && entrada.ots_asignadas !== "—" && (
          <div className="mt-0.5 space-y-0.5">
            {entrada.ots_asignadas.split(",").map((cod, i) => {
              const c = cod.trim();
              const ot = otMap[c];
              let detalleOt = "";
              if (entrada.detalle && entrada.detalle !== "—") {
                const lineas = entrada.detalle.split("\n");
                for (let li = 0; li < lineas.length; li++) {
                  const match = lineas[li].match(/^(\S+):$/);
                  if (match && match[1] === c) {
                    if (li + 1 < lineas.length) {
                      detalleOt = lineas[li + 1];
                    }
                    break;
                  }
                }
              }
              return (
                <div key={i} className="text-gray-700">
                  <div className="font-medium">{c}:</div>
                  {detalleOt && (
                    <div className="text-gray-500 text-[9px] leading-tight pl-1 truncate">{detalleOt}</div>
                  )}
                  {!detalleOt && ot && (
                    <div className="text-gray-400 text-[9px] leading-tight pl-1 truncate">
                      {ot.cliente}{ot.sede ? " · " + ot.sede : ""}
                    </div>
                  )}
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

  const renderCellContentAño = (entrada: EntradaCronograma) => {
    const colorHex = getColorHex(actividades, entrada.actividad);
    const abrev = entrada.actividad.length > 8
      ? entrada.actividad.substring(0, 4) + "."
      : entrada.actividad;
    return (
      <div
        className="text-[8px] leading-tight font-bold text-center flex items-center justify-center h-full overflow-hidden"
        style={{ color: colorHex?.text }}
        title={`${entrada.actividad}${entrada.ots_asignadas !== "—" ? " - " + entrada.ots_asignadas : ""}`}
      >
        {abrev}
      </div>
    );
  };

  // Construye el estilo de fondo de una celda
  const getCellBg = (entrada: EntradaCronograma | undefined, isWeekend: boolean, inRango: boolean, inDragRange: boolean, isDragHover: boolean) => {
    if (inRango) return "#fce4ec";
    if (inDragRange) return "#f8bbd0";
    if (isDragHover) return "#fce4ec";
    if (entrada) {
      const colorHex = getColorHex(actividades, entrada.actividad);
      if (colorHex) return colorHex.soft;
    }
    if (isWeekend) return "#f9fafb";
    return "#ffffff";
  };

  return (
    <div
      ref={containerRef}
      className="overflow-auto border border-gray-200 rounded-lg bg-white relative"
      onMouseLeave={() => {
        if (dragSelectStart) {
          setDragSelectStart(null);
          setDragSelectEnd(null);
          setIsDragging(false);
        }
      }}
    >
      {/* HEADER — Grid con sticky top + sticky left */}
      {vista === "año" ? (
        <>
          {/* Fila de MESES (solo vista año) */}
          <div
            className="sticky top-0 z-40 grid"
            style={{
              gridTemplateColumns: gridTemplate,
              backgroundColor: "#2a2a2c",
            }}
          >
            <div
              className="sticky left-0 z-50 flex items-center justify-center text-white text-xs font-semibold border-r border-gray-700"
              style={{ backgroundColor: "#2a2a2c", width: anchoColFija }}
            >
              TÉCNICO
            </div>
            {/* Renderizar meses agrupados */}
            {(() => {
              const mesesAgrupados: { mes: number; count: number }[] = [];
              let mesActual = -1;
              for (const d of dias) {
                if (d.getMonth() !== mesActual) {
                  mesesAgrupados.push({ mes: d.getMonth(), count: 1 });
                  mesActual = d.getMonth();
                } else {
                  mesesAgrupados[mesesAgrupados.length - 1].count++;
                }
              }
              return mesesAgrupados.map((g) => (
                <div
                  key={g.mes}
                  className="text-center flex items-center justify-center text-white text-[10px] font-bold uppercase tracking-wider border-r-2 border-[#E91E63]"
                  style={{ gridColumn: `span ${g.count}`, backgroundColor: "#2a2a2c" }}
                >
                  {MESES_COMPLETOS[g.mes]}
                </div>
              ));
            })()}
          </div>

          {/* Fila de DÍAS (vista año) */}
          <div
            className="sticky z-30 grid"
            style={{
              gridTemplateColumns: gridTemplate,
              top: 24,
              backgroundColor: "#1d1d1f",
            }}
          >
            <div
              className="sticky left-0 z-50 flex items-center justify-center text-white text-[10px] font-semibold border-r border-gray-700"
              style={{ backgroundColor: "#1d1d1f", width: anchoColFija }}
            >
            </div>
            {dias.map((d) => {
              const iso = formatFechaISO(d);
              const inRango = isDateInRango(iso);
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              const esPrimeroDeMes = d.getDate() === 1;
              return (
                <div
                  key={iso}
                  className={`text-center flex flex-col items-center justify-center text-white ${isWeekend ? "opacity-70" : ""} ${esPrimeroDeMes ? "border-l-2 border-l-[#E91E63]" : "border-r border-gray-700"}`}
                  style={{ backgroundColor: inRango ? "#E91E63" : "#1d1d1f" }}
                  title={`${iso} - ${DOW_ES[d.getDay()]}`}
                >
                  <div className="text-[9px] font-semibold">{d.getDate()}</div>
                  <div className="text-[8px] opacity-60">{DOW_ES[d.getDay()][0]}</div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* Header MES / SEMANA */
        <div
          className="sticky top-0 z-40 grid"
          style={{
            gridTemplateColumns: gridTemplate,
            backgroundColor: "#1d1d1f",
          }}
        >
          <div
            className="sticky left-0 z-50 flex items-center px-2 text-white text-xs font-semibold border-r border-gray-700"
            style={{ backgroundColor: "#1d1d1f", width: anchoColFija }}
          >
            TÉCNICO
          </div>
          {dias.map((d) => {
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const iso = formatFechaISO(d);
            const inRango = isDateInRango(iso);
            return (
              <div
                key={iso}
                className={`text-center flex flex-col items-center justify-center text-white ${isWeekend ? "opacity-80" : ""} border-r border-gray-700`}
                style={{ backgroundColor: inRango ? "#E91E63" : "#1d1d1f" }}
              >
                <div className="text-xs font-semibold">{d.getDate()}</div>
                <div className="text-[10px] opacity-70">{DOW_ES[d.getDay()]}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* FILAS DE TÉCNICOS — cada fila es un Grid idéntico */}
      {tecnicosVisibles.length === 0 ? (
        <div className="p-8 text-center text-gray-500 text-sm">
          No hay técnicos activos. Activa técnicos desde el panel de gestión.
        </div>
      ) : (
        tecnicosVisibles.map((t, idx) => (
          <div
            key={t.id}
            className="grid border-b border-gray-200"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {/* Celda fija del técnico */}
            <div
              className="sticky left-0 z-30 bg-white border-r border-gray-200 flex items-center gap-2 p-2"
              style={{ width: anchoColFija }}
            >
              <div className="relative shrink-0">
                <div className="w-10 h-12 rounded border-2 border-[#E91E63] overflow-hidden bg-gray-100 flex items-center justify-center">
                  {t.foto_url ? (
                    <img
                      src={t.foto_url}
                      alt={t.nombre}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="text-[10px] font-bold text-gray-500">
                      {getIniciales(t.nombre)}
                    </span>
                  )}
                </div>
                <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-[#E91E63] text-white text-[9px] flex items-center justify-center font-bold border border-white">
                  {idx + 1}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-gray-900 truncate">{t.nombre}</div>
                <div className="text-[10px] text-gray-500">{t.cargo}</div>
              </div>
            </div>
            {/* Celdas de días */}
            {dias.map((d) => {
              const iso = formatFechaISO(d);
              const key = `${t.id}|${iso}`;
              const entrada = cronograma[key];
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              const isDragHover = dragHover === key;
              const inRango = isCellInRango(t.id, iso);
              const inDragRange = isCellInDragRange(t.id, iso);
              const esPrimeroDeMes = vista === "año" && d.getDate() === 1;

              const cellBg = getCellBg(entrada, isWeekend, inRango, inDragRange, isDragHover);
              const colorHex = entrada ? getColorHex(actividades, entrada.actividad) : null;

              return (
                <div
                  key={iso}
                  data-cell-key={key}
                  onClick={(e) => handleCellClick(t.id, iso, e)}
                  onDoubleClick={() => modoAcceso === "editor" && abrirModalEdicion(t.id, iso)}
                  onMouseDown={(e) => handleCellMouseDown(t.id, iso, e)}
                  onMouseEnter={() => handleCellMouseEnter(t.id, iso)}
                  onMouseUp={() => handleCellMouseUp(t.id, iso)}
                  className={`border-r border-gray-200 ${modoAcceso === "editor" ? "cursor-pointer" : "cursor-default"} transition-colors select-none ${
                    inRango || isDragHover ? "ring-2 ring-[#E91E63] ring-inset" : ""
                  } ${esPrimeroDeMes ? "border-l-2 border-l-[#E91E63]" : ""}`}
                  style={{
                    backgroundColor: cellBg,
                    borderLeft: esPrimeroDeMes ? "2px solid #E91E63" : colorHex && entrada ? `3px solid ${colorHex.border}` : undefined,
                    padding: vista === "año" ? 2 : 4,
                    minHeight: vista === "año" ? 40 : 64,
                    overflow: "hidden",
                  }}
                  title={
                    modoAcceso === "editor"
                      ? `${iso} - ${DOW_ES[d.getDay()]} - Click: editar · Arrastra mouse: rango (solo esta fila)`
                      : `${iso} - ${DOW_ES[d.getDay()]}`
                  }
                >
                  {entrada ? (
                    vista === "año" ? (
                      renderCellContentAño(entrada)
                    ) : (
                      renderCellContent(entrada)
                    )
                  ) : (
                    <div className="text-[10px] text-gray-300 opacity-30">·</div>
                  )}
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}

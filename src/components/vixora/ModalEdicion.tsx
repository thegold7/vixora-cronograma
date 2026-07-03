"use client";

import { useStore } from "@/lib/store";
import { COLOR_HEX } from "@/lib/types";
import { X, Trash2, Save, Calendar } from "lucide-react";
import { useState, useEffect, useMemo } from "react";

interface Props {
  actividades: { codigo: string; nombre: string; color: string; descripcion: string }[];
  ots: { codigo: string; cliente: string; sede: string; estado: string; activo: boolean }[];
  modoAcceso: "lector" | "editor";
}

export function ModalEdicion({ actividades, ots, modoAcceso }: Props) {
  const { modalEdicion, cerrarModalEdicion, guardarEntrada, guardarEntradasRango, borrarEntrada, cronograma, otSeleccionadas, limpiarOTsSeleccionadas, showToast, seleccionRango, setSeleccionRango, tecnicos } = useStore();

  const [actividad, setActividad] = useState("");
  const [otsSel, setOtsSel] = useState<string[]>([]);
  const [detallesPorOt, setDetallesPorOt] = useState<Record<string, string>>({});
  const [notas, setNotas] = useState("");
  const [query, setQuery] = useState("");
  const [guardando, setGuardando] = useState(false);

  // inicializar al abrir
  useEffect(() => {
    if (!modalEdicion?.abierto) return;
    const key = `${modalEdicion.tecnico_id}|${modalEdicion.fecha}`;
    const existente = cronograma[key];
    if (existente) {
      setActividad(existente.actividad);
      const existOts = existente.ots_asignadas && existente.ots_asignadas !== "—"
        ? existente.ots_asignadas.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      setOtsSel(existOts);
      // Parsear detalle con formato: "código:\ndetalle\ncódigo:\ndetalle"
      const detallesIniciales: Record<string, string> = {};
      if (existente.detalle && existente.detalle !== "—") {
        const lineas = existente.detalle.split("\n");
        let i = 0;
        while (i < lineas.length) {
          const match = lineas[i].match(/^(\S+):$/);
          if (match) {
            const cod = match[1];
            if (i + 1 < lineas.length) {
              detallesIniciales[cod] = lineas[i + 1];
              i += 2;
            } else {
              detallesIniciales[cod] = "";
              i += 1;
            }
          } else {
            i += 1;
          }
        }
      }
      setDetallesPorOt(detallesIniciales);
      setNotas(existente.notas || "");
    } else {
      setActividad("");
      setOtsSel([]);
      setDetallesPorOt({});
      setNotas("");
    }
    if (otSeleccionadas.length > 0) {
      setOtsSel((prev) => Array.from(new Set([...prev, ...otSeleccionadas])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalEdicion]);

  const handleClose = () => {
    limpiarOTsSeleccionadas();
    cerrarModalEdicion();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modalEdicion?.abierto) {
        handleClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalEdicion]);

  const otsFiltradas = useMemo(() => {
    if (!query) return ots;
    const q = query.toLowerCase();
    return ots.filter(
      (o) =>
        o.codigo.toLowerCase().includes(q) ||
        o.cliente.toLowerCase().includes(q) ||
        o.sede.toLowerCase().includes(q)
    );
  }, [ots, query]);

  if (!modalEdicion?.abierto || !modalEdicion.tecnico_id || !modalEdicion.fecha) return null;

  const fechaObj = new Date(modalEdicion.fecha + "T00:00:00");
  const fechaStr = fechaObj.toLocaleDateString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Info del técnico
  const tecnico = tecnicos.find((t) => t.id === modalEdicion.tecnico_id);

  // Si es asignación a rango, calcular fechas
  const esRango = modalEdicion.aplicarARango && seleccionRango.inicio && seleccionRango.fin;
  const rangoDias = esRango
    ? Math.round(
        (new Date(seleccionRango.fin!).getTime() - new Date(seleccionRango.inicio!).getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1
    : 0;

  const handleToggleOT = (codigo: string) => {
    setOtsSel((prev) =>
      prev.includes(codigo) ? prev.filter((c) => c !== codigo) : [...prev, codigo]
    );
  };

  // Construir el detalle final con formato: "código:\ndetalle\ncódigo:\ndetalle"
  const construirDetalle = () => {
    if (otsSel.length === 0) return "—";
    const bloques = otsSel.map((cod) => {
      const detalle = detallesPorOt[cod]?.trim() || "";
      return `${cod}:\n${detalle}`;
    });
    return bloques.join("\n");
  };

  const handleGuardar = async () => {
    if (!actividad) {
      showToast("Selecciona una actividad", "error");
      return;
    }
    setGuardando(true);
    const ots_str = otsSel.length > 0 ? otsSel.join(", ") : "—";
    const detalleFinal = construirDetalle();
    
    if (esRango && seleccionRango.tecnico_id) {
      // Guardar en todo el rango
      await guardarEntradasRango(
        seleccionRango.tecnico_id,
        seleccionRango.inicio!,
        seleccionRango.fin!,
        {
          actividad,
          ots_asignadas: ots_str,
          detalle: detalleFinal,
          notas,
        }
      );
      // Limpiar rango después de asignar
      setSeleccionRango({ inicio: null, fin: null, tecnico_id: null });
    } else {
      await guardarEntrada(modalEdicion.tecnico_id!, modalEdicion.fecha!, {
        actividad,
        ots_asignadas: ots_str,
        detalle: detalleFinal,
        notas,
      });
    }
    setGuardando(false);
    handleClose();
  };

  const handleBorrar = async () => {
    if (!confirm("¿Eliminar esta entrada del cronograma?")) return;
    setGuardando(true);
    await borrarEntrada(modalEdicion.tecnico_id!, modalEdicion.fecha!);
    setGuardando(false);
    handleClose();
  };

  const actividadSel = actividades.find((a) => a.nombre === actividad);
  const colorHex = actividadSel ? COLOR_HEX[actividadSel.color as keyof typeof COLOR_HEX] : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-[95%] max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-4 py-3 flex items-center justify-between text-white"
          style={{ backgroundColor: colorHex?.border ?? "#1d1d1f" }}
        >
          <div>
            <div className="text-[10px] opacity-80 uppercase tracking-wider">
              {esRango ? "Asignar a rango" : "Editar asignación"}
            </div>
            <div className="text-sm font-bold capitalize">{fechaStr}</div>
            {tecnico && (
              <div className="text-[10px] mt-0.5 opacity-90">
                👤 {tecnico.nombre}
              </div>
            )}
            {esRango && (
              <div className="text-[10px] mt-0.5 opacity-90 flex items-center gap-1">
                <Calendar size={10} />
                Rango: {seleccionRango.inicio} → {seleccionRango.fin} ({rangoDias} días)
              </div>
            )}
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-white/20 rounded">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Actividad */}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
              Actividad <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-1.5">
              {actividades.map((a) => {
                const sel = actividad === a.nombre;
                const hex = COLOR_HEX[a.color as keyof typeof COLOR_HEX];
                return (
                  <button
                    key={a.codigo}
                    onClick={() => setActividad(a.nombre)}
                    className={`px-2 py-1.5 text-[10px] font-medium rounded border transition-all ${
                      sel ? "ring-2 ring-offset-1" : ""
                    }`}
                    style={{
                      backgroundColor: hex.bg,
                      color: hex.text,
                      borderColor: hex.border,
                      ...(sel ? { boxShadow: `0 0 0 2px ${hex.border}` } : {}),
                    }}
                    title={a.descripcion}
                  >
                    {a.nombre}
                  </button>
                );
              })}
            </div>
          </div>

          {/* OTs */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-700">
                OTs asignadas
              </label>
              {otsSel.length > 0 && (
                <span className="text-[10px] text-pink-600 font-semibold">
                  {otsSel.length} seleccionada(s)
                </span>
              )}
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar OT..."
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded mb-2 focus:outline-none focus:border-pink-400"
            />
            <div className="max-h-48 overflow-y-auto border border-gray-100 rounded">
              {otsFiltradas.length === 0 ? (
                <div className="p-3 text-center text-xs text-gray-400">
                  No hay OTs
                </div>
              ) : (
                otsFiltradas.map((o) => {
                  const sel = otsSel.includes(o.codigo);
                  return (
                    <div
                      key={o.codigo}
                      onClick={() => handleToggleOT(o.codigo)}
                      className={`p-2 cursor-pointer border-b border-gray-50 flex items-center gap-2 ${
                        sel ? "bg-pink-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div
                        className={`w-3 h-3 rounded border ${
                          sel
                            ? "bg-pink-500 border-pink-500"
                            : "border-gray-300"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-900">
                          {o.codigo}
                        </div>
                        <div className="text-[10px] text-gray-500 truncate">
                          {o.cliente} {o.sede ? `· ${o.sede}` : ""}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Detalle por OT — cajas individuales */}
          {otsSel.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                Detalle por OT
              </label>
              <p className="text-[10px] text-gray-400 mb-2">
                Ingresa el detalle/actividad para cada OT. Formato final:
              </p>
              <div className="space-y-2">
                {otsSel.map((cod) => {
                  const ot = ots.find((o) => o.codigo === cod);
                  return (
                    <div key={cod} className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                      <div className="text-xs font-bold text-gray-900 w-24 shrink-0 mt-1.5">
                        {cod}:
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-gray-500 mb-1">
                          {ot ? `${ot.cliente}${ot.sede ? " · " + ot.sede : ""}` : ""}
                        </div>
                        <input
                          type="text"
                          value={detallesPorOt[cod] || ""}
                          onChange={(e) =>
                            setDetallesPorOt((prev) => ({ ...prev, [cod]: e.target.value }))
                          }
                          placeholder="Ej: Documentos, CURSO, etc."
                          className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-pink-400"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Preview del detalle final */}
              <div className="mt-2 p-2 bg-pink-50 border border-pink-200 rounded">
                <div className="text-[10px] font-bold text-pink-700 mb-1">Preview del detalle:</div>
                <pre className="text-[10px] text-pink-900 whitespace-pre-wrap font-mono">
                  {construirDetalle() === "—" ? "(vacío)" : construirDetalle()}
                </pre>
              </div>
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
              Notas internas
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones, contexto..."
              rows={2}
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-pink-400 resize-none"
            />
          </div>
        </div>

        <div className="border-t border-gray-200 p-3 flex items-center justify-between gap-2">
          <div>
            {!esRango && cronograma[`${modalEdicion.tecnico_id}|${modalEdicion.fecha}`] && (
              <button
                onClick={handleBorrar}
                disabled={guardando}
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
              >
                <Trash2 size={14} />
                Eliminar
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              disabled={guardando}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardar}
              disabled={guardando || !actividad}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-white rounded disabled:opacity-50"
              style={{ backgroundColor: "#E91E63" }}
            >
              <Save size={14} />
              {guardando ? "Guardando..." : esRango ? `Guardar en ${rangoDias} días` : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useStore } from "@/lib/store";
import { useState, useMemo, useEffect } from "react";
import {
  Search, RefreshCw, ChevronDown, ChevronUp,
  Link as LinkIcon, Pencil, Plus, Trash2, X, Save, Copy,
  Eye, EyeOff,
} from "lucide-react";
import {
  calcularEstadoHabilitacion, calcularEstadoFecha, ESTADO_VISUAL,
  type EstadoDocumento, type Habilitacion, type SubDocumento,
} from "@/lib/types";

interface Props {
  tecnicos: any[];
  ots: any[];
  modoAcceso: "lector" | "editor";
}

export function HabilitacionesPanel({ tecnicos, ots, modoAcceso }: Props) {
  const {
    habilitaciones, cargarHabilitaciones,
    agregarHabilitacion, actualizarHabilitacion, eliminarHabilitacion,
    agregarSubDocumento, actualizarSubDocumento, eliminarSubDocumento,
    toggleContabilizarHabilitacion,
    sincronizarHabilitacionesExcel, showToast,
  } = useStore();

  const [query, setQuery] = useState("");
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [tecnicoSeleccionadoId, setTecnicoSeleccionadoId] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sedeExpandida, setSedeExpandida] = useState<string | null>(null);
  const [actualizando, setActualizando] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<EstadoDocumento | null>(null);
  const [agregandoHab, setAgregandoHab] = useState<{ tecnicoId: string; otCodigo: string } | null>(null);
  const [nuevaHab, setNuevaHab] = useState({
    documento_nombre: "",
    fecha_vencimiento: "",
    enlace_url: "",
    notas: "",
  });
  const [agregandoSubDoc, setAgregandoSubDoc] = useState<string | null>(null);
  const [nuevoSubDoc, setNuevoSubDoc] = useState({ nombre: "", fecha_vencimiento: "", enlace_url: "", notas: "" });
  const [editandoSubDoc, setEditandoSubDoc] = useState<{ id: string; sub: SubDocumento; parentId: string } | null>(null);
  const [editandoHab, setEditandoHab] = useState<Habilitacion | null>(null);
  const [replicandoSetup, setReplicandoSetup] = useState<any | null>(null);

  useEffect(() => {
    cargarHabilitaciones();
  }, [cargarHabilitaciones]);

  const otMap = useMemo(() => {
    const m: Record<string, any> = {};
    ots.forEach(o => { m[o.codigo] = o; });
    return m;
  }, [ots]);

  // Técnicos filtrados (sin vacíos, según inactivos y búsqueda)
  const tecnicosFiltrados = useMemo(() => {
    let result = tecnicos.filter(t => t.id && t.nombre && t.id.trim() !== "" && t.nombre.trim() !== "");
    if (!mostrarInactivos) {
      result = result.filter(t => t.activo);
    }
    return result;
  }, [tecnicos, mostrarInactivos]);

  // Habilitaciones por técnico
  const habilitacionesPorTecnico = useMemo(() => {
    const m: Record<string, Habilitacion[]> = {};
    for (const h of habilitaciones) {
      if (!m[h.tecnico_id]) m[h.tecnico_id] = [];
      m[h.tecnico_id].push(h);
    }
    return m;
  }, [habilitaciones]);

  // FIX: Resumen general por DOCUMENTOS (no por técnicos)
  // Cuenta documentos individuales (no sub-docs) y guarda nombre + doc + técnico para tooltip
  const resumenGeneral = useMemo(() => {
    const conteo: Record<EstadoDocumento, Array<{ tecnico: string; documento: string; sede: string }>> = {
      habilitado: [], por_vencer: [], en_riesgo: [], vencido: [],
    };
    for (const t of tecnicosFiltrados) {
      const habsTec = habilitacionesPorTecnico[t.id] || [];
      for (const h of habsTec) {
        if (h.contabilizar === false) continue; // no contabilizar
        const estado = calcularEstadoHabilitacion(h);
        conteo[estado].push({
          tecnico: t.nombre,
          documento: h.documento_nombre,
          sede: h.sede_nombre || "(sin sede)",
        });
      }
    }
    return conteo;
  }, [tecnicosFiltrados, habilitacionesPorTecnico]);

  // Aplicar búsqueda
  const tecnicosFinales = useMemo(() => {
    let result = tecnicosFiltrados;
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(t => {
        // Buscar por técnico
        const matchTecnico = t.id.toLowerCase().includes(q) ||
          t.nombre.toLowerCase().includes(q) ||
          t.cargo.toLowerCase().includes(q);
        if (matchTecnico) return true;
        // Buscar por OT o sede
        const habsTec = habilitacionesPorTecnico[t.id] || [];
        return habsTec.some(h => {
          const ot = otMap[h.ot_codigo];
          return h.ot_codigo.toLowerCase().includes(q) ||
            h.sede_nombre.toLowerCase().includes(q) ||
            (ot && ot.cliente.toLowerCase().includes(q)) ||
            h.documento_nombre.toLowerCase().includes(q);
        });
      });
    }
    return result;
  }, [tecnicosFiltrados, query, habilitacionesPorTecnico, otMap]);

  // Aplicar filtro de estado (por documento, no por estado general del técnico)
  const tecnicosConFiltro = useMemo(() => {
    if (!filtroEstado) return tecnicosFinales;
    return tecnicosFinales.filter(t => {
      const habsTec = habilitacionesPorTecnico[t.id] || [];
      return habsTec.some(h => {
        if (h.contabilizar === false) return false;
        return calcularEstadoHabilitacion(h) === filtroEstado;
      });
    });
  }, [tecnicosFinales, filtroEstado, habilitacionesPorTecnico]);

  // Handlers
  const handleActualizarExcel = async () => {
    setActualizando(true);
    await sincronizarHabilitacionesExcel();
    setActualizando(false);
  };

  const handleGuardarNuevaHab = async (tecnicoId: string, otCodigo: string) => {
    if (!nuevaHab.documento_nombre) {
      showToast("Nombre de documento es obligatorio", "error");
      return;
    }
    const ot = otMap[otCodigo];
    const ok = await agregarHabilitacion({
      tecnico_id: tecnicoId,
      ot_codigo: otCodigo,
      sede_nombre: ot?.sede || "",
      documento_nombre: nuevaHab.documento_nombre,
      fecha_vencimiento: nuevaHab.fecha_vencimiento || undefined,
      enlace_url: nuevaHab.enlace_url || undefined,
      notas: nuevaHab.notas || undefined,
    });
    if (ok) {
      setAgregandoHab(null);
      setNuevaHab({ documento_nombre: "", fecha_vencimiento: "", enlace_url: "", notas: "" });
    }
  };

  const handleGuardarNuevoSubDoc = async (habId: string) => {
    if (!nuevoSubDoc.nombre || !nuevoSubDoc.fecha_vencimiento) {
      showToast("Nombre y fecha son obligatorios", "error");
      return;
    }
    const ok = await agregarSubDocumento(habId, {
      nombre: nuevoSubDoc.nombre,
      fecha_vencimiento: nuevoSubDoc.fecha_vencimiento,
      enlace_url: nuevoSubDoc.enlace_url || undefined,
      notas: nuevoSubDoc.notas || undefined,
    });
    if (ok) {
      setAgregandoSubDoc(null);
      setNuevoSubDoc({ nombre: "", fecha_vencimiento: "", enlace_url: "", notas: "" });
    }
  };

  const getIniciales = (nombre: string) => {
    const partes = nombre.trim().split(/\s+/);
    return partes.length >= 2 ? (partes[0][0] + partes[1][0]).toUpperCase() : nombre.substring(0, 2).toUpperCase();
  };

  // Técnico seleccionado
  const tecnicoSeleccionado = tecnicoSeleccionadoId
    ? tecnicos.find(t => t.id === tecnicoSeleccionadoId)
    : null;
  const habilitacionesTecnicoSel = tecnicoSeleccionadoId
    ? habilitacionesPorTecnico[tecnicoSeleccionadoId] || []
    : [];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Columna principal: tabla */}
      <div className={`flex-1 overflow-auto ${sidebarVisible && tecnicoSeleccionado ? "max-w-[calc(100%-400px)]" : ""}`}>
        <div className="p-6 max-w-[1600px] mx-auto">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Habilitaciones</h2>
              <p className="text-sm text-gray-500">
                Gestión de documentos por técnico y OT · {habilitaciones.length} habilitaciones registradas
              </p>
            </div>
            {modoAcceso === "editor" && (
              <button
                onClick={handleActualizarExcel}
                disabled={actualizando}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-[#E91E63] border border-[#E91E63] rounded hover:bg-pink-50 disabled:opacity-50"
              >
                <RefreshCw size={14} className={actualizando ? "animate-spin" : ""} />
                {actualizando ? "Sincronizando..." : "Actualizar Excel"}
              </button>
            )}
          </div>

          {/* FIX: Resumen general delgado (no grande) */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {(["habilitado", "por_vencer", "en_riesgo", "vencido"] as EstadoDocumento[]).map(estado => {
              const items = resumenGeneral[estado];
              const visual = ESTADO_VISUAL[estado];
              const isActive = filtroEstado === estado;
              const tooltipText = items.length > 0
                ? items.map(i => `${i.tecnico} — ${i.documento} (${i.sede})`).join("\n")
                : "Sin documentos en este estado";
              return (
                <button
                  key={estado}
                  onClick={() => setFiltroEstado(isActive ? null : estado)}
                  className={`p-2 rounded-lg border-2 transition-all hover:shadow-sm ${isActive ? "ring-2 ring-offset-1" : ""}`}
                  style={{
                    backgroundColor: visual.bg,
                    borderColor: visual.border,
                    ...(isActive ? { boxShadow: `0 0 0 2px ${visual.border}` } : {})
                  }}
                  title={tooltipText}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg">{visual.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-lg font-bold leading-none" style={{ color: visual.color }}>
                        {items.length}
                      </div>
                      <div className="text-[9px] font-semibold uppercase leading-none mt-0.5" style={{ color: visual.color }}>
                        {visual.label}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Filtros */}
          <div className="flex gap-2 mb-4 items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por técnico, OT, sede o documento..."
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded"
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={mostrarInactivos}
                onChange={(e) => setMostrarInactivos(e.target.checked)}
              />
              Mostrar inactivos
            </label>
            {filtroEstado && (
              <button
                onClick={() => setFiltroEstado(null)}
                className="text-xs text-[#E91E63] hover:underline"
              >
                Quitar filtro ({ESTADO_VISUAL[filtroEstado].label})
              </button>
            )}
          </div>

          {/* Tabla cruzada */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 w-12">Foto</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 min-w-[160px]">Técnico</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 min-w-[300px]">Habilitaciones por Sede</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-600 w-32">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tecnicosConFiltro.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-4 text-gray-400">No hay técnicos que coincidan</td></tr>
                  ) : (
                    tecnicosConFiltro.map((t) => {
                      const habsTec = habilitacionesPorTecnico[t.id] || [];
                      const isSelected = tecnicoSeleccionadoId === t.id;

                      // FIX: Agrupar por sede y calcular resumen de 4 estados por sede (sin desplegar)
                      const habsPorSede: Record<string, Habilitacion[]> = {};
                      for (const h of habsTec) {
                        const sede = h.sede_nombre || "(sin sede)";
                        if (!habsPorSede[sede]) habsPorSede[sede] = [];
                        habsPorSede[sede].push(h);
                      }

                      // Resumen por sede (4 estados visibles al lado del nombre)
                      const calcularResumenSede = (habs: Habilitacion[]) => {
                        const c: Record<EstadoDocumento, number> = { habilitado: 0, por_vencer: 0, en_riesgo: 0, vencido: 0 };
                        for (const h of habs) {
                          if (h.contabilizar === false) continue;
                          c[calcularEstadoHabilitacion(h)]++;
                        }
                        return c;
                      };

                      return (
                        <tr
                          key={t.id}
                          className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${isSelected ? "bg-pink-50" : ""} ${!t.activo ? "opacity-50" : ""}`}
                          onClick={() => {
                            setTecnicoSeleccionadoId(t.id);
                            setSidebarVisible(true);
                          }}
                        >
                          <td className="px-3 py-2">
                            <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-200 shrink-0">
                              {t.foto_url ? (
                                <img src={t.foto_url} alt={t.nombre} className="w-full h-full object-cover" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-500">{getIniciales(t.nombre)}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-gray-900">{t.nombre}</div>
                            <div className="text-[10px] text-gray-500">{t.cargo}</div>
                            <div className="text-[10px] text-gray-400">{t.id}</div>
                          </td>
                          <td className="px-3 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                            {habsTec.length === 0 ? (
                              <div className="text-[10px] text-gray-400 italic">Sin habilitaciones</div>
                            ) : (
                              <div className="space-y-1">
                                {/* FIX: Desplegable por sede */}
                                <button
                                  onClick={() => setSedeExpandida(sedeExpandida === t.id ? null : t.id)}
                                  className="flex items-center gap-1 text-[10px] text-[#E91E63] hover:underline"
                                >
                                  {sedeExpandida === t.id ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                  {sedeExpandida === t.id ? "Contraer sedes" : `Ver ${Object.keys(habsPorSede).length} sede(s)`}
                                </button>

                                {sedeExpandida === t.id && (
                                  <div className="space-y-1 mt-1">
                                    {Object.entries(habsPorSede).map(([sede, habs]) => {
                                      const resumen = calcularResumenSede(habs);
                                      return (
                                        <div key={sede} className="border border-gray-200 rounded p-1.5">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-gray-900">{sede}</span>
                                            <div className="flex gap-1.5 text-[10px]">
                                              <span title="Habilitados">🟢 {resumen.habilitado}</span>
                                              <span title="Por vencer">🟡 {resumen.por_vencer}</span>
                                              <span title="En riesgo">🔴 {resumen.en_riesgo}</span>
                                              <span title="Vencidos">⚫ {resumen.vencido}</span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                            {modoAcceso === "editor" && (
                              <button
                                onClick={() => setReplicandoSetup(t)}
                                className="p-1 rounded text-[#E91E63] hover:bg-pink-50"
                                title="Replicar setup"
                              >
                                <Copy size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Leyenda */}
          <div className="mt-3 p-2 bg-gray-50 rounded text-[10px] text-gray-600 flex flex-wrap gap-3">
            <span className="font-bold">Estados:</span>
            <span className="flex items-center gap-1"><span>🟢</span> Habilitado (&gt;3 meses)</span>
            <span className="flex items-center gap-1"><span>🟡</span> Por vencer (≤3 meses)</span>
            <span className="flex items-center gap-1"><span>🔴</span> En riesgo (≤1 mes)</span>
            <span className="flex items-center gap-1"><span>⚫</span> Vencido</span>
          </div>
        </div>
      </div>

      {/* FIX: Sidebar derecho del técnico seleccionado */}
      {tecnicoSeleccionado && sidebarVisible && (
        <SidebarTecnicoHabilitaciones
          tecnico={tecnicoSeleccionado}
          habilitaciones={habilitacionesTecnicoSel}
          ots={ots}
          modoAcceso={modoAcceso}
          onClose={() => setTecnicoSeleccionadoId(null)}
          onHide={() => setSidebarVisible(false)}
          onAgregarHabilitacion={async (h) => await agregarHabilitacion(h)}
          onActualizarHabilitacion={async (id, newData) => await actualizarHabilitacion(id, newData)}
          onEliminarHabilitacion={async (id) => await eliminarHabilitacion(id)}
          onAgregarSubDoc={async (habId, sub) => await agregarSubDocumento(habId, sub)}
          onActualizarSubDoc={async (id, newData) => await actualizarSubDocumento(id, newData)}
          onEliminarSubDoc={async (id) => await eliminarSubDocumento(id)}
          onToggleContabilizar={async (id, contabilizar, es_subdoc) => await toggleContabilizarHabilitacion(id, contabilizar, es_subdoc)}
          onReplicarSetup={() => setReplicandoSetup(tecnicoSeleccionado)}
          showToast={showToast}
        />
      )}

      {/* Modal replicar setup */}
      {replicandoSetup && (
        <ModalReplicarSetup
          tecnicoOrigen={replicandoSetup}
          tecnicosDestino={tecnicos.filter(t => t.activo && t.id !== replicandoSetup.id && t.id && t.nombre)}
          habilitacionesOrigen={habilitacionesPorTecnico[replicandoSetup.id] || []}
          onClose={() => setReplicandoSetup(null)}
          onReplicar={async (destinoIds, copiarEstructura) => {
            for (const destId of destinoIds) {
              for (const h of habilitacionesPorTecnico[replicandoSetup.id] || []) {
                await agregarHabilitacion({
                  tecnico_id: destId,
                  ot_codigo: h.ot_codigo,
                  sede_nombre: h.sede_nombre,
                  documento_nombre: h.documento_nombre,
                  fecha_vencimiento: copiarEstructura ? undefined : h.fecha_vencimiento,
                  enlace_url: h.enlace_url,
                  notas: h.notas,
                  contabilizar: h.contabilizar,
                  sub_documentos: h.sub_documentos?.map(s => ({
                    id: "",
                    nombre: s.nombre,
                    fecha_vencimiento: copiarEstructura ? "" : s.fecha_vencimiento,
                    enlace_url: s.enlace_url,
                    notas: s.notas,
                    contabilizar: s.contabilizar,
                  })),
                });
              }
            }
            showToast(`Setup replicado a ${destinoIds.length} técnico(s)`, "ok");
            setReplicandoSetup(null);
          }}
        />
      )}
    </div>
  );
}

// =============================================================
// SUBCOMPONENTE: Sidebar derecho del técnico (con habilitaciones)
// =============================================================
function SidebarTecnicoHabilitaciones({
  tecnico, habilitaciones, ots, modoAcceso,
  onClose, onHide,
  onAgregarHabilitacion, onActualizarHabilitacion, onEliminarHabilitacion,
  onAgregarSubDoc, onActualizarSubDoc, onEliminarSubDoc,
  onToggleContabilizar,
  onReplicarSetup, showToast,
}: {
  tecnico: any;
  habilitaciones: Habilitacion[];
  ots: any[];
  modoAcceso: "lector" | "editor";
  onClose: () => void;
  onHide: () => void;
  onAgregarHabilitacion: (h: Omit<Habilitacion, "id">) => Promise<boolean>;
  onActualizarHabilitacion: (id: string, newData: Partial<Habilitacion>) => Promise<boolean>;
  onEliminarHabilitacion: (id: string) => Promise<boolean>;
  onAgregarSubDoc: (habId: string, sub: Omit<SubDocumento, "id">) => Promise<boolean>;
  onActualizarSubDoc: (id: string, newData: Partial<SubDocumento>) => Promise<boolean>;
  onEliminarSubDoc: (id: string) => Promise<boolean>;
  onToggleContabilizar: (id: string, contabilizar: boolean, es_subdoc: boolean) => Promise<boolean>;
  onReplicarSetup: () => void;
  showToast: (msg: string, tipo?: "ok" | "error" | "info") => void;
}) {
  const [sedeExpandida, setSedeExpandida] = useState<string | null>(null);
  const [agregandoHab, setAgregandoHab] = useState(false);
  const [nuevaHab, setNuevaHab] = useState({
    ot_codigo: "",
    documento_nombre: "",
    fecha_vencimiento: "",
    enlace_url: "",
    notas: "",
  });
  const [agregandoSubDoc, setAgregandoSubDoc] = useState<string | null>(null);
  const [nuevoSubDoc, setNuevoSubDoc] = useState({ nombre: "", fecha_vencimiento: "", enlace_url: "", notas: "" });
  const [editandoSubDoc, setEditandoSubDoc] = useState<{ id: string; sub: SubDocumento; parentId: string } | null>(null);
  const [editandoHab, setEditandoHab] = useState<Habilitacion | null>(null);

  // FIX: Agrupar por sede
  const habilitacionesPorSede = useMemo(() => {
    const grupos: Record<string, Habilitacion[]> = {};
    for (const h of habilitaciones) {
      const sede = h.sede_nombre || "(sin sede)";
      if (!grupos[sede]) grupos[sede] = [];
      grupos[sede].push(h);
    }
    return grupos;
  }, [habilitaciones]);

  const otMap = useMemo(() => {
    const m: Record<string, any> = {};
    ots.forEach(o => { m[o.codigo] = o; });
    return m;
  }, [ots]);

  // Resumen por sede (4 estados)
  const calcularResumenSede = (habs: Habilitacion[]) => {
    const c: Record<EstadoDocumento, number> = { habilitado: 0, por_vencer: 0, en_riesgo: 0, vencido: 0 };
    for (const h of habs) {
      if (h.contabilizar === false) continue;
      c[calcularEstadoHabilitacion(h)]++;
    }
    return c;
  };

  const getIniciales = (nombre: string) => {
    const partes = nombre.trim().split(/\s+/);
    return partes.length >= 2 ? (partes[0][0] + partes[1][0]).toUpperCase() : nombre.substring(0, 2).toUpperCase();
  };

  const handleGuardarNuevaHab = async () => {
    if (!nuevaHab.ot_codigo || !nuevaHab.documento_nombre) {
      showToast("OT y documento son obligatorios", "error");
      return;
    }
    const ot = otMap[nuevaHab.ot_codigo];
    const ok = await onAgregarHabilitacion({
      tecnico_id: tecnico.id,
      ot_codigo: nuevaHab.ot_codigo,
      sede_nombre: ot?.sede || "",
      documento_nombre: nuevaHab.documento_nombre,
      fecha_vencimiento: nuevaHab.fecha_vencimiento || undefined,
      enlace_url: nuevaHab.enlace_url || undefined,
      notas: nuevaHab.notas || undefined,
    });
    if (ok) {
      setAgregandoHab(false);
      setNuevaHab({ ot_codigo: "", documento_nombre: "", fecha_vencimiento: "", enlace_url: "", notas: "" });
    }
  };

  const handleGuardarNuevoSubDoc = async (habId: string) => {
    if (!nuevoSubDoc.nombre || !nuevoSubDoc.fecha_vencimiento) {
      showToast("Nombre y fecha son obligatorios", "error");
      return;
    }
    const ok = await onAgregarSubDoc(habId, {
      nombre: nuevoSubDoc.nombre,
      fecha_vencimiento: nuevoSubDoc.fecha_vencimiento,
      enlace_url: nuevoSubDoc.enlace_url || undefined,
      notas: nuevoSubDoc.notas || undefined,
    });
    if (ok) {
      setAgregandoSubDoc(null);
      setNuevoSubDoc({ nombre: "", fecha_vencimiento: "", enlace_url: "", notas: "" });
    }
  };

  return (
    <aside className="w-96 shrink-0 border-l border-gray-200 bg-white flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 flex items-center justify-between" style={{ backgroundColor: "#1d1d1f" }}>
        <div className="text-xs font-bold text-white uppercase">Detalle del Técnico</div>
        <div className="flex items-center gap-1">
          <button onClick={onHide} className="p-1 text-white/60 hover:text-white" title="Ocultar sidebar">
            <EyeOff size={14} />
          </button>
          <button onClick={onClose} className="p-1 text-white/60 hover:text-white" title="Cerrar">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* FIX: Foto vertical más grande (rectángulo) */}
        <div className="p-4 border-b border-gray-200 flex gap-3">
          <div className="w-24 h-32 rounded-lg overflow-hidden border-2 border-[#E91E63] bg-gray-200 shrink-0">
            {tecnico.foto_url ? (
              <img src={tecnico.foto_url} alt={tecnico.nombre} className="w-full h-full object-cover" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-500">{getIniciales(tecnico.nombre)}</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-gray-900">{tecnico.nombre}</div>
            <div className="text-xs text-gray-500">{tecnico.cargo}</div>
            <div className="text-[10px] text-gray-400 mt-1 space-y-0.5">
              {tecnico.correo && <div>{tecnico.correo}</div>}
              {tecnico.codigo_sap && <div>SAP: {tecnico.codigo_sap}</div>}
              <div>ID: {tecnico.id}</div>
            </div>
            {modoAcceso === "editor" && (
              <button
                onClick={onReplicarSetup}
                className="mt-2 flex items-center gap-1 px-2 py-1 text-[10px] text-[#E91E63] border border-[#E91E63] rounded hover:bg-pink-50"
              >
                <Copy size={10} /> Replicar setup
              </button>
            )}
          </div>
        </div>

        {/* Habilitaciones por sede (4 estados visibles sin desplegar) */}
        <div className="p-3">
          <div className="text-[10px] font-bold text-gray-500 uppercase mb-2">Habilitaciones por Sede</div>

          {Object.keys(habilitacionesPorSede).length === 0 ? (
            <div className="text-center py-4 text-xs text-gray-400 italic">
              Sin habilitaciones registradas
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(habilitacionesPorSede).map(([sede, habs]) => {
                const resumen = calcularResumenSede(habs);
                const expanded = sedeExpandida === sede;
                return (
                  <div key={sede} className="border border-gray-200 rounded">
                    {/* Header con sede + 4 estados al costado */}
                    <div className="flex items-center justify-between p-2 bg-gray-50">
                      <button
                        onClick={() => setSedeExpandida(expanded ? null : sede)}
                        className="flex items-center gap-1"
                      >
                        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        <span className="text-xs font-bold text-gray-900">{sede}</span>
                      </button>
                      <div className="flex gap-1.5 text-[10px]">
                        <span title="Habilitados">🟢 {resumen.habilitado}</span>
                        <span title="Por vencer">🟡 {resumen.por_vencer}</span>
                        <span title="En riesgo">🔴 {resumen.en_riesgo}</span>
                        <span title="Vencidos">⚫ {resumen.vencido}</span>
                      </div>
                    </div>

                    {/* Desplegar documentos */}
                    {expanded && (
                      <div className="p-2 space-y-1">
                        {/* Agrupar por OT dentro de la sede */}
                        {Object.entries(
                          habs.reduce((acc, h) => {
                            if (!acc[h.ot_codigo]) acc[h.ot_codigo] = [];
                            acc[h.ot_codigo].push(h);
                            return acc;
                          }, {} as Record<string, Habilitacion[]>)
                        ).map(([otCodigo, habsOt]) => {
                          const ot = otMap[otCodigo];
                          return (
                            <div key={otCodigo} className="border border-gray-100 rounded p-1.5 bg-white">
                              <div className="text-[10px] font-mono font-semibold text-gray-900 mb-1">
                                {otCodigo}
                                {ot && <span className="text-gray-500"> · {ot.cliente}</span>}
                              </div>
                              <div className="space-y-1">
                                {habsOt.map(h => {
                                  const estado = calcularEstadoHabilitacion(h);
                                  const visual = ESTADO_VISUAL[estado];
                                  const isEditing = editandoHab?.id === h.id;
                                  const contab = h.contabilizar !== false;
                                  return (
                                    <div key={h.id} className="p-1.5 rounded border" style={{ borderColor: visual.border, backgroundColor: contab ? visual.bg : "#f9f9f9", opacity: contab ? 1 : 0.6 }}>
                                      <div className="flex items-start justify-between gap-1">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1">
                                            <span className="text-sm">{visual.icon}</span>
                                            <span className="text-[11px] font-bold text-gray-900">{h.documento_nombre}</span>
                                            {!contab && (
                                              <span className="text-[8px] px-1 rounded bg-gray-300 text-gray-700">NO CONTAB.</span>
                                            )}
                                          </div>
                                          {!h.sub_documentos?.length && h.fecha_vencimiento && (
                                            <div className="text-[9px] text-gray-600 mt-0.5 flex items-center gap-1">
                                              <span>📅 Vence: {h.fecha_vencimiento.split("-").reverse().join("/")}</span>
                                            </div>
                                          )}
                                          {h.sub_documentos && h.sub_documentos.length > 0 && (
                                            <div className="mt-0.5 space-y-0.5">
                                              {h.sub_documentos.map(sub => {
                                                const subEstado = calcularEstadoFecha(sub.fecha_vencimiento);
                                                const subVisual = ESTADO_VISUAL[subEstado];
                                                const subContab = sub.contabilizar !== false;
                                                return (
                                                  <div key={sub.id} className="flex items-center gap-1 text-[9px] pl-1" style={{ opacity: subContab ? 1 : 0.5 }}>
                                                    <span>{subVisual.icon}</span>
                                                    <span className="text-gray-700">{sub.nombre}</span>
                                                    <span className="text-gray-400">·</span>
                                                    <span className="text-gray-500">{sub.fecha_vencimiento.split("-").reverse().join("/")}</span>
                                                    {sub.enlace_url && (
                                                      <a href={sub.enlace_url} target="_blank" rel="noopener noreferrer" className="text-[#E91E63] hover:underline">
                                                        <LinkIcon size={8} />
                                                      </a>
                                                    )}
                                                    {modoAcceso === "editor" && (
                                                      <>
                                                        <button onClick={() => setEditandoSubDoc({ id: sub.id, sub, parentId: h.id })} className="text-blue-500 hover:text-blue-700">
                                                          <Pencil size={8} />
                                                        </button>
                                                        <button
                                                          onClick={() => onToggleContabilizar(sub.id, !subContab, true)}
                                                          className={`p-0.5 rounded ${subContab ? "text-green-600 hover:bg-green-100" : "text-gray-400 hover:bg-gray-200"}`}
                                                          title={subContab ? "Contabilizando — click para excluir" : "Excluido — click para contabilizar"}
                                                        >
                                                          {subContab ? <Eye size={9} /> : <EyeOff size={9} />}
                                                        </button>
                                                        <button onClick={() => onEliminarSubDoc(sub.id)} className="text-red-500 hover:text-red-700">
                                                          <Trash2 size={8} />
                                                        </button>
                                                      </>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                          {h.enlace_url && !h.sub_documentos?.length && (
                                            <a href={h.enlace_url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-[#E91E63] hover:underline flex items-center gap-1 mt-0.5">
                                              <LinkIcon size={8} /> Ver documento
                                            </a>
                                          )}
                                        </div>
                                        {modoAcceso === "editor" && (
                                          <div className="flex flex-col gap-0.5">
                                            {/* Toggle contabilizar (documento padre) */}
                                            <button
                                              onClick={() => onToggleContabilizar(h.id, !contab, false)}
                                              className={`p-0.5 rounded ${contab ? "text-green-600 hover:bg-green-100" : "text-gray-400 hover:bg-gray-200"}`}
                                              title={contab ? "Contabilizando — click para excluir" : "Excluido — click para contabilizar"}
                                            >
                                              {contab ? <Eye size={9} /> : <EyeOff size={9} />}
                                            </button>
                                            <button onClick={() => setAgregandoSubDoc(h.id)} className="text-[#E91E63] hover:text-[#c2185b] p-0.5" title="Añadir sub-doc">
                                              <Plus size={9} />
                                            </button>
                                            <button onClick={() => onEliminarHabilitacion(h.id)} className="text-red-500 hover:text-red-700 p-0.5" title="Eliminar">
                                              <Trash2 size={9} />
                                            </button>
                                          </div>
                                        )}
                                      </div>

                                      {/* Agregar sub-doc */}
                                      {modoAcceso === "editor" && agregandoSubDoc === h.id && (
                                        <div className="mt-1 p-1 bg-white rounded border border-gray-200 space-y-1">
                                          <input type="text" placeholder="Nombre sub-doc" value={nuevoSubDoc.nombre} onChange={(e) => setNuevoSubDoc({...nuevoSubDoc, nombre: e.target.value})} className="w-full px-1 py-0.5 text-[9px] border border-gray-200 rounded" />
                                          <input type="date" value={nuevoSubDoc.fecha_vencimiento} onChange={(e) => setNuevoSubDoc({...nuevoSubDoc, fecha_vencimiento: e.target.value})} className="w-full px-1 py-0.5 text-[9px] border border-gray-200 rounded" />
                                          <input type="text" placeholder="Enlace URL (opcional)" value={nuevoSubDoc.enlace_url} onChange={(e) => setNuevoSubDoc({...nuevoSubDoc, enlace_url: e.target.value})} className="w-full px-1 py-0.5 text-[9px] border border-gray-200 rounded" />
                                          <div className="flex gap-1">
                                            <button onClick={() => handleGuardarNuevoSubDoc(h.id)} className="flex-1 py-0.5 text-[9px] text-white bg-[#E91E63] rounded hover:bg-[#c2185b]">Guardar</button>
                                            <button onClick={() => { setAgregandoSubDoc(null); setNuevoSubDoc({ nombre: "", fecha_vencimiento: "", enlace_url: "", notas: "" }); }} className="px-1 py-0.5 text-[9px] text-gray-500 border border-gray-200 rounded">X</button>
                                          </div>
                                        </div>
                                      )}

                                      {/* Editar sub-doc */}
                                      {editandoSubDoc && editandoSubDoc.parentId === h.id && h.sub_documentos?.some(s => s.id === editandoSubDoc.id) && (
                                        <div className="mt-1 p-1 bg-white rounded border border-blue-200 space-y-1">
                                          <div className="text-[9px] font-bold text-blue-700">Editando sub-documento</div>
                                          <input type="text" value={editandoSubDoc.sub.nombre} onChange={(e) => setEditandoSubDoc({ id: editandoSubDoc.id, sub: { ...editandoSubDoc.sub, nombre: e.target.value }, parentId: editandoSubDoc.parentId })} className="w-full px-1 py-0.5 text-[9px] border border-gray-200 rounded" />
                                          <input type="date" value={editandoSubDoc.sub.fecha_vencimiento} onChange={(e) => setEditandoSubDoc({ id: editandoSubDoc.id, sub: { ...editandoSubDoc.sub, fecha_vencimiento: e.target.value }, parentId: editandoSubDoc.parentId })} className="w-full px-1 py-0.5 text-[9px] border border-gray-200 rounded" />
                                          <input type="text" placeholder="URL" value={editandoSubDoc.sub.enlace_url || ""} onChange={(e) => setEditandoSubDoc({ id: editandoSubDoc.id, sub: { ...editandoSubDoc.sub, enlace_url: e.target.value }, parentId: editandoSubDoc.parentId })} className="w-full px-1 py-0.5 text-[9px] border border-gray-200 rounded" />
                                          <div className="flex gap-1">
                                            <button
                                              onClick={async () => {
                                                await onActualizarSubDoc(editandoSubDoc.id, editandoSubDoc.sub);
                                                setEditandoSubDoc(null);
                                              }}
                                              className="flex-1 py-0.5 text-[9px] text-white bg-[#E91E63] rounded hover:bg-[#c2185b]"
                                            >
                                              Guardar
                                            </button>
                                            <button onClick={() => setEditandoSubDoc(null)} className="px-1 py-0.5 text-[9px] text-gray-500 border border-gray-200 rounded">X</button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Agregar nueva habilitación a esta OT */}
                              {modoAcceso === "editor" && agregandoHab?.tecnicoId === tecnico.id && agregandoHab?.otCodigo === otCodigo ? (
                                <div className="mt-1 p-1.5 bg-gray-50 rounded border border-gray-200 space-y-1">
                                  <div className="text-[9px] font-bold text-gray-700">Nueva habilitación</div>
                                  <input type="text" placeholder="Nombre (ej: EMO, Curso Alturas)" value={nuevaHab.documento_nombre} onChange={(e) => setNuevaHab({...nuevaHab, documento_nombre: e.target.value})} className="w-full px-1 py-0.5 text-[9px] border border-gray-200 rounded" />
                                  <input type="date" value={nuevaHab.fecha_vencimiento} onChange={(e) => setNuevaHab({...nuevaHab, fecha_vencimiento: e.target.value})} className="w-full px-1 py-0.5 text-[9px] border border-gray-200 rounded" />
                                  <input type="text" placeholder="Enlace URL" value={nuevaHab.enlace_url} onChange={(e) => setNuevaHab({...nuevaHab, enlace_url: e.target.value})} className="w-full px-1 py-0.5 text-[9px] border border-gray-200 rounded" />
                                  <div className="flex gap-1">
                                    <button
                                      onClick={async () => {
                                        if (!nuevaHab.documento_nombre) {
                                          showToast("Nombre obligatorio", "error");
                                          return;
                                        }
                                        const ot = otMap[otCodigo];
                                        await onAgregarHabilitacion({
                                          tecnico_id: tecnico.id,
                                          ot_codigo: otCodigo,
                                          sede_nombre: ot?.sede || "",
                                          documento_nombre: nuevaHab.documento_nombre,
                                          fecha_vencimiento: nuevaHab.fecha_vencimiento || undefined,
                                          enlace_url: nuevaHab.enlace_url || undefined,
                                          notas: nuevaHab.notas || undefined,
                                        });
                                        setAgregandoHab(null);
                                        setNuevaHab({ ot_codigo: "", documento_nombre: "", fecha_vencimiento: "", enlace_url: "", notas: "" });
                                      }}
                                      className="flex-1 py-0.5 text-[9px] text-white bg-[#E91E63] rounded hover:bg-[#c2185b]"
                                    >
                                      Guardar
                                    </button>
                                    <button onClick={() => { setAgregandoHab(null); setNuevaHab({ ot_codigo: "", documento_nombre: "", fecha_vencimiento: "", enlace_url: "", notas: "" }); }} className="px-1 py-0.5 text-[9px] text-gray-500 border border-gray-200 rounded">X</button>
                                  </div>
                                </div>
                              ) : (
                                modoAcceso === "editor" && (
                                  <button
                                    onClick={() => setAgregandoHab({ tecnicoId: tecnico.id, otCodigo })}
                                    className="text-[9px] text-[#E91E63] hover:underline flex items-center gap-0.5 mt-1"
                                  >
                                    <Plus size={9} /> Añadir habilitación
                                  </button>
                                )
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Añadir OT completa (para crear habilitación eligiendo OT) */}
          {modoAcceso === "editor" && !agregandoHab && (
            <div className="mt-3 p-2 bg-gray-50 rounded border border-gray-200 space-y-1">
              <div className="text-[10px] font-bold text-gray-700">Añadir habilitación eligiendo OT</div>
              <select
                value={nuevaHab.ot_codigo}
                onChange={(e) => setNuevaHab({...nuevaHab, ot_codigo: e.target.value})}
                className="w-full px-1 py-1 text-[10px] border border-gray-200 rounded bg-white"
              >
                <option value="">Selecciona OT...</option>
                {ots.map(o => <option key={o.codigo} value={o.codigo}>{o.codigo} - {o.cliente} ({o.sede})</option>)}
              </select>
              <input type="text" placeholder="Nombre documento" value={nuevaHab.documento_nombre} onChange={(e) => setNuevaHab({...nuevaHab, documento_nombre: e.target.value})} className="w-full px-1 py-1 text-[10px] border border-gray-200 rounded" />
              <input type="date" value={nuevaHab.fecha_vencimiento} onChange={(e) => setNuevaHab({...nuevaHab, fecha_vencimiento: e.target.value})} className="w-full px-1 py-1 text-[10px] border border-gray-200 rounded" />
              <input type="text" placeholder="Enlace URL (opcional)" value={nuevaHab.enlace_url} onChange={(e) => setNuevaHab({...nuevaHab, enlace_url: e.target.value})} className="w-full px-1 py-1 text-[10px] border border-gray-200 rounded" />
              <button
                onClick={async () => {
                  if (!nuevaHab.ot_codigo || !nuevaHab.documento_nombre) {
                    showToast("OT y documento obligatorios", "error");
                    return;
                  }
                  const ot = otMap[nuevaHab.ot_codigo];
                  await onAgregarHabilitacion({
                    tecnico_id: tecnico.id,
                    ot_codigo: nuevaHab.ot_codigo,
                    sede_nombre: ot?.sede || "",
                    documento_nombre: nuevaHab.documento_nombre,
                    fecha_vencimiento: nuevaHab.fecha_vencimiento || undefined,
                    enlace_url: nuevaHab.enlace_url || undefined,
                    notas: nuevaHab.notas || undefined,
                  });
                  setNuevaHab({ ot_codigo: "", documento_nombre: "", fecha_vencimiento: "", enlace_url: "", notas: "" });
                }}
                className="w-full py-1 text-[10px] text-white bg-[#E91E63] rounded hover:bg-[#c2185b] flex items-center justify-center gap-1"
              >
                <Plus size={10} /> Añadir habilitación
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

// =============================================================
// SUBCOMPONENTE: Modal replicar setup
// =============================================================
function ModalReplicarSetup({
  tecnicoOrigen, tecnicosDestino, habilitacionesOrigen, onClose, onReplicar,
}: {
  tecnicoOrigen: any;
  tecnicosDestino: any[];
  habilitacionesOrigen: Habilitacion[];
  onClose: () => void;
  onReplicar: (destinoIds: string[], copiarEstructura: boolean) => Promise<void>;
}) {
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [copiarEstructura, setCopiarEstructura] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [replicando, setReplicando] = useState(false);

  const tecnicosFiltrados = useMemo(() => {
    if (!busqueda) return tecnicosDestino;
    const q = busqueda.toLowerCase();
    return tecnicosDestino.filter(t =>
      t.id.toLowerCase().includes(q) ||
      t.nombre.toLowerCase().includes(q) ||
      t.cargo.toLowerCase().includes(q)
    );
  }, [tecnicosDestino, busqueda]);

  const toggleSeleccion = (id: string) => {
    setSeleccionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const seleccionarTodos = () => {
    if (seleccionados.length === tecnicosFiltrados.length) {
      setSeleccionados([]);
    } else {
      setSeleccionados(tecnicosFiltrados.map(t => t.id));
    }
  };

  const handleReplicar = async () => {
    if (seleccionados.length === 0) {
      alert("Selecciona al menos un técnico destino");
      return;
    }
    if (!confirm(`¿Replicar ${habilitacionesOrigen.length} habilitacion(es) a ${seleccionados.length} técnico(s)?`)) return;
    setReplicando(true);
    await onReplicar(seleccionados, copiarEstructura);
    setReplicando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-[95%] max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 flex items-center justify-between text-white" style={{ backgroundColor: "#1d1d1f" }}>
          <div>
            <div className="text-sm font-bold">Replicar setup de habilitaciones</div>
            <div className="text-[10px] text-white/60">Origen: {tecnicoOrigen.nombre} · {habilitacionesOrigen.length} documento(s)</div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
            <input type="checkbox" checked={copiarEstructura} onChange={(e) => setCopiarEstructura(e.target.checked)} />
            <span>Solo estructura (sin fechas) — recomendado. Si desmarcas, se copiarán también las fechas de vencimiento.</span>
          </label>

          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar técnico destino..." className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded" />
            </div>
            <button onClick={seleccionarTodos} className="text-xs text-[#E91E63] hover:underline">
              {seleccionados.length === tecnicosFiltrados.length ? "Quitar todos" : "Seleccionar todos"}
            </button>
          </div>

          <div className="border border-gray-200 rounded max-h-96 overflow-y-auto">
            {tecnicosFiltrados.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400">No hay técnicos disponibles</div>
            ) : (
              tecnicosFiltrados.map(t => (
                <label key={t.id} className="flex items-center gap-2 p-2 border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={seleccionados.includes(t.id)} onChange={() => toggleSeleccion(t.id)} />
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-gray-900">{t.nombre}</div>
                    <div className="text-[10px] text-gray-500">{t.cargo} · {t.id}</div>
                  </div>
                </label>
              ))
            )}
          </div>

          <div className="text-[10px] text-gray-500">
            {seleccionados.length} técnico(s) seleccionado(s) · Se crearán {seleccionados.length * habilitacionesOrigen.length} habilitación(es) en total
          </div>
        </div>
        <div className="border-t border-gray-200 p-3 flex justify-end gap-2">
          <button onClick={onClose} disabled={replicando} className="px-3 py-1.5 text-xs border border-gray-200 rounded hover:bg-gray-50">Cancelar</button>
          <button onClick={handleReplicar} disabled={replicando || seleccionados.length === 0} className="flex items-center gap-1 px-3 py-1.5 text-xs text-white rounded bg-[#E91E63] hover:bg-[#c2185b] disabled:opacity-50">
            <Copy size={14} /> {replicando ? "Replicando..." : `Replicar a ${seleccionados.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}

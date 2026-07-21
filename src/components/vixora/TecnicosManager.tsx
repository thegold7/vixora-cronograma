"use client";

import { useStore } from "@/lib/store";
import { useState, useMemo, useEffect } from "react";
import {
  Plus, Trash2, Save, RefreshCw, Pencil, X, Search,
  UserPlus, Eye, EyeOff, ChevronDown, ChevronUp,
  Link as LinkIcon, Calendar, FileText, Copy, AlertCircle, CheckSquare, Square
} from "lucide-react";
import {
  calcularEstadoHabilitacion, calcularEstadoFecha, ESTADO_VISUAL,
  type EstadoDocumento, type Habilitacion, type SubDocumento,
} from "@/lib/types";
import { formatFechaISO } from "@/lib/store";

interface Props {
  tecnicos: any[];
  modoAcceso: "lector" | "editor";
}

export function TecnicosManager({ tecnicos, modoAcceso }: Props) {
  const {
    ots, habilitaciones, cargarHabilitaciones, cargarDatosSilencioso,
    agregarTecnico, actualizarTecnico, eliminarTecnicoLogico,
    sincronizarTecnicosExcel,
    agregarHabilitacion, actualizarHabilitacion, eliminarHabilitacion,
    agregarSubDocumento, actualizarSubDocumento, eliminarSubDocumento,
    showToast,
  } = useStore();

  const [query, setQuery] = useState("");
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [selectedTecnicoId, setSelectedTecnicoId] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [editandoTecnico, setEditandoTecnico] = useState<any | null>(null);
  const [creandoTecnico, setCreandoTecnico] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [replicandoSetup, setReplicandoSetup] = useState(false);

  // Cargar habilitaciones al montar
  useEffect(() => {
    cargarHabilitaciones();
  }, [cargarHabilitaciones]);

  // Filtrar técnicos: eliminar filas vacías (sin ID ni nombre) + filtro inactivos + búsqueda
  const tecnicosFiltrados = useMemo(() => {
    let result = tecnicos.filter(t => t.id && t.nombre && t.id.trim() !== "" && t.nombre.trim() !== "");
    if (!mostrarInactivos) {
      result = result.filter(t => t.activo);
    }
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(t =>
        t.id.toLowerCase().includes(q) ||
        t.nombre.toLowerCase().includes(q) ||
        t.cargo.toLowerCase().includes(q) ||
        (t.correo || "").toLowerCase().includes(q) ||
        (t.codigo_sap || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [tecnicos, query, mostrarInactivos]);

  // Generar siguiente ID automático
  const generarSiguienteId = () => {
    const ids = tecnicos.map(t => t.id).filter(id => id && id.startsWith("T"));
    const nums = ids.map(id => parseInt(id.substring(1), 10)).filter(n => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `T${String(max + 1).padStart(2, "0")}`;
  };

  const handleEliminarTecnico = async (id: string, nombre: string) => {
    if (!confirm(`¿Marcar a ${nombre} como inactivo? Podrás reactivarlo luego con el toggle "Mostrar inactivos".`)) return;
    await eliminarTecnicoLogico(id);
  };

  const handleActualizarExcel = async () => {
    setActualizando(true);
    await sincronizarTecnicosExcel();
    setActualizando(false);
  };

  const selectedTecnico = selectedTecnicoId
    ? tecnicos.find(t => t.id === selectedTecnicoId)
    : null;

  // Habilitaciones del técnico seleccionado
  const habilitacionesTecnico = useMemo(() => {
    if (!selectedTecnicoId) return [];
    return habilitaciones.filter(h => h.tecnico_id === selectedTecnicoId);
  }, [habilitaciones, selectedTecnicoId]);

  // Calcular estado general del técnico (peor estado de todas sus habilitaciones)
  const estadoGeneralTecnico = (tecId: string): EstadoDocumento | null => {
    const habsTec = habilitaciones.filter(h => h.tecnico_id === tecId);
    if (habsTec.length === 0) return null;
    const estados = habsTec.map(h => calcularEstadoHabilitacion(h));
    const prioridad: Record<EstadoDocumento, number> = {
      vencido: 4, en_riesgo: 3, por_vencer: 2, habilitado: 1,
    };
    return estados.reduce((worst, curr) =>
      prioridad[curr] > prioridad[worst] ? curr : worst
    );
  };

  // Estado general de todos los técnicos (para tarjetas resumen arriba)
  const resumenGeneral = useMemo(() => {
    const tecnicosActivos = tecnicos.filter(t => t.activo && t.id && t.nombre);
    const conteo: Record<EstadoDocumento, string[]> = {
      habilitado: [],
      por_vencer: [],
      en_riesgo: [],
      vencido: [],
    };
    for (const t of tecnicosActivos) {
      const estado = estadoGeneralTecnico(t.id);
      if (estado) {
        conteo[estado].push(t.nombre);
      }
    }
    return conteo;
  }, [tecnicos, habilitaciones]);

  const [filtroEstadoGeneral, setFiltroEstadoGeneral] = useState<EstadoDocumento | null>(null);

  // Aplicar filtro de estado general a la tabla
  const tecnicosFinales = useMemo(() => {
    if (!filtroEstadoGeneral) return tecnicosFiltrados;
    return tecnicosFiltrados.filter(t => estadoGeneralTecnico(t.id) === filtroEstadoGeneral);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tecnicosFiltrados, filtroEstadoGeneral, habilitaciones]);

  const getIniciales = (nombre: string) => {
    const partes = nombre.trim().split(/\s+/);
    return partes.length >= 2 ? (partes[0][0] + partes[1][0]).toUpperCase() : nombre.substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Columna principal: tabla */}
      <div className={`flex-1 overflow-auto ${sidebarVisible && selectedTecnico ? "max-w-[calc(100%-384px)]" : ""}`}>
        <div className="p-6">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Técnicos</h2>
              <p className="text-sm text-gray-500">
                {tecnicosFinales.length} de {tecnicos.filter(t => t.id && t.nombre).length} técnicos
                {habilitaciones.length > 0 && ` · ${habilitaciones.length} habilitaciones registradas`}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {modoAcceso === "editor" && (
                <>
                  <button
                    onClick={() => setCreandoTecnico(true)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-white rounded bg-[#E91E63] hover:bg-[#c2185b]"
                  >
                    <UserPlus size={14} /> Nuevo técnico
                  </button>
                  <button
                    onClick={handleActualizarExcel}
                    disabled={actualizando}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-[#E91E63] border border-[#E91E63] rounded hover:bg-pink-50 disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={actualizando ? "animate-spin" : ""} />
                    {actualizando ? "Sincronizando..." : "Actualizar Excel"}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Resumen general - tarjetas clickeables con tooltip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            {(["habilitado", "por_vencer", "en_riesgo", "vencido"] as EstadoDocumento[]).map(estado => {
              const nombres = resumenGeneral[estado];
              const visual = ESTADO_VISUAL[estado];
              const isActive = filtroEstadoGeneral === estado;
              return (
                <button
                  key={estado}
                  onClick={() => setFiltroEstadoGeneral(isActive ? null : estado)}
                  className={`relative p-3 rounded-lg border-2 text-left transition-all hover:shadow-md ${isActive ? "ring-2 ring-offset-1" : ""}`}
                  style={{ backgroundColor: visual.bg, borderColor: visual.border, ...(isActive ? { boxShadow: `0 0 0 2px ${visual.border}` } : {}) }}
                  title={nombres.length > 0 ? `Técnicos: ${nombres.join(", ")}` : "Sin técnicos en este estado"}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{visual.icon}</span>
                    <div>
                      <div className="text-xl font-bold" style={{ color: visual.color }}>
                        {nombres.length}
                      </div>
                      <div className="text-[10px] font-semibold uppercase" style={{ color: visual.color }}>
                        {visual.label}
                      </div>
                    </div>
                  </div>
                  {nombres.length > 0 && (
                    <div className="mt-1 text-[9px] text-gray-500 italic truncate">
                      {nombres.slice(0, 2).join(", ")}{nombres.length > 2 ? ` +${nombres.length - 2}` : ""}
                    </div>
                  )}
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
                placeholder="Buscar por ID, nombre, cargo, correo o SAP..."
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
            {filtroEstadoGeneral && (
              <button
                onClick={() => setFiltroEstadoGeneral(null)}
                className="text-xs text-[#E91E63] hover:underline"
              >
                Quitar filtro de estado
              </button>
            )}
          </div>

          {/* Tabla */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 w-12">Foto</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">ID</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Nombre</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Cargo</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Correo</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Código SAP</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-600">Estado</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-600">Hab.</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tecnicosFinales.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-4 text-gray-400">No hay técnicos que coincidan</td></tr>
                  ) : (
                    tecnicosFinales.map((t) => {
                      const estadoHab = estadoGeneralTecnico(t.id);
                      const visual = estadoHab ? ESTADO_VISUAL[estadoHab] : null;
                      const isSelected = selectedTecnicoId === t.id;
                      return (
                        <tr
                          key={t.id}
                          className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${isSelected ? "bg-pink-50 border-l-2 border-l-[#E91E63]" : ""} ${!t.activo ? "opacity-50" : ""}`}
                          onClick={() => {
                            setSelectedTecnicoId(t.id);
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
                          <td className="px-3 py-2 font-mono text-gray-700">{t.id}</td>
                          <td className="px-3 py-2 font-semibold text-gray-900">{t.nombre}</td>
                          <td className="px-3 py-2 text-gray-600">{t.cargo}</td>
                          <td className="px-3 py-2 text-gray-600">{t.correo || "—"}</td>
                          <td className="px-3 py-2 text-gray-600 font-mono">{t.codigo_sap || "—"}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${t.activo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                              {t.activo ? "Activo" : "Inactivo"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {visual ? (
                              <span className="text-lg" title={`${visual.label}: ${resumenGeneral[estadoHab!].join(", ")}`}>
                                {visual.icon}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            {modoAcceso === "editor" && (
                              <>
                                <button
                                  onClick={() => setEditandoTecnico(t)}
                                  className="p-1 rounded text-blue-600 hover:bg-blue-100"
                                  title="Editar"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => handleEliminarTecnico(t.id, t.nombre)}
                                  className="p-1 rounded text-red-600 hover:bg-red-100 ml-1"
                                  title="Marcar como inactivo"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
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
        </div>
      </div>

      {/* Sidebar derecho: detalle del técnico + habilitaciones */}
      {selectedTecnico && sidebarVisible && (
        <SidebarTecnico
          tecnico={selectedTecnico}
          habilitacionesTecnico={habilitacionesTecnico}
          ots={ots}
          modoAcceso={modoAcceso}
          onClose={() => {
            setSelectedTecnicoId(null);
          }}
          onHide={() => setSidebarVisible(false)}
          onEditarTecnico={() => setEditandoTecnico(selectedTecnico)}
          onAgregarHabilitacion={async (h) => await agregarHabilitacion(h)}
          onActualizarHabilitacion={async (id, newData) => await actualizarHabilitacion(id, newData)}
          onEliminarHabilitacion={async (id) => await eliminarHabilitacion(id)}
          onAgregarSubDoc={async (habId, sub) => await agregarSubDocumento(habId, sub)}
          onActualizarSubDoc={async (id, newData) => await actualizarSubDocumento(id, newData)}
          onEliminarSubDoc={async (id) => await eliminarSubDocumento(id)}
          onReplicarSetup={() => setReplicandoSetup(true)}
          tecnicosParaReplicar={tecnicos.filter(t => t.activo && t.id !== selectedTecnico.id && t.id && t.nombre)}
          showToast={showToast}
        />
      )}

      {/* Modal crear técnico */}
      {creandoTecnico && (
        <ModalTecnico
          tecnico={null}
          siguienteId={generarSiguienteId()}
          onClose={() => setCreandoTecnico(false)}
          onSave={async (data) => {
            const ok = await agregarTecnico(data);
            if (ok) setCreandoTecnico(false);
          }}
        />
      )}

      {/* Modal editar técnico */}
      {editandoTecnico && (
        <ModalTecnico
          tecnico={editandoTecnico}
          siguienteId={editandoTecnico.id}
          onClose={() => setEditandoTecnico(null)}
          onSave={async (data) => {
            const ok = await actualizarTecnico(editandoTecnico.id, data);
            if (ok) setEditandoTecnico(null);
          }}
        />
      )}

      {/* Modal replicar setup */}
      {replicandoSetup && selectedTecnico && (
        <ModalReplicarSetup
          tecnicoOrigen={selectedTecnico}
          tecnicosDestino={tecnicos.filter(t => t.activo && t.id !== selectedTecnico.id && t.id && t.nombre)}
          habilitacionesOrigen={habilitacionesTecnico}
          onClose={() => setReplicandoSetup(false)}
          onReplicar={async (destinoIds, copiarEstructura) => {
            // Copiar estructura (sin fechas) a cada destino
            for (const destId of destinoIds) {
              for (const h of habilitacionesTecnico) {
                const nuevaHab: Omit<Habilitacion, "id"> = {
                  tecnico_id: destId,
                  ot_codigo: h.ot_codigo,
                  sede_nombre: h.sede_nombre,
                  documento_nombre: h.documento_nombre,
                  fecha_vencimiento: copiarEstructura ? undefined : h.fecha_vencimiento,
                  enlace_url: h.enlace_url,
                  notas: h.notas,
                  sub_documentos: h.sub_documentos?.map(s => ({
                    id: "", // se asigna en backend
                    nombre: s.nombre,
                    fecha_vencimiento: copiarEstructura ? "" : s.fecha_vencimiento,
                    enlace_url: s.enlace_url,
                    notas: s.notas,
                  })),
                };
                await agregarHabilitacion(nuevaHab);
              }
            }
            showToast(`Setup replicado a ${destinoIds.length} técnico(s)`, "ok");
            setReplicandoSetup(false);
          }}
        />
      )}
    </div>
  );
}

// =============================================================
// SUBCOMPONENTE: Sidebar de detalle del técnico
// =============================================================
function SidebarTecnico({
  tecnico, habilitacionesTecnico, ots, modoAcceso,
  onClose, onHide, onEditarTecnico,
  onAgregarHabilitacion, onActualizarHabilitacion, onEliminarHabilitacion,
  onAgregarSubDoc, onActualizarSubDoc, onEliminarSubDoc,
  onReplicarSetup, showToast,
}: {
  tecnico: any;
  habilitacionesTecnico: Habilitacion[];
  ots: any[];
  modoAcceso: "lector" | "editor";
  onClose: () => void;
  onHide: () => void;
  onEditarTecnico: () => void;
  onAgregarHabilitacion: (h: Omit<Habilitacion, "id">) => Promise<boolean>;
  onActualizarHabilitacion: (id: string, newData: Partial<Habilitacion>) => Promise<boolean>;
  onEliminarHabilitacion: (id: string) => Promise<boolean>;
  onAgregarSubDoc: (habId: string, sub: Omit<SubDocumento, "id">) => Promise<boolean>;
  onActualizarSubDoc: (id: string, newData: Partial<SubDocumento>) => Promise<boolean>;
  onEliminarSubDoc: (id: string) => Promise<boolean>;
  onReplicarSetup: () => void;
  tecnicosParaReplicar: any[];
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
  const [editandoSubDoc, setEditandoSubDoc] = useState<{ id: string; sub: SubDocumento } | null>(null);
  const [editandoHab, setEditandoHab] = useState<Habilitacion | null>(null);

  // Agrupar habilitaciones por sede_nombre
  const habilitacionesPorSede = useMemo(() => {
    const grupos: Record<string, Habilitacion[]> = {};
    for (const h of habilitacionesTecnico) {
      const sede = h.sede_nombre || "(sin sede)";
      if (!grupos[sede]) grupos[sede] = [];
      grupos[sede].push(h);
    }
    return grupos;
  }, [habilitacionesTecnico]);

  // Mapa de OTs por código para obtener sede
  const otMap = useMemo(() => {
    const m: Record<string, any> = {};
    ots.forEach(o => { m[o.codigo] = o; });
    return m;
  }, [ots]);

  // Estado general del técnico
  const estadoGeneral = useMemo(() => {
    if (habilitacionesTecnico.length === 0) return null;
    const estados = habilitacionesTecnico.map(h => calcularEstadoHabilitacion(h));
    const prioridad: Record<EstadoDocumento, number> = {
      vencido: 4, en_riesgo: 3, por_vencer: 2, habilitado: 1,
    };
    return estados.reduce((worst, curr) =>
      prioridad[curr] > prioridad[worst] ? curr : worst
    );
  }, [habilitacionesTecnico]);

  // Resumen de estados del técnico
  const resumenTecnico = useMemo(() => {
    const conteo: Record<EstadoDocumento, number> = {
      habilitado: 0, por_vencer: 0, en_riesgo: 0, vencido: 0,
    };
    for (const h of habilitacionesTecnico) {
      const est = calcularEstadoHabilitacion(h);
      conteo[est]++;
    }
    return conteo;
  }, [habilitacionesTecnico]);

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
    const sede = ot?.sede || "";
    const ok = await onAgregarHabilitacion({
      tecnico_id: tecnico.id,
      ot_codigo: nuevaHab.ot_codigo,
      sede_nombre: sede,
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
      <div className="p-4 border-b border-gray-200 flex items-center justify-between" style={{ backgroundColor: "#1d1d1f" }}>
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
        {/* Foto + datos */}
        <div className="p-4 text-center border-b border-gray-200">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[#E91E63] bg-gray-200 mx-auto mb-2">
            {tecnico.foto_url ? (
              <img src={tecnico.foto_url} alt={tecnico.nombre} className="w-full h-full object-cover" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-500">{getIniciales(tecnico.nombre)}</div>
            )}
          </div>
          <div className="text-base font-bold text-gray-900">{tecnico.nombre}</div>
          <div className="text-xs text-gray-500">{tecnico.cargo}</div>
          <div className="text-[10px] text-gray-400 mt-1">
            {tecnico.correo && <div>{tecnico.correo}</div>}
            {tecnico.codigo_sap && <div>SAP: {tecnico.codigo_sap}</div>}
            <div>ID: {tecnico.id}</div>
          </div>

          {/* Estado general del técnico */}
          {estadoGeneral && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full" style={{ backgroundColor: ESTADO_VISUAL[estadoGeneral].bg, border: `1px solid ${ESTADO_VISUAL[estadoGeneral].border}` }}>
              <span className="text-lg">{ESTADO_VISUAL[estadoGeneral].icon}</span>
              <span className="text-xs font-semibold" style={{ color: ESTADO_VISUAL[estadoGeneral].color }}>
                {ESTADO_VISUAL[estadoGeneral].label}
              </span>
            </div>
          )}

          {/* Resumen de estados */}
          {habilitacionesTecnico.length > 0 && (
            <div className="mt-2 flex justify-center gap-2 text-[10px]">
              {(["habilitado", "por_vencer", "en_riesgo", "vencido"] as EstadoDocumento[]).map(est => (
                <div key={est} className="flex items-center gap-1" title={ESTADO_VISUAL[est].label}>
                  <span>{ESTADO_VISUAL[est].icon}</span>
                  <span className="font-semibold">{resumenTecnico[est]}</span>
                </div>
              ))}
            </div>
          )}

          {modoAcceso === "editor" && (
            <div className="mt-3 flex gap-1 justify-center">
              <button
                onClick={onEditarTecnico}
                className="flex items-center gap-1 px-2 py-1 text-[10px] text-blue-600 border border-blue-300 rounded hover:bg-blue-50"
              >
                <Pencil size={10} /> Editar
              </button>
              <button
                onClick={onReplicarSetup}
                className="flex items-center gap-1 px-2 py-1 text-[10px] text-[#E91E63] border border-[#E91E63] rounded hover:bg-pink-50"
                title="Copiar setup de habilitaciones a otros técnicos"
              >
                <Copy size={10} /> Replicar setup
              </button>
            </div>
          )}
        </div>

        {/* Habilitaciones por sede */}
        <div className="p-3">
          <div className="text-[10px] font-bold text-gray-500 uppercase mb-2">Habilitaciones por Sede</div>

          {Object.keys(habilitacionesPorSede).length === 0 ? (
            <div className="text-center py-4 text-xs text-gray-400 italic">
              Sin habilitaciones registradas
            </div>
          ) : (
            Object.entries(habilitacionesPorSede).map(([sede, habs]) => {
              const expanded = sedeExpandida === sede;
              return (
                <div key={sede} className="mb-2 border border-gray-200 rounded">
                  <button
                    onClick={() => setSedeExpandida(expanded ? null : sede)}
                    className="w-full p-2 flex items-center justify-between bg-gray-50 hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      <span className="text-xs font-bold text-gray-900">{sede}</span>
                    </div>
                    <span className="text-[10px] text-gray-500">{habs.length} doc(s)</span>
                  </button>

                  {expanded && (
                    <div className="p-2 space-y-2">
                      {habs.map(h => {
                        const estado = calcularEstadoHabilitacion(h);
                        const visual = ESTADO_VISUAL[estado];
                        const isEditing = editandoHab?.id === h.id;
                        return (
                          <div key={h.id} className="p-2 rounded border" style={{ borderColor: visual.border, backgroundColor: visual.bg }}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="text-base">{visual.icon}</span>
                                  <span className="text-xs font-bold text-gray-900">{h.documento_nombre}</span>
                                </div>
                                <div className="text-[10px] text-gray-500 mt-0.5">
                                  OT: <span className="font-mono font-semibold">{h.ot_codigo}</span>
                                </div>

                                {/* Fecha padre (si no tiene sub-docs) */}
                                {!h.sub_documentos?.length && h.fecha_vencimiento && (
                                  <div className="text-[10px] text-gray-600 mt-1 flex items-center gap-1">
                                    <Calendar size={10} /> Vence: {h.fecha_vencimiento.split("-").reverse().join("/")}
                                  </div>
                                )}

                                {/* Sub-documentos */}
                                {h.sub_documentos && h.sub_documentos.length > 0 && (
                                  <div className="mt-1 space-y-0.5">
                                    {h.sub_documentos.map(sub => {
                                      const subEstado = calcularEstadoFecha(sub.fecha_vencimiento);
                                      const subVisual = ESTADO_VISUAL[subEstado];
                                      return (
                                        <div key={sub.id} className="flex items-center gap-1 text-[10px] pl-2">
                                          <span>{subVisual.icon}</span>
                                          <span className="text-gray-700">{sub.nombre}</span>
                                          <span className="text-gray-400">·</span>
                                          <span className="text-gray-500">{sub.fecha_vencimiento.split("-").reverse().join("/")}</span>
                                          {sub.enlace_url && (
                                            <a href={sub.enlace_url} target="_blank" rel="noopener noreferrer" className="text-[#E91E63] hover:underline">
                                              <LinkIcon size={9} />
                                            </a>
                                          )}
                                          {modoAcceso === "editor" && (
                                            <>
                                              <button onClick={() => setEditandoSubDoc({ id: sub.id, sub })} className="text-blue-500 hover:text-blue-700">
                                                <Pencil size={9} />
                                              </button>
                                              <button onClick={() => onEliminarSubDoc(sub.id)} className="text-red-500 hover:text-red-700">
                                                <Trash2 size={9} />
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Enlace padre */}
                                {h.enlace_url && !h.sub_documentos?.length && (
                                  <a href={h.enlace_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#E91E63] hover:underline flex items-center gap-1 mt-1">
                                    <LinkIcon size={10} /> Ver documento
                                  </a>
                                )}
                              </div>

                              {modoAcceso === "editor" && (
                                <div className="flex flex-col gap-1">
                                  <button onClick={() => onEliminarHabilitacion(h.id)} className="text-red-500 hover:text-red-700 p-1" title="Eliminar">
                                    <Trash2 size={10} />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Botón añadir sub-doc */}
                            {modoAcceso === "editor" && agregandoSubDoc === h.id ? (
                              <div className="mt-2 p-2 bg-white rounded border border-gray-200 space-y-1">
                                <input type="text" placeholder="Nombre sub-doc" value={nuevoSubDoc.nombre} onChange={(e) => setNuevoSubDoc({...nuevoSubDoc, nombre: e.target.value})} className="w-full px-2 py-1 text-[10px] border border-gray-200 rounded" />
                                <input type="date" value={nuevoSubDoc.fecha_vencimiento} onChange={(e) => setNuevoSubDoc({...nuevoSubDoc, fecha_vencimiento: e.target.value})} className="w-full px-2 py-1 text-[10px] border border-gray-200 rounded" />
                                <input type="text" placeholder="Enlace URL (opcional)" value={nuevoSubDoc.enlace_url} onChange={(e) => setNuevoSubDoc({...nuevoSubDoc, enlace_url: e.target.value})} className="w-full px-2 py-1 text-[10px] border border-gray-200 rounded" />
                                <div className="flex gap-1">
                                  <button onClick={() => handleGuardarNuevoSubDoc(h.id)} className="flex-1 py-1 text-[10px] text-white bg-[#E91E63] rounded hover:bg-[#c2185b]">Guardar</button>
                                  <button onClick={() => { setAgregandoSubDoc(null); setNuevoSubDoc({ nombre: "", fecha_vencimiento: "", enlace_url: "", notas: "" }); }} className="px-2 py-1 text-[10px] text-gray-500 border border-gray-200 rounded">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              modoAcceso === "editor" && (
                                <button
                                  onClick={() => setAgregandoSubDoc(h.id)}
                                  className="mt-1 text-[10px] text-[#E91E63] hover:underline flex items-center gap-1"
                                >
                                  <Plus size={10} /> Añadir sub-documento
                                </button>
                              )
                            )}

                            {/* Editar sub-doc */}
                            {editandoSubDoc && editandoSubDoc.id && h.sub_documentos?.some(s => s.id === editandoSubDoc.id) && (
                              <div className="mt-2 p-2 bg-white rounded border border-blue-200 space-y-1">
                                <div className="text-[10px] font-bold text-blue-700">Editando sub-documento</div>
                                <input type="text" placeholder="Nombre" value={editandoSubDoc.sub.nombre} onChange={(e) => setEditandoSubDoc({ id: editandoSubDoc.id, sub: { ...editandoSubDoc.sub, nombre: e.target.value } })} className="w-full px-2 py-1 text-[10px] border border-gray-200 rounded" />
                                <input type="date" value={editandoSubDoc.sub.fecha_vencimiento} onChange={(e) => setEditandoSubDoc({ id: editandoSubDoc.id, sub: { ...editandoSubDoc.sub, fecha_vencimiento: e.target.value } })} className="w-full px-2 py-1 text-[10px] border border-gray-200 rounded" />
                                <input type="text" placeholder="Enlace URL" value={editandoSubDoc.sub.enlace_url || ""} onChange={(e) => setEditandoSubDoc({ id: editandoSubDoc.id, sub: { ...editandoSubDoc.sub, enlace_url: e.target.value } })} className="w-full px-2 py-1 text-[10px] border border-gray-200 rounded" />
                                <div className="flex gap-1">
                                  <button
                                    onClick={async () => {
                                      await onActualizarSubDoc(editandoSubDoc.id, editandoSubDoc.sub);
                                      setEditandoSubDoc(null);
                                    }}
                                    className="flex-1 py-1 text-[10px] text-white bg-[#E91E63] rounded hover:bg-[#c2185b]"
                                  >
                                    Guardar
                                  </button>
                                  <button onClick={() => setEditandoSubDoc(null)} className="px-2 py-1 text-[10px] text-gray-500 border border-gray-200 rounded">Cancel</button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Añadir nueva habilitación */}
          {modoAcceso === "editor" && agregandoHab ? (
            <div className="mt-3 p-2 bg-gray-50 rounded border border-gray-200 space-y-1">
              <div className="text-[10px] font-bold text-gray-700">Nueva habilitación</div>
              <select value={nuevaHab.ot_codigo} onChange={(e) => setNuevaHab({...nuevaHab, ot_codigo: e.target.value})} className="w-full px-2 py-1 text-[10px] border border-gray-200 rounded bg-white">
                <option value="">Selecciona OT...</option>
                {ots.map(o => <option key={o.codigo} value={o.codigo}>{o.codigo} - {o.cliente} ({o.sede})</option>)}
              </select>
              <input type="text" placeholder="Nombre documento (ej: EMO ANTAPACCAY)" value={nuevaHab.documento_nombre} onChange={(e) => setNuevaHab({...nuevaHab, documento_nombre: e.target.value})} className="w-full px-2 py-1 text-[10px] border border-gray-200 rounded" />
              <input type="date" value={nuevaHab.fecha_vencimiento} onChange={(e) => setNuevaHab({...nuevaHab, fecha_vencimiento: e.target.value})} className="w-full px-2 py-1 text-[10px] border border-gray-200 rounded" />
              <input type="text" placeholder="Enlace URL (opcional)" value={nuevaHab.enlace_url} onChange={(e) => setNuevaHab({...nuevaHab, enlace_url: e.target.value})} className="w-full px-2 py-1 text-[10px] border border-gray-200 rounded" />
              <div className="flex gap-1">
                <button onClick={handleGuardarNuevaHab} className="flex-1 py-1 text-[10px] text-white bg-[#E91E63] rounded hover:bg-[#c2185b]">Guardar</button>
                <button onClick={() => { setAgregandoHab(false); setNuevaHab({ ot_codigo: "", documento_nombre: "", fecha_vencimiento: "", enlace_url: "", notas: "" }); }} className="px-2 py-1 text-[10px] text-gray-500 border border-gray-200 rounded">Cancel</button>
              </div>
            </div>
          ) : (
            modoAcceso === "editor" && (
              <button
                onClick={() => setAgregandoHab(true)}
                className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 text-[10px] text-[#E91E63] border border-[#E91E63] rounded hover:bg-pink-50"
              >
                <Plus size={12} /> Añadir habilitación
              </button>
            )
          )}
        </div>
      </div>
    </aside>
  );
}

// =============================================================
// SUBCOMPONENTE: Modal crear/editar técnico
// =============================================================
function ModalTecnico({
  tecnico, siguienteId, onClose, onSave,
}: {
  tecnico: any | null;
  siguienteId: string;
  onClose: () => void;
  onSave: (data: { id: string; cargo: string; nombre: string; correo: string; codigo_sap: string; foto_url?: string }) => Promise<void>;
}) {
  const [id, setId] = useState(tecnico?.id || siguienteId);
  const [cargo, setCargo] = useState(tecnico?.cargo || "Técnico");
  const [nombre, setNombre] = useState(tecnico?.nombre || "");
  const [correo, setCorreo] = useState(tecnico?.correo || "");
  const [codigo_sap, setCodigoSap] = useState(tecnico?.codigo_sap || "");
  const [foto_url, setFotoUrl] = useState(tecnico?.foto_url || "");
  const [guardando, setGuardando] = useState(false);

  const handleSave = async () => {
    if (!nombre.trim()) {
      alert("Nombre es obligatorio");
      return;
    }
    setGuardando(true);
    await onSave({ id, cargo, nombre, correo, codigo_sap, foto_url });
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-[95%] max-w-md max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 flex items-center justify-between text-white" style={{ backgroundColor: "#1d1d1f" }}>
          <div className="text-sm font-bold">{tecnico ? "Editar técnico" : "Nuevo técnico"}</div>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">ID</label>
            <input type="text" value={id} onChange={(e) => setId(e.target.value)} disabled={!!tecnico} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded disabled:bg-gray-100" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Nombre *</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Cargo</label>
            <select value={cargo} onChange={(e) => setCargo(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded bg-white">
              <option value="Supervisor">Supervisor</option>
              <option value="Especialista">Especialista</option>
              <option value="Técnico">Técnico</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Correo</label>
            <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Código SAP</label>
            <input type="text" value={codigo_sap} onChange={(e) => setCodigoSap(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">URL Foto</label>
            <input type="text" value={foto_url} onChange={(e) => setFotoUrl(e.target.value)} placeholder="https://..." className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
          </div>
        </div>
        <div className="border-t border-gray-200 p-3 flex justify-end gap-2">
          <button onClick={onClose} disabled={guardando} className="px-3 py-1.5 text-xs border border-gray-200 rounded hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={guardando} className="flex items-center gap-1 px-3 py-1.5 text-xs text-white rounded bg-[#E91E63] hover:bg-[#c2185b] disabled:opacity-50">
            <Save size={14} /> {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
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

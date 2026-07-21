"use client";

import { useStore } from "@/lib/store";
import { useState, useMemo, useEffect } from "react";
import {
  Search, RefreshCw, ChevronDown, ChevronUp, Eye, EyeOff,
  AlertTriangle, CheckCircle, Clock, XCircle, FileText,
  Calendar, Link as LinkIcon, Pencil, Plus, Trash2, X, Save, Copy
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
    habilitaciones, cargarHabilitaciones, cargarDatosSilencioso,
    agregarHabilitacion, actualizarHabilitacion, eliminarHabilitacion,
    agregarSubDocumento, actualizarSubDocumento, eliminarSubDocumento,
    sincronizarHabilitacionesExcel, showToast,
  } = useStore();

  const [query, setQuery] = useState("");
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [sedeExpandida, setSedeExpandida] = useState<string | null>(null);
  const [actualizando, setActualizando] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<EstadoDocumento | null>(null);
  const [tecnicoSeleccionado, setTecnicoSeleccionado] = useState<string | null>(null);
  const [otExpandida, setOtExpandida] = useState<string | null>(null);
  const [agregandoHab, setAgregandoHab] = useState<{ tecnicoId: string; otCodigo: string } | null>(null);
  const [nuevaHab, setNuevaHab] = useState({
    documento_nombre: "",
    fecha_vencimiento: "",
    enlace_url: "",
    notas: "",
  });
  const [agregandoSubDoc, setAgregandoSubDoc] = useState<string | null>(null);
  const [nuevoSubDoc, setNuevoSubDoc] = useState({ nombre: "", fecha_vencimiento: "", enlace_url: "", notas: "" });
  const [editandoSubDoc, setEditandoSubDoc] = useState<{ id: string; sub: SubDocumento } | null>(null);

  // Cargar habilitaciones al montar
  useEffect(() => {
    cargarHabilitaciones();
  }, [cargarHabilitaciones]);

  // Mapa de OTs por código (para obtener sede)
  const otMap = useMemo(() => {
    const m: Record<string, any> = {};
    ots.forEach(o => { m[o.codigo] = o; });
    return m;
  }, [ots]);

  // Técnicos filtrados (sin vacíos, según filtro de inactivos y búsqueda)
  const tecnicosFiltrados = useMemo(() => {
    let result = tecnicos.filter(t => t.id && t.nombre && t.id.trim() !== "" && t.nombre.trim() !== "");
    if (!mostrarInactivos) {
      result = result.filter(t => t.activo);
    }
    return result;
  }, [tecnicos, mostrarInactivos]);

  // Habilitaciones por técnico (mapa: tecnico_id → Habilitacion[])
  const habilitacionesPorTecnico = useMemo(() => {
    const m: Record<string, Habilitacion[]> = {};
    for (const h of habilitaciones) {
      if (!m[h.tecnico_id]) m[h.tecnico_id] = [];
      m[h.tecnico_id].push(h);
    }
    return m;
  }, [habilitaciones]);

  // Calcular estado general por técnico
  const estadoGeneralPorTecnico = (tecId: string): EstadoDocumento | null => {
    const habs = habilitacionesPorTecnico[tecId] || [];
    if (habs.length === 0) return null;
    const estados = habs.map(h => calcularEstadoHabilitacion(h));
    const prioridad: Record<EstadoDocumento, number> = {
      vencido: 4, en_riesgo: 3, por_vencer: 2, habilitado: 1,
    };
    return estados.reduce((worst, curr) =>
      prioridad[curr] > prioridad[worst] ? curr : worst
    );
  };

  // Aplicar búsqueda + filtro de estado
  const tecnicosFinales = useMemo(() => {
    let result = tecnicosFiltrados;
    if (filtroEstado) {
      result = result.filter(t => estadoGeneralPorTecnico(t.id) === filtroEstado);
    }
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(t => {
        // Buscar por técnico
        const matchTecnico = t.id.toLowerCase().includes(q) ||
          t.nombre.toLowerCase().includes(q) ||
          t.cargo.toLowerCase().includes(q);
        if (matchTecnico) return true;
        // Buscar por OT
        const matchOT = ots.some(o => o.codigo.toLowerCase().includes(q) || o.cliente.toLowerCase().includes(q));
        if (matchOT) {
          // Solo incluir si el técnico tiene habilitación en esa OT
          const habsTec = habilitacionesPorTecnico[t.id] || [];
          return habsTec.some(h => {
            const ot = otMap[h.ot_codigo];
            return ot && (ot.codigo.toLowerCase().includes(q) || ot.cliente.toLowerCase().includes(q));
          });
        }
        return false;
      });
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tecnicosFiltrados, filtroEstado, query, habilitaciones]);

  // Resumen general (suma de todos los documentos de todos los técnicos)
  const resumenGeneral = useMemo(() => {
    const conteo: Record<EstadoDocumento, string[]> = {
      habilitado: [], por_vencer: [], en_riesgo: [], vencido: [],
    };
    for (const t of tecnicosFiltrados) {
      const estado = estadoGeneralPorTecnico(t.id);
      if (estado) {
        conteo[estado].push(t.nombre);
      }
    }
    return conteo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tecnicosFiltrados, habilitaciones]);

  // Agrupar OTs por sede
  const otsPorSede = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const o of ots) {
      const sede = o.sede || "(sin sede)";
      if (!m[sede]) m[sede] = [];
      m[sede].push(o);
    }
    return m;
  }, [ots]);

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

  const getEstadoVisual = (estado: EstadoDocumento) => ESTADO_VISUAL[estado];

  // Estado de una habilitación específica
  const getEstadoHab = (h: Habilitacion): EstadoDocumento => calcularEstadoHabilitacion(h);

  return (
    <div className="p-6 max-w-[1600px] mx-auto overflow-y-auto h-full">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            Habilitaciones
          </h2>
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

      {/* Resumen general con tarjetas clickeables */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {(["habilitado", "por_vencer", "en_riesgo", "vencido"] as EstadoDocumento[]).map(estado => {
          const nombres = resumenGeneral[estado];
          const visual = getEstadoVisual(estado);
          const isActive = filtroEstado === estado;
          return (
            <button
              key={estado}
              onClick={() => setFiltroEstado(isActive ? null : estado)}
              className={`relative p-3 rounded-lg border-2 text-left transition-all hover:shadow-md ${isActive ? "ring-2 ring-offset-1" : ""}`}
              style={{
                backgroundColor: visual.bg,
                borderColor: visual.border,
                ...(isActive ? { boxShadow: `0 0 0 2px ${visual.border}` } : {})
              }}
              title={nombres.length > 0 ? `Técnicos en ${visual.label.toLowerCase()}: ${nombres.join(", ")}` : "Sin técnicos en este estado"}
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
            placeholder="Buscar por técnico, OT, cliente o sede..."
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
            Quitar filtro de estado
          </button>
        )}
      </div>

      {/* Tabla cruzada: filas = técnicos, agrupada por sede con OTs desplegables */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 w-12 sticky left-0 bg-gray-50 z-10">Foto</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 sticky left-12 bg-gray-50 z-10 min-w-[180px]">Técnico</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Habilitaciones por Sede / OT</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-600 w-20">Resumen</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-600 w-32">Estado Gral.</th>
              </tr>
            </thead>
            <tbody>
              {tecnicosFinales.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-4 text-gray-400">No hay técnicos que coincidan</td></tr>
              ) : (
                tecnicosFinales.map((t) => {
                  const habsTec = habilitacionesPorTecnico[t.id] || [];
                  const estadoGral = estadoGeneralPorTecnico(t.id);
                  const visualGral = estadoGral ? getEstadoVisual(estadoGral) : null;

                  // Conteo por estado
                  const conteo: Record<EstadoDocumento, number> = {
                    habilitado: 0, por_vencer: 0, en_riesgo: 0, vencido: 0,
                  };
                  for (const h of habsTec) {
                    conteo[getEstadoHab(h)]++;
                  }

                  // Agrupar por sede
                  const habsPorSede: Record<string, Habilitacion[]> = {};
                  for (const h of habsTec) {
                    const sede = h.sede_nombre || "(sin sede)";
                    if (!habsPorSede[sede]) habsPorSede[sede] = [];
                    habsPorSede[sede].push(h);
                  }

                  const isSelected = tecnicoSeleccionado === t.id;
                  return (
                    <tr
                      key={t.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${isSelected ? "bg-pink-50" : ""} ${!t.activo ? "opacity-50" : ""}`}
                    >
                      <td className="px-3 py-2 sticky left-0 bg-white z-10">
                        <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-200 shrink-0">
                          {t.foto_url ? (
                            <img src={t.foto_url} alt={t.nombre} className="w-full h-full object-cover" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-500">{getIniciales(t.nombre)}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 sticky left-12 bg-white z-10">
                        <div className="font-semibold text-gray-900">{t.nombre}</div>
                        <div className="text-[10px] text-gray-500">{t.cargo}</div>
                        <div className="text-[10px] text-gray-400">{t.id}</div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        {habsTec.length === 0 ? (
                          <div className="text-[10px] text-gray-400 italic">Sin habilitaciones</div>
                        ) : (
                          <div className="space-y-1">
                            {Object.entries(habsPorSede).map(([sede, habs]) => {
                              const sedeKey = `${t.id}|${sede}`;
                              const sedeExpanded = sedeExpandida === sedeKey;
                              return (
                                <div key={sede} className="border border-gray-200 rounded">
                                  <button
                                    onClick={() => setSedeExpandida(sedeExpanded ? null : sedeKey)}
                                    className="w-full p-1.5 flex items-center justify-between bg-gray-50 hover:bg-gray-100 text-left"
                                  >
                                    <div className="flex items-center gap-1">
                                      {sedeExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                      <span className="text-[11px] font-bold text-gray-900">{sede}</span>
                                    </div>
                                    <span className="text-[9px] text-gray-500">{habs.length} doc(s)</span>
                                  </button>
                                  {sedeExpanded && (
                                    <div className="p-1.5 space-y-1">
                                      {/* Agrupar por OT dentro de la sede */}
                                      {Object.entries(
                                        habs.reduce((acc, h) => {
                                          if (!acc[h.ot_codigo]) acc[h.ot_codigo] = [];
                                          acc[h.ot_codigo].push(h);
                                          return acc;
                                        }, {} as Record<string, Habilitacion[]>)
                                      ).map(([otCodigo, habsOt]) => {
                                        const otKey = `${t.id}|${sede}|${otCodigo}`;
                                        const otExpanded = otExpandida === otKey;
                                        const ot = otMap[otCodigo];
                                        return (
                                          <div key={otCodigo} className="border border-gray-100 rounded">
                                            <button
                                              onClick={() => setOtExpandida(otExpanded ? null : otKey)}
                                              className="w-full p-1 flex items-center justify-between bg-white hover:bg-gray-50 text-left"
                                            >
                                              <div className="flex items-center gap-1">
                                                {otExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                                <span className="text-[10px] font-mono font-semibold text-gray-900">{otCodigo}</span>
                                                {ot && <span className="text-[9px] text-gray-500">· {ot.cliente}</span>}
                                              </div>
                                              <span className="text-[9px] text-gray-500">{habsOt.length} doc(s)</span>
                                            </button>
                                            {otExpanded && (
                                              <div className="p-1.5 space-y-1 bg-pink-50/30">
                                                {habsOt.map(h => {
                                                  const estado = getEstadoHab(h);
                                                  const visual = getEstadoVisual(estado);
                                                  return (
                                                    <div key={h.id} className="p-1.5 rounded border" style={{ borderColor: visual.border, backgroundColor: visual.bg }}>
                                                      <div className="flex items-center justify-between gap-1">
                                                        <div className="flex-1 min-w-0">
                                                          <div className="flex items-center gap-1">
                                                            <span>{visual.icon}</span>
                                                            <span className="text-[10px] font-bold text-gray-900">{h.documento_nombre}</span>
                                                          </div>
                                                          {!h.sub_documentos?.length && h.fecha_vencimiento && (
                                                            <div className="text-[9px] text-gray-600 mt-0.5 flex items-center gap-1">
                                                              <Calendar size={8} /> Vence: {h.fecha_vencimiento.split("-").reverse().join("/")}
                                                            </div>
                                                          )}
                                                          {h.sub_documentos && h.sub_documentos.length > 0 && (
                                                            <div className="mt-0.5 space-y-0.5">
                                                              {h.sub_documentos.map(sub => {
                                                                const subEstado = calcularEstadoFecha(sub.fecha_vencimiento);
                                                                const subVisual = getEstadoVisual(subEstado);
                                                                return (
                                                                  <div key={sub.id} className="flex items-center gap-1 text-[9px] pl-1">
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
                                                                        <button onClick={() => setEditandoSubDoc({ id: sub.id, sub })} className="text-blue-500 hover:text-blue-700">
                                                                          <Pencil size={8} />
                                                                        </button>
                                                                        <button onClick={async () => await eliminarSubDocumento(sub.id)} className="text-red-500 hover:text-red-700">
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
                                                            <button onClick={() => setAgregandoSubDoc(h.id)} className="text-[#E91E63] hover:text-[#c2185b] p-0.5" title="Añadir sub-doc">
                                                              <Plus size={10} />
                                                            </button>
                                                            <button onClick={async () => await eliminarHabilitacion(h.id)} className="text-red-500 hover:text-red-700 p-0.5" title="Eliminar">
                                                              <Trash2 size={10} />
                                                            </button>
                                                          </div>
                                                        )}
                                                      </div>

                                                      {/* Agregar sub-doc */}
                                                      {modoAcceso === "editor" && agregandoSubDoc === h.id && (
                                                        <div className="mt-1 p-1 bg-white rounded border border-gray-200 space-y-1">
                                                          <input type="text" placeholder="Nombre" value={nuevoSubDoc.nombre} onChange={(e) => setNuevoSubDoc({...nuevoSubDoc, nombre: e.target.value})} className="w-full px-1 py-0.5 text-[9px] border border-gray-200 rounded" />
                                                          <input type="date" value={nuevoSubDoc.fecha_vencimiento} onChange={(e) => setNuevoSubDoc({...nuevoSubDoc, fecha_vencimiento: e.target.value})} className="w-full px-1 py-0.5 text-[9px] border border-gray-200 rounded" />
                                                          <input type="text" placeholder="Enlace URL" value={nuevoSubDoc.enlace_url} onChange={(e) => setNuevoSubDoc({...nuevoSubDoc, enlace_url: e.target.value})} className="w-full px-1 py-0.5 text-[9px] border border-gray-200 rounded" />
                                                          <div className="flex gap-1">
                                                            <button onClick={() => handleGuardarNuevoSubDoc(h.id)} className="flex-1 py-0.5 text-[9px] text-white bg-[#E91E63] rounded">Guardar</button>
                                                            <button onClick={() => { setAgregandoSubDoc(null); setNuevoSubDoc({ nombre: "", fecha_vencimiento: "", enlace_url: "", notas: "" }); }} className="px-1 py-0.5 text-[9px] text-gray-500 border border-gray-200 rounded">X</button>
                                                          </div>
                                                        </div>
                                                      )}

                                                      {/* Editar sub-doc */}
                                                      {editandoSubDoc && h.sub_documentos?.some(s => s.id === editandoSubDoc.id) && (
                                                        <div className="mt-1 p-1 bg-white rounded border border-blue-200 space-y-1">
                                                          <div className="text-[9px] font-bold text-blue-700">Editando sub-documento</div>
                                                          <input type="text" value={editandoSubDoc.sub.nombre} onChange={(e) => setEditandoSubDoc({ id: editandoSubDoc.id, sub: { ...editandoSubDoc.sub, nombre: e.target.value } })} className="w-full px-1 py-0.5 text-[9px] border border-gray-200 rounded" />
                                                          <input type="date" value={editandoSubDoc.sub.fecha_vencimiento} onChange={(e) => setEditandoSubDoc({ id: editandoSubDoc.id, sub: { ...editandoSubDoc.sub, fecha_vencimiento: e.target.value } })} className="w-full px-1 py-0.5 text-[9px] border border-gray-200 rounded" />
                                                          <input type="text" placeholder="URL" value={editandoSubDoc.sub.enlace_url || ""} onChange={(e) => setEditandoSubDoc({ id: editandoSubDoc.id, sub: { ...editandoSubDoc.sub, enlace_url: e.target.value } })} className="w-full px-1 py-0.5 text-[9px] border border-gray-200 rounded" />
                                                          <div className="flex gap-1">
                                                            <button onClick={async () => { await actualizarSubDocumento(editandoSubDoc.id, editandoSubDoc.sub); setEditandoSubDoc(null); }} className="flex-1 py-0.5 text-[9px] text-white bg-[#E91E63] rounded">Guardar</button>
                                                            <button onClick={() => setEditandoSubDoc(null)} className="px-1 py-0.5 text-[9px] text-gray-500 border border-gray-200 rounded">X</button>
                                                          </div>
                                                        </div>
                                                      )}
                                                    </div>
                                                  );
                                                })}

                                                {/* Agregar nueva habilitación a esta OT */}
                                                {modoAcceso === "editor" && agregandoHab?.tecnicoId === t.id && agregandoHab?.otCodigo === otCodigo ? (
                                                  <div className="p-1.5 bg-gray-50 rounded border border-gray-200 space-y-1">
                                                    <div className="text-[9px] font-bold text-gray-700">Nueva habilitación</div>
                                                    <input type="text" placeholder="Nombre (ej: EMO, Curso Alturas)" value={nuevaHab.documento_nombre} onChange={(e) => setNuevaHab({...nuevaHab, documento_nombre: e.target.value})} className="w-full px-1 py-0.5 text-[9px] border border-gray-200 rounded" />
                                                    <input type="date" value={nuevaHab.fecha_vencimiento} onChange={(e) => setNuevaHab({...nuevaHab, fecha_vencimiento: e.target.value})} className="w-full px-1 py-0.5 text-[9px] border border-gray-200 rounded" />
                                                    <input type="text" placeholder="Enlace URL" value={nuevaHab.enlace_url} onChange={(e) => setNuevaHab({...nuevaHab, enlace_url: e.target.value})} className="w-full px-1 py-0.5 text-[9px] border border-gray-200 rounded" />
                                                    <div className="flex gap-1">
                                                      <button onClick={() => handleGuardarNuevaHab(t.id, otCodigo)} className="flex-1 py-0.5 text-[9px] text-white bg-[#E91E63] rounded">Guardar</button>
                                                      <button onClick={() => { setAgregandoHab(null); setNuevaHab({ documento_nombre: "", fecha_vencimiento: "", enlace_url: "", notas: "" }); }} className="px-1 py-0.5 text-[9px] text-gray-500 border border-gray-200 rounded">X</button>
                                                    </div>
                                                  </div>
                                                ) : (
                                                  modoAcceso === "editor" && (
                                                    <button
                                                      onClick={() => setAgregandoHab({ tecnicoId: t.id, otCodigo })}
                                                      className="text-[9px] text-[#E91E63] hover:underline flex items-center gap-0.5 mt-1"
                                                    >
                                                      <Plus size={9} /> Añadir habilitación
                                                    </button>
                                                  )
                                                )}
                                              </div>
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
                      </td>
                      <td className="px-3 py-2 text-center">
                        {habsTec.length > 0 ? (
                          <div className="flex flex-col items-center gap-0.5 text-[10px]">
                            <div className="flex gap-1.5">
                              <span title="Habilitados">🟢 {conteo.habilitado}</span>
                              <span title="Por vencer">🟡 {conteo.por_vencer}</span>
                            </div>
                            <div className="flex gap-1.5">
                              <span title="En riesgo">🔴 {conteo.en_riesgo}</span>
                              <span title="Vencidos">⚫ {conteo.vencido}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {visualGral ? (
                          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full" style={{ backgroundColor: visualGral.bg, border: `1px solid ${visualGral.border}` }}>
                            <span className="text-base">{visualGral.icon}</span>
                            <span className="text-[10px] font-semibold" style={{ color: visualGral.color }}>
                              {visualGral.label}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-[10px]">Sin datos</span>
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
  );
}

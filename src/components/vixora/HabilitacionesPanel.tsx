"use client";

import { useStore } from "@/lib/store";
import { useState, useMemo, useEffect } from "react";
import {
  Search, RefreshCw, ChevronDown, ChevronUp,
  Link as LinkIcon, Pencil, Plus, Trash2, X, Save, Copy,
  Eye, EyeOff, ChevronsDown, ChevronsUp, Layers, Wand2,
} from "lucide-react";
import {
  calcularEstadoHabilitacion, calcularEstadoFecha, ESTADO_VISUAL,
  type EstadoDocumento, type Habilitacion, type SubDocumento, type PresetDocumento,
} from "@/lib/types";

interface Props {
  tecnicos: any[];
  ots: any[];
  modoAcceso: "lector" | "editor";
}

export function HabilitacionesPanel({ tecnicos, ots, modoAcceso }: Props) {
  const {
    habilitaciones, sedes, cargarHabilitaciones, cargarPresets, presets,
    agregarHabilitacion, actualizarHabilitacion, eliminarHabilitacion,
    agregarSubDocumento, actualizarSubDocumento, eliminarSubDocumento,
    toggleContabilizarHabilitacion,
    sincronizarHabilitacionesExcel,
    agregarPresetSede, eliminarPresetSede,
    agregarPresetDocumento, eliminarPresetDocumento,
    agregarPresetSubDoc, eliminarPresetSubDoc,
    aplicarPresetATecnico,
    showToast,
  } = useStore();

  const [query, setQuery] = useState("");
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [tecnicoSeleccionadoId, setTecnicoSeleccionadoId] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sedesExpandidasPorTecnico, setSedesExpandidasPorTecnico] = useState<Record<string, boolean>>({});
  const [expandirTodas, setExpandirTodas] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<EstadoDocumento | null>(null);
  const [replicandoSetup, setReplicandoSetup] = useState<any | null>(null);
  const [aplicandoPreset, setAplicandoPreset] = useState<any | null>(null);

  // Estado para gestión de presets (al final de la página)
  const [presetExpandido, setPresetExpandido] = useState<string | null>(null);
  const [nuevoPresetSede, setNuevoPresetSede] = useState("");
  const [nuevoDocPreset, setNuevoDocPreset] = useState<{ presetSedeId: string; nombre: string; fecha: string; enlace: string }>({ presetSedeId: "", nombre: "", fecha: "", enlace: "" });
  const [nuevoSubDocPreset, setNuevoSubDocPreset] = useState<{ presetDocId: string; nombre: string; fecha: string }>({ presetDocId: "", nombre: "", fecha: "" });

  useEffect(() => {
    cargarHabilitaciones();
    cargarPresets();
  }, [cargarHabilitaciones, cargarPresets]);

  const habilitacionesPorTecnico = useMemo(() => {
    const m: Record<string, Habilitacion[]> = {};
    for (const h of habilitaciones) {
      if (!m[h.tecnico_id]) m[h.tecnico_id] = [];
      m[h.tecnico_id].push(h);
    }
    return m;
  }, [habilitaciones]);

  const tecnicosFiltrados = useMemo(() => {
    let result = tecnicos.filter(t => t.id && t.nombre && t.id.trim() !== "" && t.nombre.trim() !== "");
    if (!mostrarInactivos) {
      result = result.filter(t => t.activo);
    }
    return result;
  }, [tecnicos, mostrarInactivos]);

  const resumenGeneral = useMemo(() => {
    const conteo: Record<EstadoDocumento, Array<{ tecnico: string; documento: string; sede: string }>> = {
      habilitado: [], por_vencer: [], en_riesgo: [], vencido: [],
    };
    for (const t of tecnicosFiltrados) {
      const habsTec = habilitacionesPorTecnico[t.id] || [];
      for (const h of habsTec) {
        if (h.contabilizar === false) continue;
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

  const tecnicosFinales = useMemo(() => {
    let result = tecnicosFiltrados;
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(t => {
        const matchTecnico = t.id.toLowerCase().includes(q) ||
          t.nombre.toLowerCase().includes(q) ||
          t.cargo.toLowerCase().includes(q);
        if (matchTecnico) return true;
        const habsTec = habilitacionesPorTecnico[t.id] || [];
        return habsTec.some(h =>
          h.ot_codigo?.toLowerCase().includes(q) ||
          h.sede_nombre.toLowerCase().includes(q) ||
          h.documento_nombre.toLowerCase().includes(q)
        );
      });
    }
    return result;
  }, [tecnicosFiltrados, query, habilitacionesPorTecnico]);

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

  const handleActualizarExcel = async () => {
    setActualizando(true);
    await sincronizarHabilitacionesExcel();
    setActualizando(false);
  };

  const handleToggleExpandirTodas = () => {
    if (expandirTodas) {
      setExpandirTodas(false);
      setSedesExpandidasPorTecnico({});
    } else {
      setExpandirTodas(true);
      const nuevas: Record<string, boolean> = {};
      tecnicosConFiltro.forEach(t => { nuevas[t.id] = true; });
      setSedesExpandidasPorTecnico(nuevas);
    }
  };

  const handleToggleSedesTecnico = (tecId: string) => {
    setSedesExpandidasPorTecnico(prev => ({ ...prev, [tecId]: !prev[tecId] }));
  };

  const getIniciales = (nombre: string) => {
    const partes = nombre.trim().split(/\s+/);
    return partes.length >= 2 ? (partes[0][0] + partes[1][0]).toUpperCase() : nombre.substring(0, 2).toUpperCase();
  };

  const calcularResumenTecnico = (tecId: string) => {
    const habsTec = habilitacionesPorTecnico[tecId] || [];
    const c: Record<EstadoDocumento, number> = { habilitado: 0, por_vencer: 0, en_riesgo: 0, vencido: 0 };
    for (const h of habsTec) {
      if (h.contabilizar === false) continue;
      c[calcularEstadoHabilitacion(h)]++;
    }
    return c;
  };

  const calcularResumenSede = (habs: Habilitacion[]) => {
    const c: Record<EstadoDocumento, number> = { habilitado: 0, por_vencer: 0, en_riesgo: 0, vencido: 0 };
    for (const h of habs) {
      if (h.contabilizar === false) continue;
      c[calcularEstadoHabilitacion(h)]++;
    }
    return c;
  };

  const tecnicoSeleccionado = tecnicoSeleccionadoId
    ? tecnicos.find(t => t.id === tecnicoSeleccionadoId)
    : null;
  const habilitacionesTecnicoSel = tecnicoSeleccionadoId
    ? habilitacionesPorTecnico[tecnicoSeleccionadoId] || []
    : [];

  return (
    <div className="flex h-full overflow-hidden">
      <div className={`flex-1 overflow-auto ${sidebarVisible && tecnicoSeleccionado ? "max-w-[calc(100%-400px)]" : ""}`}>
        <div className="p-6 max-w-[1600px] mx-auto">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Habilitaciones</h2>
              <p className="text-sm text-gray-500">
                Gestión de documentos por técnico y sede · {habilitaciones.length} habilitaciones registradas
              </p>
            </div>
            {modoAcceso === "editor" && (
              <div className="flex gap-2">
                <button
                  onClick={handleToggleExpandirTodas}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                >
                  {expandirTodas ? <ChevronsUp size={14} /> : <ChevronsDown size={14} />}
                  {expandirTodas ? "Contraer todas" : "Expandir todas"}
                </button>
                <button
                  onClick={handleActualizarExcel}
                  disabled={actualizando}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-[#E91E63] border border-[#E91E63] rounded hover:bg-pink-50 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={actualizando ? "animate-spin" : ""} />
                  {actualizando ? "Sincronizando..." : "Actualizar Excel"}
                </button>
              </div>
            )}
          </div>

          {/* Resumen general */}
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
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 min-w-[400px]">Habilitaciones por Sede</th>
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
                      const habsPorSede: Record<string, Habilitacion[]> = {};
                      for (const h of habsTec) {
                        const sede = h.sede_nombre || "(sin sede)";
                        if (!habsPorSede[sede]) habsPorSede[sede] = [];
                        habsPorSede[sede].push(h);
                      }
                      const resumenGral = calcularResumenTecnico(t.id);
                      const expandido = !!sedesExpandidasPorTecnico[t.id];

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
                                <button
                                  onClick={() => handleToggleSedesTecnico(t.id)}
                                  className="w-full p-2 rounded border-2 border-gray-300 bg-gray-50 hover:bg-gray-100 flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-bold text-gray-700 uppercase">Resumen General</span>
                                    <div className="flex gap-2 text-[10px] ml-2">
                                      <span title="Habilitados">🟢 {resumenGral.habilitado}</span>
                                      <span title="Por vencer">🟡 {resumenGral.por_vencer}</span>
                                      <span title="En riesgo">🔴 {resumenGral.en_riesgo}</span>
                                      <span title="Vencidos">⚫ {resumenGral.vencido}</span>
                                    </div>
                                  </div>
                                  {expandido ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                                </button>

                                {expandido && (
                                  <div className="space-y-1 mt-1 pl-2">
                                    {Object.entries(habsPorSede).map(([sede, habs]) => {
                                      const resumen = calcularResumenSede(habs);
                                      return (
                                        <div key={sede} className="p-1.5 rounded border border-gray-200 bg-white flex items-center justify-between">
                                          <span className="text-[11px] font-bold text-gray-900">{sede}</span>
                                          <div className="flex gap-2 text-[10px]">
                                            <span title="Habilitados">🟢 {resumen.habilitado}</span>
                                            <span title="Por vencer">🟡 {resumen.por_vencer}</span>
                                            <span title="En riesgo">🔴 {resumen.en_riesgo}</span>
                                            <span title="Vencidos">⚫ {resumen.vencido}</span>
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
                                onClick={() => setAplicandoPreset(t)}
                                className="p-1 rounded text-purple-600 hover:bg-purple-100"
                                title="Aplicar preset de sede"
                              >
                                <Wand2 size={14} />
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

          {/* ===== SECCIÓN PRESETS DE SEDES ===== */}
          {modoAcceso === "editor" && (
            <div className="mt-6 bg-white border-2 border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-purple-600" />
                  <h3 className="text-sm font-bold text-gray-900">Presets de Sedes (Plantillas)</h3>
                </div>
                <p className="text-[10px] text-gray-500">Crea plantillas por sede y aplícalas a los técnicos</p>
              </div>

              {/* Crear nuevo preset */}
              <div className="flex gap-2 mb-3">
                <select
                  value={nuevoPresetSede}
                  onChange={(e) => setNuevoPresetSede(e.target.value)}
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded bg-white"
                >
                  <option value="">Selecciona sede para crear preset...</option>
                  {sedes.map(s => <option key={s.nombre} value={s.nombre}>{s.nombre}</option>)}
                </select>
                <button
                  onClick={async () => {
                    if (!nuevoPresetSede) { showToast("Selecciona una sede", "error"); return; }
                    await agregarPresetSede(nuevoPresetSede);
                    setNuevoPresetSede("");
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-purple-600 rounded hover:bg-purple-700"
                >
                  <Plus size={12} /> Crear preset
                </button>
              </div>

              {/* Lista de presets existentes */}
              {presets.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-400 italic">
                  No hay presets creados. Crea uno seleccionando una sede arriba.
                </div>
              ) : (
                <div className="space-y-2">
                  {presets.map(preset => {
                    const expanded = presetExpandido === preset.id;
                    return (
                      <div key={preset.id} className="border border-gray-200 rounded">
                        <div className="flex items-center justify-between p-2 bg-purple-50">
                          <button
                            onClick={() => setPresetExpandido(expanded ? null : preset.id)}
                            className="flex items-center gap-2 flex-1"
                          >
                            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            <span className="text-xs font-bold text-gray-900">{preset.sede_nombre}</span>
                            <span className="text-[10px] text-gray-500">{preset.documentos.length} documento(s)</span>
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`¿Eliminar preset de ${preset.sede_nombre}?`)) {
                                eliminarPresetSede(preset.id);
                              }
                            }}
                            className="p-1 rounded text-red-600 hover:bg-red-100"
                            title="Eliminar preset"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        {expanded && (
                          <div className="p-2 space-y-1">
                            {preset.documentos.length === 0 ? (
                              <div className="text-[10px] text-gray-400 italic">Sin documentos. Añade uno abajo.</div>
                            ) : (
                              preset.documentos.map(doc => (
                                <div key={doc.id} className="p-1.5 border border-gray-100 rounded bg-white">
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="text-[11px] font-bold text-gray-900">{doc.nombre}</div>
                                      {doc.fecha_vencimiento && (
                                        <div className="text-[9px] text-gray-500">Vence: {doc.fecha_vencimiento.split("-").reverse().join("/")}</div>
                                      )}
                                      {doc.enlace_url && (
                                        <a href={doc.enlace_url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-[#E91E63] hover:underline flex items-center gap-1">
                                          <LinkIcon size={8} /> Ver
                                        </a>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => {
                                        if (confirm(`¿Eliminar documento ${doc.nombre} del preset?`)) {
                                          eliminarPresetDocumento(doc.id);
                                        }
                                      }}
                                      className="p-1 rounded text-red-500 hover:bg-red-50"
                                    >
                                      <Trash2 size={10} />
                                    </button>
                                  </div>
                                  {/* Sub-documentos */}
                                  {doc.sub_documentos && doc.sub_documentos.length > 0 && (
                                    <div className="mt-1 space-y-0.5 pl-2">
                                      {doc.sub_documentos.map(sub => (
                                        <div key={sub.id} className="flex items-center gap-1 text-[9px]">
                                          <span>•</span>
                                          <span className="text-gray-700">{sub.nombre}</span>
                                          {sub.fecha_vencimiento && <span className="text-gray-400">· {sub.fecha_vencimiento.split("-").reverse().join("/")}</span>}
                                          <button
                                            onClick={() => eliminarPresetSubDoc(sub.id)}
                                            className="text-red-500 hover:text-red-700 ml-1"
                                          >
                                            <Trash2 size={8} />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {/* Añadir sub-doc */}
                                  <div className="mt-1 flex gap-1">
                                    <input
                                      type="text"
                                      placeholder="Nombre sub-doc"
                                      value={nuevoSubDocPreset.presetDocId === doc.id ? nuevoSubDocPreset.nombre : ""}
                                      onChange={(e) => setNuevoSubDocPreset({ presetDocId: doc.id, nombre: e.target.value, fecha: nuevoSubDocPreset.presetDocId === doc.id ? nuevoSubDocPreset.fecha : "" })}
                                      className="flex-1 px-1 py-0.5 text-[9px] border border-gray-200 rounded"
                                    />
                                    <input
                                      type="date"
                                      value={nuevoSubDocPreset.presetDocId === doc.id ? nuevoSubDocPreset.fecha : ""}
                                      onChange={(e) => setNuevoSubDocPreset({ presetDocId: doc.id, nombre: nuevoSubDocPreset.presetDocId === doc.id ? nuevoSubDocPreset.nombre : "", fecha: e.target.value })}
                                      className="w-32 px-1 py-0.5 text-[9px] border border-gray-200 rounded"
                                    />
                                    <button
                                      onClick={async () => {
                                        if (!nuevoSubDocPreset.nombre || !nuevoSubDocPreset.fecha) {
                                          showToast("Nombre y fecha obligatorios", "error");
                                          return;
                                        }
                                        await agregarPresetSubDoc(doc.id, {
                                          nombre: nuevoSubDocPreset.nombre,
                                          fecha_vencimiento: nuevoSubDocPreset.fecha,
                                        });
                                        setNuevoSubDocPreset({ presetDocId: "", nombre: "", fecha: "" });
                                      }}
                                      className="px-2 py-0.5 text-[9px] text-white bg-purple-600 rounded hover:bg-purple-700"
                                    >
                                      + Sub
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}

                            {/* Añadir documento */}
                            <div className="mt-2 p-2 bg-gray-50 rounded space-y-1">
                              <div className="text-[9px] font-bold text-gray-700">Añadir documento al preset</div>
                              <input
                                type="text"
                                placeholder="Nombre documento (ej: EMO, Curso Alturas)"
                                value={nuevoDocPreset.presetSedeId === preset.id ? nuevoDocPreset.nombre : ""}
                                onChange={(e) => setNuevoDocPreset({ presetSedeId: preset.id, nombre: e.target.value, fecha: nuevoDocPreset.presetSedeId === preset.id ? nuevoDocPreset.fecha : "", enlace: nuevoDocPreset.presetSedeId === preset.id ? nuevoDocPreset.enlace : "" })}
                                className="w-full px-1 py-1 text-[10px] border border-gray-200 rounded"
                              />
                              <div className="flex gap-1">
                                <input
                                  type="date"
                                  value={nuevoDocPreset.presetSedeId === preset.id ? nuevoDocPreset.fecha : ""}
                                  onChange={(e) => setNuevoDocPreset({ presetSedeId: preset.id, nombre: nuevoDocPreset.presetSedeId === preset.id ? nuevoDocPreset.nombre : "", fecha: e.target.value, enlace: nuevoDocPreset.presetSedeId === preset.id ? nuevoDocPreset.enlace : "" })}
                                  className="flex-1 px-1 py-1 text-[10px] border border-gray-200 rounded"
                                />
                                <input
                                  type="text"
                                  placeholder="URL (opcional)"
                                  value={nuevoDocPreset.presetSedeId === preset.id ? nuevoDocPreset.enlace : ""}
                                  onChange={(e) => setNuevoDocPreset({ presetSedeId: preset.id, nombre: nuevoDocPreset.presetSedeId === preset.id ? nuevoDocPreset.nombre : "", fecha: nuevoDocPreset.presetSedeId === preset.id ? nuevoDocPreset.fecha : "", enlace: e.target.value })}
                                  className="flex-1 px-1 py-1 text-[10px] border border-gray-200 rounded"
                                />
                              </div>
                              <button
                                onClick={async () => {
                                  if (!nuevoDocPreset.nombre) { showToast("Nombre obligatorio", "error"); return; }
                                  await agregarPresetDocumento(preset.id, {
                                    nombre: nuevoDocPreset.nombre,
                                    fecha_vencimiento: nuevoDocPreset.fecha || undefined,
                                    enlace_url: nuevoDocPreset.enlace || undefined,
                                  });
                                  setNuevoDocPreset({ presetSedeId: "", nombre: "", fecha: "", enlace: "" });
                                }}
                                className="w-full py-1 text-[10px] text-white bg-purple-600 rounded hover:bg-purple-700 flex items-center justify-center gap-1"
                              >
                                <Plus size={10} /> Añadir documento
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar derecho del técnico */}
      {tecnicoSeleccionado && sidebarVisible && (
        <SidebarTecnicoHabilitaciones
          tecnico={tecnicoSeleccionado}
          habilitaciones={habilitacionesTecnicoSel}
          ots={ots}
          sedes={sedes}
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

      {/* Modal replicar setup (copia individual) */}
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

      {/* Modal aplicar preset */}
      {aplicandoPreset && (
        <ModalAplicarPreset
          tecnico={aplicandoPreset}
          presets={presets}
          onClose={() => setAplicandoPreset(null)}
          onAplicar={async (presetSedeId, copiarFechas) => {
            await aplicarPresetATecnico(presetSedeId, aplicandoPreset.id, copiarFechas);
            setAplicandoPreset(null);
          }}
        />
      )}
    </div>
  );
}

// =============================================================
// SUBCOMPONENTE: Sidebar derecho del técnico
// =============================================================
function SidebarTecnicoHabilitaciones({
  tecnico, habilitaciones, ots, sedes, modoAcceso,
  onClose, onHide,
  onAgregarHabilitacion, onActualizarHabilitacion, onEliminarHabilitacion,
  onAgregarSubDoc, onActualizarSubDoc, onEliminarSubDoc,
  onToggleContabilizar,
  onReplicarSetup, showToast,
}: {
  tecnico: any;
  habilitaciones: Habilitacion[];
  ots: any[];
  sedes: any[];
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
  // FIX: ahora elegimos sede primero, OT opcional
  const [nuevaSedeSel, setNuevaSedeSel] = useState("");
  const [nuevaOtSel, setNuevaOtSel] = useState("");
  const [nuevoDocNombre, setNuevoDocNombre] = useState("");
  const [nuevoDocFecha, setNuevoDocFecha] = useState("");
  const [nuevoDocEnlace, setNuevoDocEnlace] = useState("");
  const [agregandoSubDoc, setAgregandoSubDoc] = useState<string | null>(null);
  const [nuevoSubDoc, setNuevoSubDoc] = useState({ nombre: "", fecha_vencimiento: "", enlace_url: "", notas: "" });
  const [editandoSubDoc, setEditandoSubDoc] = useState<{ id: string; sub: SubDocumento; parentId: string } | null>(null);
  const [editandoHab, setEditandoHab] = useState<Habilitacion | null>(null);

  const habilitacionesPorSede = useMemo(() => {
    const grupos: Record<string, Habilitacion[]> = {};
    for (const h of habilitaciones) {
      const sede = h.sede_nombre || "(sin sede)";
      if (!grupos[sede]) grupos[sede] = [];
      grupos[sede].push(h);
    }
    return grupos;
  }, [habilitaciones]);

  // OTs filtradas por sede seleccionada (para el dropdown de OT opcional)
  const otsDeSedeSel = useMemo(() => {
    if (!nuevaSedeSel) return [];
    return ots.filter(o => o.sede === nuevaSedeSel);
  }, [ots, nuevaSedeSel]);

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

  const handleAgregarHab = async () => {
    if (!nuevaSedeSel || !nuevoDocNombre) {
      showToast("Sede y nombre de documento son obligatorios", "error");
      return;
    }
    const ok = await onAgregarHabilitacion({
      tecnico_id: tecnico.id,
      sede_nombre: nuevaSedeSel,
      ot_codigo: nuevaOtSel || undefined,
      documento_nombre: nuevoDocNombre,
      fecha_vencimiento: nuevoDocFecha || undefined,
      enlace_url: nuevoDocEnlace || undefined,
    });
    if (ok) {
      setNuevaSedeSel("");
      setNuevaOtSel("");
      setNuevoDocNombre("");
      setNuevoDocFecha("");
      setNuevoDocEnlace("");
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
        {/* Foto + datos */}
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

        {/* Habilitaciones por sede */}
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

                    {expanded && (
                      <div className="p-2 space-y-1">
                        {/* FIX: Agrupar por OT dentro de la sede (si tiene OT) */}
                        {Object.entries(
                          habs.reduce((acc, h) => {
                            const otKey = h.ot_codigo || "(sin OT)";
                            if (!acc[otKey]) acc[otKey] = [];
                            acc[otKey].push(h);
                            return acc;
                          }, {} as Record<string, Habilitacion[]>)
                        ).map(([otCodigo, habsOt]) => {
                          return (
                            <div key={otCodigo} className="border border-gray-100 rounded p-1.5 bg-white">
                              {otCodigo !== "(sin OT)" && (
                                <div className="text-[10px] font-mono font-semibold text-gray-900 mb-1">
                                  {otCodigo}
                                </div>
                              )}
                              <div className="space-y-1">
                                {habsOt.map(h => {
                                  const estado = calcularEstadoHabilitacion(h);
                                  const visual = ESTADO_VISUAL[estado];
                                  const contab = h.contabilizar !== false;
                                  const isEditing = editandoHab?.id === h.id;
                                  return (
                                    <div key={h.id} className="p-1.5 rounded border" style={{ borderColor: visual.border, backgroundColor: contab ? visual.bg : "#f9f9f9", opacity: contab ? 1 : 0.6 }}>
                                      {isEditing ? (
                                        <div className="space-y-1">
                                          <div className="text-[9px] font-bold text-blue-700">Editando documento</div>
                                          <input type="text" placeholder="Nombre" value={editandoHab!.documento_nombre} onChange={(e) => setEditandoHab({...editandoHab!, documento_nombre: e.target.value})} className="w-full px-1 py-0.5 text-[9px] border border-gray-200 rounded" />
                                          <input type="date" value={editandoHab!.fecha_vencimiento || ""} onChange={(e) => setEditandoHab({...editandoHab!, fecha_vencimiento: e.target.value})} className="w-full px-1 py-0.5 text-[9px] border border-gray-200 rounded" />
                                          <input type="text" placeholder="Enlace URL" value={editandoHab!.enlace_url || ""} onChange={(e) => setEditandoHab({...editandoHab!, enlace_url: e.target.value})} className="w-full px-1 py-0.5 text-[9px] border border-gray-200 rounded" />
                                          <input type="text" placeholder="Notas" value={editandoHab!.notas || ""} onChange={(e) => setEditandoHab({...editandoHab!, notas: e.target.value})} className="w-full px-1 py-0.5 text-[9px] border border-gray-200 rounded" />
                                          <div className="flex gap-1">
                                            <button
                                              onClick={async () => {
                                                await onActualizarHabilitacion(h.id, {
                                                  documento_nombre: editandoHab!.documento_nombre,
                                                  fecha_vencimiento: editandoHab!.fecha_vencimiento || undefined,
                                                  enlace_url: editandoHab!.enlace_url || undefined,
                                                  notas: editandoHab!.notas || undefined,
                                                });
                                                setEditandoHab(null);
                                              }}
                                              className="flex-1 py-0.5 text-[9px] text-white bg-[#E91E63] rounded hover:bg-[#c2185b] flex items-center justify-center gap-1"
                                            >
                                              <Save size={9} /> Guardar
                                            </button>
                                            <button onClick={() => setEditandoHab(null)} className="px-1 py-0.5 text-[9px] text-gray-500 border border-gray-200 rounded">X</button>
                                          </div>
                                        </div>
                                      ) : (
                                        <>
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
                                                <button
                                                  onClick={() => setEditandoHab(h)}
                                                  className="p-0.5 rounded text-blue-600 hover:bg-blue-100"
                                                  title="Editar documento"
                                                >
                                                  <Pencil size={9} />
                                                </button>
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
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
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

          {/* FIX: Añadir habilitación eligiendo SEDE primero, OT opcional */}
          {modoAcceso === "editor" && (
            <div className="mt-3 p-2 bg-gray-50 rounded border border-gray-200 space-y-1">
              <div className="text-[10px] font-bold text-gray-700">Añadir habilitación</div>
              <select
                value={nuevaSedeSel}
                onChange={(e) => { setNuevaSedeSel(e.target.value); setNuevaOtSel(""); }}
                className="w-full px-1 py-1 text-[10px] border border-gray-200 rounded bg-white"
              >
                <option value="">Selecciona Sede *</option>
                {sedes.map(s => <option key={s.nombre} value={s.nombre}>{s.nombre}</option>)}
              </select>
              <select
                value={nuevaOtSel}
                onChange={(e) => setNuevaOtSel(e.target.value)}
                className="w-full px-1 py-1 text-[10px] border border-gray-200 rounded bg-white"
                disabled={!nuevaSedeSel}
              >
                <option value="">OT (opcional)</option>
                {otsDeSedeSel.map(o => <option key={o.codigo} value={o.codigo}>{o.codigo} - {o.cliente}</option>)}
              </select>
              <input type="text" placeholder="Nombre documento (ej: EMO, Curso Alturas)" value={nuevoDocNombre} onChange={(e) => setNuevoDocNombre(e.target.value)} className="w-full px-1 py-1 text-[10px] border border-gray-200 rounded" />
              <input type="date" value={nuevoDocFecha} onChange={(e) => setNuevoDocFecha(e.target.value)} className="w-full px-1 py-1 text-[10px] border border-gray-200 rounded" />
              <input type="text" placeholder="Enlace URL (opcional)" value={nuevoDocEnlace} onChange={(e) => setNuevoDocEnlace(e.target.value)} className="w-full px-1 py-1 text-[10px] border border-gray-200 rounded" />
              <button
                onClick={handleAgregarHab}
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
// SUBCOMPONENTE: Modal replicar setup (copia individual)
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

// =============================================================
// SUBCOMPONENTE: Modal aplicar preset de sede
// =============================================================
function ModalAplicarPreset({
  tecnico, presets, onClose, onAplicar,
}: {
  tecnico: any;
  presets: any[];
  onClose: () => void;
  onAplicar: (presetSedeId: string, copiarFechas: boolean) => Promise<void>;
}) {
  const [presetSel, setPresetSel] = useState("");
  const [copiarFechas, setCopiarFechas] = useState(false);
  const [aplicando, setAplicando] = useState(false);

  const handleAplicar = async () => {
    if (!presetSel) {
      alert("Selecciona un preset");
      return;
    }
    const preset = presets.find(p => p.id === presetSel);
    if (!preset) return;
    if (!confirm(`¿Aplicar preset de ${preset.sede_nombre} (${preset.documentos.length} documentos) a ${tecnico.nombre}?`)) return;
    setAplicando(true);
    await onAplicar(presetSel, copiarFechas);
    setAplicando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-[95%] max-w-md max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 flex items-center justify-between text-white" style={{ backgroundColor: "#1d1d1f" }}>
          <div>
            <div className="text-sm font-bold">Aplicar preset de sede</div>
            <div className="text-[10px] text-white/60">A: {tecnico.nombre}</div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          {presets.length === 0 ? (
            <div className="text-center py-4 text-xs text-gray-400">
              No hay presets creados. Ve a la sección "Presets de Sedes" al final de la página para crear uno.
            </div>
          ) : (
            <>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Preset de sede *</label>
                <select value={presetSel} onChange={(e) => setPresetSel(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded bg-white mt-1">
                  <option value="">Selecciona preset...</option>
                  {presets.map(p => (
                    <option key={p.id} value={p.id}>{p.sede_nombre} ({p.documentos.length} docs)</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input type="checkbox" checked={copiarFechas} onChange={(e) => setCopiarFechas(e.target.checked)} />
                <span>Copiar fechas del preset (si las tiene). Si desmarcas, se crearán documentos sin fecha para llenar manualmente.</span>
              </label>
              {presetSel && (
                <div className="p-2 bg-purple-50 rounded text-[10px] text-gray-600">
                  {(() => {
                    const p = presets.find(x => x.id === presetSel);
                    if (!p) return null;
                    return (
                      <>
                        <div className="font-bold mb-1">{p.sede_nombre}</div>
                        {p.documentos.map((d: any) => (
                          <div key={d.id}>
                            • {d.nombre}
                            {d.fecha_vencimiento && <span className="text-gray-500"> (vence {d.fecha_vencimiento.split("-").reverse().join("/")})</span>}
                            {d.sub_documentos?.length > 0 && <span className="text-gray-400"> — {d.sub_documentos.length} sub-doc(s)</span>}
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </div>
        <div className="border-t border-gray-200 p-3 flex justify-end gap-2">
          <button onClick={onClose} disabled={aplicando} className="px-3 py-1.5 text-xs border border-gray-200 rounded hover:bg-gray-50">Cancelar</button>
          <button
            onClick={handleAplicar}
            disabled={aplicando || !presetSel || presets.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-white rounded bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
          >
            <Wand2 size={14} /> {aplicando ? "Aplicando..." : "Aplicar preset"}
          </button>
        </div>
      </div>
    </div>
  );
}

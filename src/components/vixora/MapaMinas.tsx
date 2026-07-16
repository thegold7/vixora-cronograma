"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useStore, formatFechaISO } from "@/lib/store";
import { MINAS_PERU, type MinaCoord } from "@/lib/minasData";
import type { OT, Tecnico, Sede } from "@/lib/types";
import { Search, X, Calendar, Info, RefreshCw, Check, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";

interface MinaAgrupada {
  coord: MinaCoord & { visible?: boolean };
  ots: OT[];                    // TODAS las OTs de la sede (sin filtro de fechas)
  otsRealizandose: OT[];        // OTs asignadas a técnicos con actividades rojas en el rango de fechas
  enProceso: number;
  finalizado: number;
  pendiente: number;
  total: number;
  hasActividadEnRango: boolean;
}

interface TecnicoAgrupado {
  tecnico: Tecnico;
  fechaInicio: string;
  fechaFin: string;
  actividades: Set<string>;
  otsRealizadas: Set<string>;   // OTs de esta sede que el técnico está realizando
}

export function MapaMinas() {
  const { ots, cronograma, tecnicos, actividades, cargarDatosSilencioso, showToast } = useStore();
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const [selectedMina, setSelectedMina] = useState<MinaAgrupada | null>(null);
  const [query, setQuery] = useState("");
  const [actualizando, setActualizando] = useState(false);
  const [imgKey, setImgKey] = useState(0);
  const [sedesExcel, setSedesExcel] = useState<Sede[]>([]);
  const [otsAsociadasExpandidas, setOtsAsociadasExpandidas] = useState(false);
  const [otsRealizandoseExpandidas, setOtsRealizandoseExpandidas] = useState(false);
  const [filtroFechasActivo, setFiltroFechasActivo] = useState(false);
  const [ocultarSinOts, setOcultarSinOts] = useState(false);

  const hoy = new Date();
  const [inputInicio, setInputInicio] = useState(() => formatFechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
  const [inputFin, setInputFin] = useState(() => formatFechaISO(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)));
  const [fechaInicio, setFechaInicio] = useState(() => formatFechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
  const [fechaFin, setFechaFin] = useState(() => formatFechaISO(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)));

  // Actividades de color rojo (PROYECTO ANT, PROYECTO MC, SERV. LIMA, SERV. PROVINCIA, etc.)
  const actividadesRojas = useMemo(() => {
    return new Set(actividades.filter(a => a.color === "rojo").map(a => a.nombre));
  }, [actividades]);

  const handleActualizar = async () => {
    setActualizando(true);
    await cargarDatosSilencioso();
    try {
      const res = await fetch("/api/sedes", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setSedesExcel(json.data);
    } catch (err) {
      console.error("Error al cargar sedes:", err);
    }
    setActualizando(false);
  };

  useEffect(() => {
    fetch("/api/sedes", { cache: "no-store" })
      .then(res => res.json())
      .then(json => { if (json.ok) setSedesExcel(json.data); })
      .catch(err => console.error("Error:", err));
  }, []);

  const handleAplicarFechas = () => {
    setFechaInicio(inputInicio);
    setFechaFin(inputFin);
    setFiltroFechasActivo(true);
  };

  const handleHoy = () => {
    const hoyStr = formatFechaISO(new Date());
    setInputInicio(hoyStr);
    setInputFin(hoyStr);
    setFechaInicio(hoyStr);
    setFechaFin(hoyStr);
    setFiltroFechasActivo(true);
  };

  const handleLimpiarFechas = () => {
    setFiltroFechasActivo(false);
  };

  // Cargar todas las sedes y mezclar visibilidad del Excel.
  // NO se fusionan por coordenadas: cada sede es independiente.
  const todasLasSedes = useMemo(() => {
    const mapaSedes = new Map<string, MinaCoord & { visible?: boolean }>();

    MINAS_PERU.forEach(s => {
      const excelSede = sedesExcel.find(e => e.nombre.toUpperCase() === s.nombre.toUpperCase());
      mapaSedes.set(s.nombre.toUpperCase(), {
        ...s,
        visible: excelSede ? excelSede.visible : true,
      });
    });

    sedesExcel.forEach(s => {
      if (!mapaSedes.has(s.nombre.toUpperCase())) {
        mapaSedes.set(s.nombre.toUpperCase(), {
          nombre: s.nombre,
          lat: s.lat,
          lng: s.lng,
          region: s.region,
          ciudad: s.ciudad,
          datoCurioso: s.datoCurioso,
          foto_ciudad: s.foto_ciudad,
          visible: s.visible ?? true,
        });
      } else {
        const existing = mapaSedes.get(s.nombre.toUpperCase())!;
        existing.visible = s.visible ?? true;
      }
    });

    return Array.from(mapaSedes.values());
  }, [sedesExcel]);

  // FIX: Mostrar TODAS las OTs excepto PERDIDO y visible_mapa=false.
  // Antes se filtraba por estado (EN PROCESO/FINALIZADO/PENDIENTE) lo que hacía
  // que OTs con estado vacío o desconocido no aparecieran (ej: 5000360424 en MARCOBRE).
  const otsValidas = useMemo(() => {
    return ots.filter(o => {
      if (o.visible_mapa === false) return false;
      if (o.estado === "PERDIDO") return false;
      return true;
    });
  }, [ots]);

  // FIX: Búsqueda robusta de sede por texto.
  const buscarSede = (texto: string): (MinaCoord & { visible?: boolean }) | null => {
    if (!texto) return null;
    const textoUpper = texto.toUpperCase().trim();
    if (!textoUpper) return null;

    // 1. Match exacto
    let found = todasLasSedes.find(s => s.nombre.toUpperCase() === textoUpper);
    if (found) return found;

    // 2. Tokens significativos (>=3 chars)
    const tokens = textoUpper.split(/[\s,;:.\/\\\-|()]+/).filter(t => t.length >= 3);
    if (tokens.length === 0) return null;

    // 3. Tokens completos de la sede en el texto
    for (const s of todasLasSedes) {
      const nombreUpper = s.nombre.toUpperCase();
      const sedeTokens = nombreUpper.split(/[\s,;:.\/\\\-|()]+/).filter(t => t.length >= 3);
      for (const tk of sedeTokens) {
        if (tokens.includes(tk)) return s;
      }
    }

    // 4. Fallback para nombres cortos (<=6 chars)
    for (const s of todasLasSedes) {
      const nombreUpper = s.nombre.toUpperCase();
      if (nombreUpper.length <= 6 && (textoUpper.includes(nombreUpper) || nombreUpper.includes(textoUpper))) {
        return s;
      }
    }

    return null;
  };

  const minasAgrupadas = useMemo(() => {
    const grupos: Record<string, MinaAgrupada> = {};
    for (const sede of todasLasSedes) {
      grupos[sede.nombre] = { coord: sede, ots: [], otsRealizandose: [], enProceso: 0, finalizado: 0, pendiente: 0, total: 0, hasActividadEnRango: false };
    }

    // FIX: Asignar cada OT a su sede (usando ot.sede primero, ot.cliente como fallback)
    for (const ot of otsValidas) {
      const coord = buscarSede(ot.sede) || buscarSede(ot.cliente);
      if (!coord) continue;
      const key = coord.nombre;
      if (!grupos[key]) grupos[key] = { coord, ots: [], otsRealizandose: [], enProceso: 0, finalizado: 0, pendiente: 0, total: 0, hasActividadEnRango: false };
      grupos[key].ots.push(ot);
      grupos[key].total++;
      if (ot.estado === "EN PROCESO") grupos[key].enProceso++;
      else if (ot.estado === "FINALIZADO") grupos[key].finalizado++;
      else if (ot.estado === "PENDIENTE") grupos[key].pendiente++;
    }

    // FIX: OTs que se están realizando = OTs asignadas en cronograma con actividad ROJA en el rango de fechas
    const codigosRealizandose = new Set<string>();
    for (const e of Object.values(cronograma)) {
      if (e.fecha < fechaInicio || e.fecha > fechaFin) continue;
      if (!actividadesRojas.has(e.actividad)) continue;
      if (e.ots_asignadas && e.ots_asignadas !== "—") {
        e.ots_asignadas.split(",").map(s => s.trim()).forEach(c => codigosRealizandose.add(c));
      }
    }

    Object.values(grupos).forEach(g => {
      g.otsRealizandose = g.ots.filter(ot => codigosRealizandose.has(ot.codigo));
      g.hasActividadEnRango = g.otsRealizandose.length > 0;
    });

    return Object.values(grupos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otsValidas, todasLasSedes, cronograma, fechaInicio, fechaFin, actividadesRojas]);

  const minasFiltradasLista = useMemo(() => {
    let result = minasAgrupadas;
    if (ocultarSinOts) {
      result = result.filter(g => g.total > 0);
    }
    if (filtroFechasActivo) {
      result = result.filter(g => g.hasActividadEnRango);
    }
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(g =>
        g.coord.nombre.toLowerCase().includes(q) ||
        g.coord.region.toLowerCase().includes(q) ||
        g.ots.some(ot => ot.codigo.toLowerCase().includes(q) || ot.cliente.toLowerCase().includes(q))
      );
    }
    return result;
  }, [minasAgrupadas, query, filtroFechasActivo, ocultarSinOts]);

  const minasParaMapa = useMemo(() => {
    return minasFiltradasLista.filter(g => g.coord.visible !== false);
  }, [minasFiltradasLista]);

  // FIX: getTecnicosEnMina ahora considera TODAS las OTs de la sede (no solo otsEnRango)
  // y NO filtra por actividad. Cualquier entrada del cronograma con OT asignada a esta sede
  // cuenta como técnico presente. Esto resuelve el problema de técnicos que no aparecían.
  const getTecnicosEnMina = (mina: MinaAgrupada): TecnicoAgrupado[] => {
    const tecnicosMap: Record<string, TecnicoAgrupado> = {};
    const codigosOtDeSede = new Set(mina.ots.map(ot => ot.codigo));

    for (const e of Object.values(cronograma)) {
      if (e.fecha < fechaInicio || e.fecha > fechaFin) continue;
      if (!e.ots_asignadas || e.ots_asignadas === "—") continue;

      const codigos = e.ots_asignadas.split(",").map(s => s.trim());
      const perteneceAMina = codigos.some(cod => codigosOtDeSede.has(cod));
      if (!perteneceAMina) continue;

      const tecnico = tecnicos.find(t => t.id === e.tecnico_id);
      if (tecnico && tecnico.activo) {
        const otsEnEstaSede = codigos.filter(cod => codigosOtDeSede.has(cod));
        if (!tecnicosMap[tecnico.id]) {
          tecnicosMap[tecnico.id] = {
            tecnico,
            fechaInicio: e.fecha,
            fechaFin: e.fecha,
            actividades: new Set([e.actividad]),
            otsRealizadas: new Set(otsEnEstaSede),
          };
        } else {
          if (e.fecha < tecnicosMap[tecnico.id].fechaInicio) tecnicosMap[tecnico.id].fechaInicio = e.fecha;
          if (e.fecha > tecnicosMap[tecnico.id].fechaFin) tecnicosMap[tecnico.id].fechaFin = e.fecha;
          tecnicosMap[tecnico.id].actividades.add(e.actividad);
          otsEnEstaSede.forEach(cod => tecnicosMap[tecnico.id].otsRealizadas.add(cod));
        }
      }
    }
    return Object.values(tecnicosMap).sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
  };

  const handleToggleVisibleSede = async (nombre: string) => {
    const sedeExcel = sedesExcel.find(s => s.nombre === nombre);
    const isVisible = sedeExcel ? (sedeExcel.visible ?? true) : true;

    if (sedeExcel) {
      setSedesExcel(prev => prev.map(s =>
        s.nombre === nombre ? { ...s, visible: !isVisible } : s
      ));
    } else {
      const sedePredef = MINAS_PERU.find(s => s.nombre === nombre);
      if (sedePredef) {
        setSedesExcel(prev => [...prev, { ...sedePredef, visible: false }]);
      }
    }

    try {
      const res = await fetch("/api/sedes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "toggle_visible_sede", nombre, visible: !isVisible })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await cargarDatosSilencioso();
      showToast(`Sede ${!isVisible ? 'visible' : 'oculta'}`, "ok");
    } catch (err) {
      if (sedeExcel) {
        setSedesExcel(prev => prev.map(s =>
          s.nombre === nombre ? { ...s, visible: isVisible } : s
        ));
      }
      showToast(err instanceof Error ? err.message : "Error", "error");
    }
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [-9.1900, -75.0152], zoom: 5, zoomControl: true, scrollWheelZoom: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 18 }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    for (const mina of minasParaMapa) {
      const { coord, enProceso, finalizado, pendiente, total } = mina;
      let color = "#6b7280";
      if (total > 0) {
        if (enProceso > 0 && enProceso >= finalizado) color = "#f59e0b";
        else if (finalizado > 0) color = "#10b981";
        else if (pendiente > 0) color = "#3b82f6";
      }
      const radius = total > 0 ? Math.min(8 + total * 2, 25) : 6;
      const marker = L.circleMarker([coord.lat, coord.lng], { radius, fillColor: color, color: "#ffffff", weight: 2, opacity: 1, fillOpacity: 0.8 }).addTo(mapRef.current!);
      const popupHtml = `<div style="font-family: -apple-system, sans-serif; min-width: 180px;"><div style="font-weight: bold; font-size: 13px; color: #1d1d1f; margin-bottom: 4px;">${coord.nombre}</div><div style="font-size: 10px; color: #6e6e73; margin-bottom: 8px;">📍 ${coord.region}</div><div style="display: flex; gap: 8px; font-size: 11px; flex-wrap: wrap;"><span style="color: #f59e0b;">⚡ ${enProceso}</span><span style="color: #10b981;">✓ ${finalizado}</span><span style="color: #3b82f6;">⏳ ${pendiente}</span></div><div style="font-size: 10px; color: #999; margin-top: 6px;">Total: ${total} OT(s)</div></div>`;
      marker.bindPopup(popupHtml);
      marker.on("click", () => {
        setSelectedMina(mina);
        setOtsAsociadasExpandidas(false);
        setOtsRealizandoseExpandidas(false);
      });
      markersRef.current.push(marker);
    }
  }, [minasParaMapa]);

  const zoomToMina = (mina: MinaAgrupada) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo([mina.coord.lat, mina.coord.lng], 8, { duration: 1.2 });
    setSelectedMina(mina);
    setOtsAsociadasExpandidas(false);
    setOtsRealizandoseExpandidas(false);
  };

  const getIniciales = (nombre: string) => {
    const partes = nombre.trim().split(/\s+/);
    return partes.length >= 2 ? (partes[0][0] + partes[1][0]).toUpperCase() : nombre.substring(0, 2).toUpperCase();
  };

  const fmtFecha = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}`;
  };

  const getEstadoColor = (estado: string) => {
    if (estado === "EN PROCESO") return "bg-yellow-100 text-yellow-700";
    if (estado === "FINALIZADO") return "bg-green-100 text-green-700";
    if (estado === "PENDIENTE") return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-700";
  };

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-72 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-3 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">🗺️ Mapa de Minas</div>
            <button onClick={handleActualizar} disabled={actualizando} className="p-1 text-gray-500 hover:text-[#E91E63] disabled:opacity-50" title="Actualizar datos">
              <RefreshCw size={14} className={actualizando ? "animate-spin" : ""} />
            </button>
          </div>
          <div className="relative mb-2">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar mina, OT o cliente..." className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-pink-400" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-[10px] text-gray-600">
                <Calendar size={10} className="text-gray-400" /><span className="font-semibold">Rango de fechas:</span>
              </div>
              <div className="flex gap-1">
                <button onClick={handleHoy} className="text-[10px] text-[#E91E63] font-bold hover:underline">Hoy</button>
                {filtroFechasActivo && (
                  <button onClick={handleLimpiarFechas} className="text-[10px] text-gray-500 font-bold hover:underline">Limpiar</button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <input type="date" value={inputInicio} onChange={(e) => setInputInicio(e.target.value)} className="w-full px-1 py-0.5 text-[10px] border border-gray-200 rounded" />
              <span className="text-gray-400">→</span>
              <input type="date" value={inputFin} onChange={(e) => setInputFin(e.target.value)} className="w-full px-1 py-0.5 text-[10px] border border-gray-200 rounded" />
            </div>
            <button onClick={handleAplicarFechas} className="w-full flex items-center justify-center gap-1 py-1 text-[10px] text-white rounded bg-[#E91E63] hover:bg-[#c2185b]"><Check size={10} /> Aplicar fechas</button>
            {filtroFechasActivo && (
              <div className="text-[9px] text-[#E91E63] text-center mt-1">📋 Filtrando por fechas activo</div>
            )}
            <label className="flex items-center gap-1.5 text-[10px] text-gray-600 mt-1 cursor-pointer">
              <input type="checkbox" checked={ocultarSinOts} onChange={(e) => setOcultarSinOts(e.target.checked)} className="rounded" />
              Ocultar sedes sin OTs
            </label>
          </div>
        </div>

        <div className="p-2 border-b border-gray-200 bg-gray-50 shrink-0">
          <div className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">Estado</div>
          <div className="flex gap-2 flex-wrap text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>En proceso</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>Finalizado</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>Pendiente</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span>Sin OTs</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {minasFiltradasLista.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400">No hay sedes que coincidan</div>
          ) : (
            minasFiltradasLista.map((mina) => {
              const isVisible = mina.coord.visible !== false;
              return (
                <div key={mina.coord.nombre} className={`p-2 border-b border-gray-100 hover:bg-gray-50 ${selectedMina?.coord.nombre === mina.coord.nombre ? "bg-pink-50 border-l-2 border-l-[#E91E63]" : ""} ${!isVisible ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleVisibleSede(mina.coord.nombre); }}
                      className={`p-0.5 rounded ${isVisible ? "text-green-600 hover:bg-green-100" : "text-gray-400 hover:bg-gray-200"}`}
                      title={isVisible ? "Ocultar del mapa" : "Mostrar en mapa"}
                    >
                      {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => isVisible && zoomToMina(mina)}>
                      <div className="text-xs font-semibold text-gray-900 truncate">{mina.coord.nombre}</div>
                      <div className="text-[10px] text-gray-500 truncate">{mina.coord.region}</div>
                    </div>
                    <div className="text-xs font-bold text-gray-700">
                      {filtroFechasActivo ? mina.otsRealizandose.length : mina.total}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="p-2 border-t border-gray-200 bg-white text-[10px] text-gray-400 text-center shrink-0">
          {minasFiltradasLista.length} sede(s) en lista · {minasParaMapa.length} en mapa
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 relative">
          <div ref={containerRef} className="w-full h-full" style={{ minHeight: "400px" }} />
        </div>

        {selectedMina && (
          <div className="h-80 shrink-0 bg-white border-t border-gray-200 flex">
            <div className="flex-1 flex flex-col border-r border-gray-200 min-w-0">
              <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between" style={{ backgroundColor: "#1d1d1f" }}>
                <div>
                  <div className="text-sm font-bold text-white">{selectedMina.coord.nombre}</div>
                  <div className="text-[10px] text-white/60">📍 {selectedMina.coord.region}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggleVisibleSede(selectedMina.coord.nombre)} className="p-1 text-white/60 hover:text-white" title="Ocultar/Mostrar sede">
                    {selectedMina.coord.visible !== false ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button onClick={() => setSelectedMina(null)} className="text-white/60 hover:text-white p-1"><X size={16} /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <div className="flex gap-3 mb-3 text-xs">
                  <span className="text-yellow-600">⚡ {selectedMina.enProceso}</span>
                  <span className="text-green-600">✓ {selectedMina.finalizado}</span>
                  <span className="text-blue-600">⏳ {selectedMina.pendiente}</span>
                  <span className="text-gray-400">Total: {selectedMina.total}</span>
                </div>

                {/* Técnicos en sede con OTs que están realizando */}
                {(() => {
                  const tecnicosMina = getTecnicosEnMina(selectedMina);
                  return (
                    <>
                      <div className="text-[10px] font-bold text-gray-500 uppercase mb-1 mt-2">
                        Técnicos en sede ({tecnicosMina.length}):
                      </div>
                      <div className="space-y-1 mb-3">
                        {tecnicosMina.length === 0 && <p className="text-[10px] text-gray-400 italic">No hay técnicos en estas fechas</p>}
                        {tecnicosMina.map((t, i) => (
                          <div key={i} className="flex items-center gap-2 p-1 bg-gray-50 rounded">
                            <div className="w-7 h-7 rounded-full overflow-hidden border-2 border-[#E91E63] bg-gray-200 shrink-0">
                              {t.tecnico.foto_url ? (
                                <img src={t.tecnico.foto_url} alt={t.tecnico.nombre} className="w-full h-full object-cover" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-gray-500">{getIniciales(t.tecnico.nombre)}</div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-gray-900 truncate">{t.tecnico.nombre}</div>
                              <div className="text-[10px] text-gray-500 truncate">
                                {Array.from(t.actividades).join(", ")}
                                {t.otsRealizadas.size > 0 && (
                                  <span className="text-[#E91E63] font-semibold"> · OT: {Array.from(t.otsRealizadas).join(", ")}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-[10px] text-gray-600 shrink-0 font-medium">
                              {t.fechaInicio === t.fechaFin ? fmtFecha(t.fechaInicio) : `${fmtFecha(t.fechaInicio)} → ${fmtFecha(t.fechaFin)}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}

                {/* OTs asociadas a la sede (TODAS, sin filtro de fechas) */}
                <div className="text-[10px] font-bold text-gray-500 uppercase mb-1 flex items-center justify-between">
                  <span>OTs asociadas a la sede ({selectedMina.ots.length}):</span>
                  <button onClick={() => setOtsAsociadasExpandidas(!otsAsociadasExpandidas)} className="p-0.5 hover:bg-gray-200 rounded">
                    {otsAsociadasExpandidas ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>
                {otsAsociadasExpandidas && (
                  <div className="space-y-1 mb-3">
                    {selectedMina.ots.length === 0 && <p className="text-[10px] text-gray-400 italic">No hay OTs asociadas a esta sede</p>}
                    {selectedMina.ots.map((ot) => {
                      const color = getEstadoColor(ot.estado);
                      return (
                        <div key={ot.codigo} className="p-1.5 rounded border border-gray-200 flex items-center gap-2 hover:bg-gray-50">
                          <div className="text-[10px] font-mono font-bold text-gray-900 w-24 truncate">{ot.codigo}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] text-gray-900 truncate">{ot.cliente}</div>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold ${color}`}>{ot.estado || "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* OTs que se están realizando (asignadas a técnicos con actividades rojas en el rango) */}
                <div className="text-[10px] font-bold text-[#E91E63] uppercase mb-1 flex items-center justify-between mt-3">
                  <span>OTs que se están realizando ({selectedMina.otsRealizandose.length}):</span>
                  <button onClick={() => setOtsRealizandoseExpandidas(!otsRealizandoseExpandidas)} className="p-0.5 hover:bg-gray-200 rounded">
                    {otsRealizandoseExpandidas ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>
                {otsRealizandoseExpandidas && (
                  <div className="space-y-1">
                    {selectedMina.otsRealizandose.length === 0 && <p className="text-[10px] text-gray-400 italic">No hay OTs en realización en estas fechas</p>}
                    {selectedMina.otsRealizandose.map((ot) => {
                      const color = getEstadoColor(ot.estado);
                      return (
                        <div key={ot.codigo} className="p-1.5 rounded border border-[#E91E63]/30 bg-pink-50/50 flex items-center gap-2 hover:bg-pink-50">
                          <div className="text-[10px] font-mono font-bold text-gray-900 w-24 truncate">{ot.codigo}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] text-gray-900 truncate">{ot.cliente}</div>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold ${color}`}>{ot.estado || "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="w-56 shrink-0 flex flex-col bg-white">
              <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-2">
                  <Info size={12} className="text-[#E91E63]" />
                  <span className="text-[10px] font-bold text-gray-700 uppercase">Dato Curioso</span>
                </div>
                <button
                  onClick={() => setImgKey((prev) => prev + 1)}
                  className="p-1 text-gray-500 hover:text-[#E91E63] rounded"
                  title="Recargar imagen"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {selectedMina.coord.foto_ciudad ? (
                  <div key={imgKey} className="mb-3">
                    <img
                      src={selectedMina.coord.foto_ciudad}
                      alt={`Foto de ${selectedMina.coord.ciudad ?? selectedMina.coord.nombre}`}
                      className="w-full h-32 object-cover rounded border border-gray-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <div className="text-[10px] text-gray-500 mt-1 text-center italic">
                      {selectedMina.coord.ciudad ?? selectedMina.coord.nombre}
                    </div>
                  </div>
                ) : (
                  <div className="mb-3 h-32 flex items-center justify-center bg-gray-100 rounded text-[10px] text-gray-400">
                    Sin imagen
                  </div>
                )}
                <div className="text-xs text-gray-700 leading-relaxed">
                  {selectedMina.coord.datoCurioso || "Sin dato curioso registrado para esta sede."}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

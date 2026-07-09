"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useStore, formatFechaISO } from "@/lib/store";
import { findMinaCoord, type MinaCoord } from "@/lib/minasData";
import type { OT, Tecnico, Sede } from "@/lib/types";
import { Search, X, Calendar, Info, RefreshCw, Check } from "lucide-react";

interface MinaAgrupada {
  coord: MinaCoord;
  ots: OT[];
  enProceso: number;
  finalizado: number;
  pendiente: number;
  total: number;
}

interface TecnicoAgrupado {
  tecnico: Tecnico;
  fechaInicio: string;
  fechaFin: string;
  actividades: Set<string>;
}

export function MapaMinas() {
  const { ots, cronograma, tecnicos, cargarDatosSilencioso } = useStore();
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const [selectedMina, setSelectedMina] = useState<MinaAgrupada | null>(null);
  const [query, setQuery] = useState("");
  const [actualizando, setActualizando] = useState(false);
  const [imgKey, setImgKey] = useState(0);
  const [sedesExcel, setSedesExcel] = useState<Sede[]>([]);
  
  const hoy = new Date();
  const [inputInicio, setInputInicio] = useState(() => formatFechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
  const [inputFin, setInputFin] = useState(() => formatFechaISO(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)));
  const [fechaInicio, setFechaInicio] = useState(() => formatFechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
  const [fechaFin, setFechaFin] = useState(() => formatFechaISO(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)));

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
  };

  const handleHoy = () => {
    const hoyStr = formatFechaISO(new Date());
    setInputInicio(hoyStr);
    setInputFin(hoyStr);
    setFechaInicio(hoyStr);
    setFechaFin(hoyStr);
  };

  const getCoordDeOt = (ot: OT): MinaCoord | null => {
    const buscarEn = (texto: string): MinaCoord | null => {
      if (!texto || !texto.trim()) return null;
      const textoUpper = texto.toUpperCase().trim();
      let found = sedesExcel.find(s => s.nombre.toUpperCase() === textoUpper);
      if (found) return { ...found };
      found = sedesExcel.find(s => textoUpper.includes(s.nombre.toUpperCase()) || s.nombre.toUpperCase().includes(textoUpper));
      if (found) return { ...found };
      return findMinaCoord(texto);
    };
    return buscarEn(ot.sede) || buscarEn(ot.cliente);
  };

  const otsValidas = useMemo(() => {
    return ots.filter(o => o.estado !== "PERDIDO" && (o.estado === "EN PROCESO" || o.estado === "FINALIZADO" || o.estado === "PENDIENTE"));
  }, [ots]);

  const minasAgrupadas = useMemo(() => {
    const grupos: Record<string, MinaAgrupada> = {};
    for (const ot of otsValidas) {
      const coord = getCoordDeOt(ot);
      if (!coord) continue;
      const key = coord.nombre;
      if (!grupos[key]) grupos[key] = { coord, ots: [], enProceso: 0, finalizado: 0, pendiente: 0, total: 0 };
      grupos[key].ots.push(ot);
      grupos[key].total++;
      if (ot.estado === "EN PROCESO") grupos[key].enProceso++;
      else if (ot.estado === "FINALIZADO") grupos[key].finalizado++;
      else if (ot.estado === "PENDIENTE") grupos[key].pendiente++;
    }
    return Object.values(grupos);
  }, [otsValidas, sedesExcel]);

  const minasFiltradas = useMemo(() => {
    if (!query) return minasAgrupadas;
    const q = query.toLowerCase();
    return minasAgrupadas.filter(g => 
      g.coord.nombre.toLowerCase().includes(q) ||
      g.coord.region.toLowerCase().includes(q) ||
      g.ots.some(ot => ot.codigo.toLowerCase().includes(q) || ot.cliente.toLowerCase().includes(q))
    );
  }, [minasAgrupadas, query]);

  const getTecnicosEnMina = (mina: MinaAgrupada): TecnicoAgrupado[] => {
    const tecnicosMap: Record<string, TecnicoAgrupado> = {};
    for (const e of Object.values(cronograma)) {
      if (e.fecha < fechaInicio || e.fecha > fechaFin) continue;
      if (!e.actividad.includes("PROYECTO") && !e.actividad.includes("SERV.")) continue;
      if (e.ots_asignadas && e.ots_asignadas !== "—") {
        const codigos = e.ots_asignadas.split(",").map(s => s.trim());
        const perteneceAMina = codigos.some(cod => mina.ots.some(ot => ot.codigo === cod));
        if (perteneceAMina) {
          const tecnico = tecnicos.find(t => t.id === e.tecnico_id);
          if (tecnico && tecnico.activo) {
            if (!tecnicosMap[tecnico.id]) {
              tecnicosMap[tecnico.id] = { tecnico, fechaInicio: e.fecha, fechaFin: e.fecha, actividades: new Set([e.actividad]) };
            } else {
              if (e.fecha < tecnicosMap[tecnico.id].fechaInicio) tecnicosMap[tecnico.id].fechaInicio = e.fecha;
              if (e.fecha > tecnicosMap[tecnico.id].fechaFin) tecnicosMap[tecnico.id].fechaFin = e.fecha;
              tecnicosMap[tecnico.id].actividades.add(e.actividad);
            }
          }
        }
      }
    }
    return Object.values(tecnicosMap).sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
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
    for (const mina of minasFiltradas) {
      const { coord, enProceso, finalizado, pendiente, total } = mina;
      let color = "#6b7280";
      if (enProceso > 0 && enProceso >= finalizado) color = "#f59e0b";
      else if (finalizado > 0) color = "#10b981";
      else if (pendiente > 0) color = "#3b82f6";
      const radius = Math.min(8 + total * 2, 25);
      const marker = L.circleMarker([coord.lat, coord.lng], { radius, fillColor: color, color: "#ffffff", weight: 2, opacity: 1, fillOpacity: 0.8 }).addTo(mapRef.current!);
      const popupHtml = `<div style="font-family: -apple-system, sans-serif; min-width: 180px;"><div style="font-weight: bold; font-size: 13px; color: #1d1d1f; margin-bottom: 4px;">${coord.nombre}</div><div style="font-size: 10px; color: #6e6e73; margin-bottom: 8px;">📍 ${coord.region}</div><div style="display: flex; gap: 8px; font-size: 11px; flex-wrap: wrap;"><span style="color: #f59e0b;">⚡ ${enProceso}</span><span style="color: #10b981;">✓ ${finalizado}</span><span style="color: #3b82f6;">⏳ ${pendiente}</span></div><div style="font-size: 10px; color: #999; margin-top: 6px;">Total: ${total} OT(s)</div></div>`;
      marker.bindPopup(popupHtml);
      marker.on("click", () => setSelectedMina(mina));
      markersRef.current.push(marker);
    }
  }, [minasFiltradas]);

  const zoomToMina = (mina: MinaAgrupada) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo([mina.coord.lat, mina.coord.lng], 8, { duration: 1.2 });
    setSelectedMina(mina);
  };

  const getIniciales = (nombre: string) => {
    const partes = nombre.trim().split(/\s+/);
    return partes.length >= 2 ? (partes[0][0] + partes[1][0]).toUpperCase() : nombre.substring(0, 2).toUpperCase();
  };

  const fmtFecha = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}`;
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
                <Calendar size={10} className="text-gray-400" />
                <span className="font-semibold">Rango de fechas:</span>
              </div>
              <button onClick={handleHoy} className="text-[10px] text-[#E91E63] font-bold hover:underline">Hoy</button>
            </div>
            <div className="flex items-center gap-1">
              <input type="date" value={inputInicio} onChange={(e) => setInputInicio(e.target.value)} className="w-full px-1 py-0.5 text-[10px] border border-gray-200 rounded" />
              <span className="text-gray-400">→</span>
              <input type="date" value={inputFin} onChange={(e) => setInputFin(e.target.value)} className="w-full px-1 py-0.5 text-[10px] border border-gray-200 rounded" />
            </div>
            <button onClick={handleAplicarFechas} className="w-full flex items-center justify-center gap-1 py-1 text-[10px] text-white rounded bg-[#E91E63] hover:bg-[#c2185b]">
              <Check size={10} /> Aplicar fechas
            </button>
          </div>
        </div>

        <div className="p-2 border-b border-gray-200 bg-gray-50 shrink-0">
          <div className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">Estado</div>
          <div className="flex gap-2 flex-wrap text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>En proceso</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>Finalizado</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>Pendiente</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {minasFiltradas.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400">No se encontraron minas</div>
          ) : (
            minasFiltradas.map((mina) => (
              <div key={mina.coord.nombre} onClick={() => zoomToMina(mina)} className={`p-2 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${selectedMina?.coord.nombre === mina.coord.nombre ? "bg-pink-50 border-l-2 border-l-[#E91E63]" : ""}`}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: mina.enProceso > 0 && mina.enProceso >= mina.finalizado ? "#f59e0b" : mina.finalizado > 0 ? "#10b981" : mina.pendiente > 0 ? "#3b82f6" : "#6b7280" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-900 truncate">{mina.coord.nombre}</div>
                    <div className="text-[10px] text-gray-500 truncate">{mina.coord.region}</div>
                  </div>
                  <div className="text-xs font-bold text-gray-700">{mina.total}</div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-2 border-t border-gray-200 bg-white text-[10px] text-gray-400 text-center shrink-0">
          {minasFiltradas.length} mina(s) · {otsValidas.length} OT(s)
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
                <button onClick={() => setSelectedMina(null)} className="text-white/60 hover:text-white p-1"><X size={16} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <div className="flex gap-3 mb-3 text-xs">
                  <span className="text-yellow-600">⚡ {selectedMina.enProceso} en proceso</span>
                  <span className="text-green-600">✓ {selectedMina.finalizado} finalizado</span>
                  <span className="text-blue-600">⏳ {selectedMina.pendiente} pendiente</span>
                </div>
                
                {(() => {
                  const tecnicosMina = getTecnicosEnMina(selectedMina);
                  return (
                    <>
                      <div className="text-[10px] font-bold text-gray-500 uppercase mb-1 mt-2">Técnicos en proyecto ({tecnicosMina.length}):</div>
                      <div className="space-y-1 mb-3">
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
                              <div className="text-[10px] text-gray-500 truncate">{Array.from(t.actividades).join(", ")}</div>
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

                <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">OTs en esta mina:</div>
                <div className="space-y-1">
                  {selectedMina.ots.map((ot) => {
                    const color = ot.estado === "EN PROCESO" ? "bg-yellow-100 text-yellow-700" : ot.estado === "FINALIZADO" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700";
                    return (
                      <div key={ot.codigo} className="p-1.5 rounded border border-gray-200 flex items-center gap-2 hover:bg-gray-50">
                        <div className="text-[10px] font-mono font-bold text-gray-900 w-20">{ot.codigo}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-gray-900 truncate">{ot.cliente}</div>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold ${color}`}>{ot.estado.slice(0, 3)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="w-56 shrink-0 flex flex-col bg-white">
              <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-2">
                  <Info size={12} className="text-[#E91E63]" />
                  <span className="text-[10px] font-bold text-gray-700 uppercase">Dato Curioso</span>
                </div>
                <button onClick={() => setImgKey(prev => prev + 1)} className="p-1 text-gray-500 hover:text-[#E91E63] rounded hover:bg-gray-200" title="Recargar imagen">
                  <RefreshCw size={10} />
                </button>
              </div>
              <div className="h-28 relative overflow-hidden bg-gray-100">
                <img key={`${selectedMina.coord.ciudad}-${imgKey}`} src={`${selectedMina.coord.foto_ciudad}?t=${imgKey}`} alt={selectedMina.coord.ciudad} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <div className="absolute bottom-1 left-2 text-xs font-bold text-white bg-black/60 px-2 py-0.5 rounded">{selectedMina.coord.ciudad}</div>
              </div>
              <div className="flex-1 p-3 flex flex-col">
                <div className="text-[10px] text-gray-600 leading-relaxed flex-1">{selectedMina.coord.datoCurioso}</div>
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <div className="text-[9px] text-gray-400 uppercase tracking-wider">Región</div>
                  <div className="text-[10px] text-gray-700 font-semibold">{selectedMina.coord.region}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

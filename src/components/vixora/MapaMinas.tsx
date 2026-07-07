"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useStore } from "@/lib/store";
import { findMinaCoord, type MinaCoord } from "@/lib/minasData";
import type { OT } from "@/lib/types";
import { MapPin, Search, X } from "lucide-react";

interface MinaAgrupada {
  coord: MinaCoord;
  ots: OT[];
  enProceso: number;
  finalizado: number;
  pendiente: number;
  perdido: number;
  total: number;
}

export function MapaMinas() {
  const { ots, cronograma, tecnicos, actividades } = useStore();
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const [selectedMina, setSelectedMina] = useState<MinaAgrupada | null>(null);
  const [query, setQuery] = useState("");

  // Agrupar OTs por ubicación (sede)
  const minasAgrupadas = useMemo(() => {
    const grupos: Record<string, MinaAgrupada> = {};
    
    for (const ot of ots) {
      const coord = findMinaCoord(ot.sede);
      if (!coord) continue;
      
      const key = coord.nombre;
      if (!grupos[key]) {
        grupos[key] = {
          coord,
          ots: [],
          enProceso: 0,
          finalizado: 0,
          pendiente: 0,
          perdido: 0,
          total: 0,
        };
      }
      
      grupos[key].ots.push(ot);
      grupos[key].total++;
      
      const estado = ot.estado.toUpperCase();
      if (estado === "EN PROCESO") grupos[key].enProceso++;
      else if (estado === "FINALIZADO") grupos[key].finalizado++;
      else if (estado === "PENDIENTE") grupos[key].pendiente++;
      else if (estado === "PERDIDO") grupos[key].perdido++;
    }
    
    return Object.values(grupos).filter(g => g.total > 0);
  }, [ots]);

  // Filtrar por búsqueda
  const minasFiltradas = useMemo(() => {
    if (!query) return minasAgrupadas;
    const q = query.toLowerCase();
    return minasAgrupadas.filter(g => 
      g.coord.nombre.toLowerCase().includes(q) ||
      g.coord.region.toLowerCase().includes(q) ||
      g.ots.some(ot => ot.codigo.includes(q) || ot.cliente.toLowerCase().includes(q))
    );
  }, [minasAgrupadas, query]);

  // Inicializar mapa
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [-9.1900, -75.0152], // Centro del Perú
      zoom: 5,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 18,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Actualizar markers cuando cambian los datos
  useEffect(() => {
    if (!mapRef.current) return;

    // Limpiar markers anteriores
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    for (const mina of minasFiltradas) {
      const { coord, enProceso, finalizado, pendiente, perdido, total } = mina;
      
      // Color del marker según estado dominante
      let color = "#6b7280"; // gris por defecto
      if (enProceso > 0 && enProceso >= finalizado) color = "#f59e0b"; // amarillo
      else if (finalizado > 0) color = "#10b981"; // verde
      else if (perdido > 0) color = "#ef4444"; // rojo
      else if (pendiente > 0) color = "#3b82f6"; // azul
      
      // Tamaño según cantidad de OTs
      const radius = Math.min(8 + total * 2, 25);
      
      const marker = L.circleMarker([coord.lat, coord.lng], {
        radius,
        fillColor: color,
        color: "#ffffff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      }).addTo(mapRef.current!);

      // Popup con info
      const popupHtml = `
        <div style="font-family: -apple-system, sans-serif; min-width: 180px;">
          <div style="font-weight: bold; font-size: 13px; color: #1d1d1f; margin-bottom: 4px;">${coord.nombre}</div>
          <div style="font-size: 10px; color: #6e6e73; margin-bottom: 8px;">📍 ${coord.region}</div>
          <div style="display: flex; gap: 8px; font-size: 11px; flex-wrap: wrap;">
            <span style="color: #f59e0b;">⚡ ${enProceso}</span>
            <span style="color: #10b981;">✓ ${finalizado}</span>
            <span style="color: #3b82f6;">⏳ ${pendiente}</span>
            <span style="color: #ef4444;">✗ ${perdido}</span>
          </div>
          <div style="font-size: 10px; color: #999; margin-top: 6px;">Total: ${total} OT(s)</div>
        </div>
      `;
      marker.bindPopup(popupHtml);
      
      marker.on("click", () => {
        setSelectedMina(mina);
      });

      markersRef.current.push(marker);
    }
  }, [minasFiltradas]);

  // Hacer zoom a una mina seleccionada
  const zoomToMina = (mina: MinaAgrupada) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo([mina.coord.lat, mina.coord.lng], 8, { duration: 1.2 });
    setSelectedMina(mina);
  };

  // OT seleccionada para resaltar
  const [otResaltada, setOtResaltada] = useState<string | null>(null);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Panel lateral izquierdo: lista de minas */}
      <div className="w-80 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-3 border-b border-gray-200 bg-white shrink-0">
          <div className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            🗺️ Mapa de Minas
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar mina, OT o cliente..."
              className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-pink-400"
            />
          </div>
        </div>

        {/* Leyenda */}
        <div className="p-2 border-b border-gray-200 bg-gray-50 shrink-0">
          <div className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">Estado</div>
          <div className="flex gap-2 flex-wrap text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>En proceso</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>Finalizado</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>Pendiente</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>Perdido</span>
          </div>
        </div>

        {/* Lista de minas */}
        <div className="flex-1 overflow-y-auto">
          {minasFiltradas.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400">
              No se encontraron minas con OTs asignadas
            </div>
          ) : (
            minasFiltradas.map((mina) => (
              <div
                key={mina.coord.nombre}
                onClick={() => zoomToMina(mina)}
                className={`p-2 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                  selectedMina?.coord.nombre === mina.coord.nombre ? "bg-pink-50 border-l-2 border-l-[#E91E63]" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{
                      backgroundColor: mina.enProceso > 0 && mina.enProceso >= mina.finalizado ? "#f59e0b"
                        : mina.finalizado > 0 ? "#10b981"
                        : mina.perdido > 0 ? "#ef4444"
                        : mina.pendiente > 0 ? "#3b82f6"
                        : "#6b7280"
                    }}
                  />
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
          {minasFiltradas.length} mina(s) · {ots.length} OT(s)
        </div>
      </div>

      {/* Mapa + panel detalle */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mapa */}
        <div className="flex-1 relative">
          <div ref={containerRef} className="w-full h-full" style={{ minHeight: "400px" }} />
        </div>

        {/* Panel de detalle inferior */}
        {selectedMina && (
          <div className="h-64 shrink-0 bg-white border-t border-gray-200 flex flex-col">
            <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between" style={{ backgroundColor: "#1d1d1f" }}>
              <div>
                <div className="text-sm font-bold text-white">{selectedMina.coord.nombre}</div>
                <div className="text-[10px] text-white/60">📍 {selectedMina.coord.region}</div>
              </div>
              <button onClick={() => setSelectedMina(null)} className="text-white/60 hover:text-white p-1">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <div className="flex gap-3 mb-3 text-xs">
                <span className="text-yellow-600">⚡ {selectedMina.enProceso} en proceso</span>
                <span className="text-green-600">✓ {selectedMina.finalizado} finalizado</span>
                <span className="text-blue-600">⏳ {selectedMina.pendiente} pendiente</span>
                <span className="text-red-600">✗ {selectedMina.perdido} perdido</span>
              </div>
              <div className="space-y-1">
                {selectedMina.ots.map((ot) => {
                  // Buscar técnicos asignados a esta OT
                  const tecnicosAsignados = Object.values(cronograma)
                    .filter(e => e.ots_asignadas?.includes(ot.codigo))
                    .map(e => {
                      const t = tecnicos.find(t => t.id === e.tecnico_id);
                      return t ? { nombre: t.nombre, fecha: e.fecha } : null;
                    })
                    .filter(Boolean)
                    .slice(0, 3);

                  const color = ot.estado === "EN PROCESO" ? "bg-yellow-100 text-yellow-700"
                    : ot.estado === "FINALIZADO" ? "bg-green-100 text-green-700"
                    : ot.estado === "PENDIENTE" ? "bg-blue-100 text-blue-700"
                    : "bg-red-100 text-red-700";

                  return (
                    <div
                      key={ot.codigo}
                      className={`p-2 rounded border flex items-center gap-2 cursor-pointer hover:bg-gray-50 ${
                        otResaltada === ot.codigo ? "border-[#E91E63] bg-pink-50" : "border-gray-200"
                      }`}
                      onClick={() => setOtResaltada(otResaltada === ot.codigo ? null : ot.codigo)}
                    >
                      <div className="text-xs font-mono font-bold text-gray-900 w-24">{ot.codigo}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-900 truncate">{ot.cliente}</div>
                        {tecnicosAsignados.length > 0 && (
                          <div className="text-[10px] text-gray-500 truncate">
                            👤 {tecnicosAsignados.map(t => t?.nombre).join(", ")}
                          </div>
                        )}
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${color}`}>
                        {ot.estado.slice(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

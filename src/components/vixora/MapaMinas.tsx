"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useStore, formatFechaISO } from "@/lib/store";
import type { OT, Tecnico, Sede, EntradaCronograma } from "@/lib/types";
import { Search, X, Calendar, Info, RefreshCw, Check, Eye, EyeOff, ChevronDown, ChevronUp, Plus, Trash2, Settings, Save, Hash } from "lucide-react";

const ACTIVIDAD_SEDE_MAP: Record<string, string> = {
  "PROYECTO MC": "MARCOBRE",
  "PROYECTO ANT": "ANTAPACCAY",
};

interface MinaAgrupada {
  coord: Sede;
  ots: OT[];
  otsRealizandose: OT[];
  enProceso: number;
  finalizado: number;
  pendiente: number;
  perdido: number;
  cancelado: number;
  total: number;
  hasActividadEnRango: boolean;
}

interface TecnicoViaje {
  tecnico: Tecnico;
  fechaInicio: string;
  fechaFin: string;
  actividades: Set<string>;
  otsRealizadas: Set<string>;
  fechas: string[];
}

export function MapaMinas() {
  const {
    ots, cronograma, tecnicos, actividades, sedes,
    cargarDatosSilencioso, showToast,
    agregarSede, eliminarSede,
  } = useStore();

  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const groupMarkersRef = useRef<L.CircleMarker[]>([]);
  const badgesRef = useRef<L.Marker[]>([]);
  const [selectedMina, setSelectedMina] = useState<MinaAgrupada | null>(null);
  const [query, setQuery] = useState("");
  const [actualizando, setActualizando] = useState(false);
  const [imgKey, setImgKey] = useState(0);
  const [otsAsociadasExpandidas, setOtsAsociadasExpandidas] = useState(false);
  const [filtroFechasActivo, setFiltroFechasActivo] = useState(false);
  const [ocultarSinOts, setOcultarSinOts] = useState(false);
  const [panelSedesAbierto, setPanelSedesAbierto] = useState(false);
  const [mostrarContadores, setMostrarContadores] = useState(true);
  const [nuevaSede, setNuevaSede] = useState({ nombre: "", lat: "", lng: "", region: "", ciudad: "", datoCurioso: "", foto_ciudad: "" });
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<MinaAgrupada[] | null>(null);

  const hoy = new Date();
  const [inputInicio, setInputInicio] = useState(() => formatFechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
  const [inputFin, setInputFin] = useState(() => formatFechaISO(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)));
  const [fechaInicio, setFechaInicio] = useState(() => formatFechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
  const [fechaFin, setFechaFin] = useState(() => formatFechaISO(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)));

  const actividadesRojas = useMemo(() => {
    return new Set(actividades.filter(a => a.color === "rojo").map(a => a.nombre));
  }, [actividades]);

  const handleActualizar = async () => {
    setActualizando(true);
    await cargarDatosSilencioso();
    setActualizando(false);
  };

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

  const todasLasSedes = useMemo(() => {
    return sedes.map(s => ({ ...s, visible: s.visible ?? true }));
  }, [sedes]);

  const otsValidas = useMemo(() => {
    return ots.filter(o => o.visible_mapa !== false);
  }, [ots]);

  const otMap = useMemo(() => {
    const m: Record<string, OT> = {};
    ots.forEach(o => { m[o.codigo] = o; });
    return m;
  }, [ots]);

  const buscarSede = (texto: string): Sede | null => {
    if (!texto) return null;
    const textoUpper = texto.toUpperCase().trim();
    if (!textoUpper) return null;

    let found = todasLasSedes.find(s => s.nombre.toUpperCase() === textoUpper);
    if (found) return found;

    const tokens = textoUpper.split(/[\s,;:.\/\\\-|()]+/).filter(t => t.length >= 3);
    if (tokens.length === 0) return null;

    for (const s of todasLasSedes) {
      const nombreUpper = s.nombre.toUpperCase();
      const sedeTokens = nombreUpper.split(/[\s,;:.\/\\\-|()]+/).filter(t => t.length >= 3);
      for (const tk of sedeTokens) {
        if (tokens.includes(tk)) return s;
      }
    }

    for (const s of todasLasSedes) {
      const nombreUpper = s.nombre.toUpperCase();
      if (nombreUpper.length <= 6 && (textoUpper.includes(nombreUpper) || nombreUpper.includes(textoUpper))) {
        return s;
      }
    }
    return null;
  };

  const getSedesForEntry = (e: EntradaCronograma): Set<string> => {
    const sedesForEntry = new Set<string>();
    const sedeFromActividad = ACTIVIDAD_SEDE_MAP[e.actividad.toUpperCase()];
    if (sedeFromActividad) {
      const existe = todasLasSedes.find(s => s.nombre.toUpperCase() === sedeFromActividad.toUpperCase());
      if (existe) sedesForEntry.add(existe.nombre);
    }
    if (e.ots_asignadas && e.ots_asignadas !== "—") {
      const codigos = e.ots_asignadas.split(",").map(s => s.trim());
      for (const cod of codigos) {
        const ot = otMap[cod];
        if (ot) {
          const coord = buscarSede(ot.sede) || buscarSede(ot.cliente);
          if (coord) sedesForEntry.add(coord.nombre);
        }
      }
    }
    return sedesForEntry;
  };

  const minasAgrupadas = useMemo(() => {
    const grupos: Record<string, MinaAgrupada> = {};
    for (const sede of todasLasSedes) {
      grupos[sede.nombre] = { coord: sede, ots: [], otsRealizandose: [], enProceso: 0, finalizado: 0, pendiente: 0, perdido: 0, cancelado: 0, total: 0, hasActividadEnRango: false };
    }

    for (const ot of otsValidas) {
      const coord = buscarSede(ot.sede) || buscarSede(ot.cliente);
      if (!coord) continue;
      const key = coord.nombre;
      if (!grupos[key]) grupos[key] = { coord, ots: [], otsRealizandose: [], enProceso: 0, finalizado: 0, pendiente: 0, perdido: 0, cancelado: 0, total: 0, hasActividadEnRango: false };
      grupos[key].ots.push(ot);
      grupos[key].total++;
      const estado = (ot.estado || "").toUpperCase();
      if (estado === "EN PROCESO") grupos[key].enProceso++;
      else if (estado === "FINALIZADO") grupos[key].finalizado++;
      else if (estado === "PENDIENTE") grupos[key].pendiente++;
      else if (estado === "PERDIDO") grupos[key].perdido++;
      else if (estado === "CANCELADO") grupos[key].cancelado++;
    }

    const otsRealizandoseBySede: Record<string, Set<string>> = {};
    const sedesConActividadEnRango = new Set<string>();
    for (const e of Object.values(cronograma)) {
      if (e.fecha < fechaInicio || e.fecha > fechaFin) continue;
      if (!actividadesRojas.has(e.actividad)) continue;
      const sedesForEntry = getSedesForEntry(e);
      sedesForEntry.forEach(s => sedesConActividadEnRango.add(s));
      if (e.ots_asignadas && e.ots_asignadas !== "—") {
        const codigos = e.ots_asignadas.split(",").map(s => s.trim());
        for (const sedeName of sedesForEntry) {
          if (!otsRealizandoseBySede[sedeName]) otsRealizandoseBySede[sedeName] = new Set();
          codigos.forEach(c => otsRealizandoseBySede[sedeName].add(c));
        }
      }
    }

    Object.values(grupos).forEach(g => {
      const codigosRealizandose = otsRealizandoseBySede[g.coord.nombre] || new Set<string>();
      g.otsRealizandose = Array.from(codigosRealizandose)
        .map(cod => otMap[cod])
        .filter((o): o is OT => !!o);
      g.hasActividadEnRango = sedesConActividadEnRango.has(g.coord.nombre);
    });

    return Object.values(grupos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otsValidas, todasLasSedes, cronograma, fechaInicio, fechaFin, actividadesRojas, otMap]);

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

  const gruposCercanos = useMemo(() => {
    const grupos: MinaAgrupada[][] = [];
    const umbral = 0.05;

    for (const mina of minasParaMapa) {
      let agregada = false;
      for (const grupo of grupos) {
        const primera = grupo[0];
        const dist = Math.sqrt(
          Math.pow(mina.coord.lat - primera.coord.lat, 2) +
          Math.pow(mina.coord.lng - primera.coord.lng, 2)
        );
        if (dist < umbral) {
          grupo.push(mina);
          agregada = true;
          break;
        }
      }
      if (!agregada) {
        grupos.push([mina]);
      }
    }
    return grupos;
  }, [minasParaMapa]);

  const getTecnicosEnMina = (mina: MinaAgrupada): TecnicoViaje[] => {
    const entriesByTecnico: Record<string, { fecha: string; actividad: string; ots: string[] }[]> = {};
    for (const e of Object.values(cronograma)) {
      if (!actividadesRojas.has(e.actividad)) continue;
      const sedesForEntry = getSedesForEntry(e);
      if (!sedesForEntry.has(mina.coord.nombre)) continue;
      const tecnico = tecnicos.find(t => t.id === e.tecnico_id);
      if (!tecnico || !tecnico.activo) continue;
      if (!entriesByTecnico[tecnico.id]) entriesByTecnico[tecnico.id] = [];
      const codigos = e.ots_asignadas && e.ots_asignadas !== "—"
        ? e.ots_asignadas.split(",").map(s => s.trim())
        : [];
      entriesByTecnico[tecnico.id].push({ fecha: e.fecha, actividad: e.actividad, ots: codigos });
    }

    const viajes: TecnicoViaje[] = [];
    for (const [tecId, entries] of Object.entries(entriesByTecnico)) {
      entries.sort((a, b) => a.fecha.localeCompare(b.fecha));
      const trips: { fecha: string; actividad: string; ots: string[] }[][] = [];
      let currentTrip: { fecha: string; actividad: string; ots: string[] }[] = [];
      let prevDate: string | null = null;
      for (const entry of entries) {
        if (prevDate) {
          const prev = new Date(prevDate + "T00:00:00");
          const curr = new Date(entry.fecha + "T00:00:00");
          const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays > 1) {
            if (currentTrip.length > 0) trips.push(currentTrip);
            currentTrip = [];
          }
        }
        currentTrip.push(entry);
        prevDate = entry.fecha;
      }
      if (currentTrip.length > 0) trips.push(currentTrip);

      for (const trip of trips) {
        const tripHasDateInRange = trip.some(e => e.fecha >= fechaInicio && e.fecha <= fechaFin);
        if (!tripHasDateInRange) continue;
        const fechas = trip.map(e => e.fecha).sort();
        const actividadesTrip = new Set<string>();
        const otsRealizadasTrip = new Set<string>();
        for (const e of trip) {
          actividadesTrip.add(e.actividad);
          e.ots.forEach(o => otsRealizadasTrip.add(o));
        }
        const tec = tecnicos.find(t => t.id === tecId);
        if (!tec) continue;
        viajes.push({
          tecnico: tec,
          fechaInicio: fechas[0],
          fechaFin: fechas[fechas.length - 1],
          actividades: actividadesTrip,
          otsRealizadas: otsRealizadasTrip,
          fechas,
        });
      }
    }
    return viajes.sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
  };

  // FIX: Función rápida para contar técnicos en una sede para la lista del sidebar
  const contarTecnicosEnSede = (mina: MinaAgrupada): number => {
    let count = 0;
    const codigosOtDeSede = new Set(mina.ots.map(o => o.codigo));
    for (const e of Object.values(cronograma)) {
      if (e.fecha < fechaInicio || e.fecha > fechaFin) continue;
      if (!actividadesRojas.has(e.actividad)) continue;
      if (e.ots_asignadas && e.ots_asignadas !== "—") {
        const codigos = e.ots_asignadas.split(",").map(s => s.trim());
        if (codigos.some(c => codigosOtDeSede.has(c))) {
          count++;
        }
      }
    }
    // Eliminar duplicados de técnico (un técnico cuenta como 1 aunque tenga varias OTs ese día)
    const tecnicosUnicos = new Set<string>();
    for (const e of Object.values(cronograma)) {
      if (e.fecha < fechaInicio || e.fecha > fechaFin) continue;
      if (!actividadesRojas.has(e.actividad)) continue;
      if (e.ots_asignadas && e.ots_asignadas !== "—") {
        const codigos = e.ots_asignadas.split(",").map(s => s.trim());
        if (codigos.some(c => codigosOtDeSede.has(c))) {
          tecnicosUnicos.add(e.tecnico_id);
        }
      }
    }
    return tecnicosUnicos.size;
  };

  const handleToggleVisibleSede = async (nombre: string) => {
    const sede = todasLasSedes.find(s => s.nombre === nombre);
    if (!sede) return;
    const isVisible = sede.visible ?? true;
    const { toggleSedeVisible } = useStore.getState();
    await toggleSedeVisible(nombre, !isVisible);
    showToast(`Sede ${!isVisible ? 'visible' : 'oculta'}`, "ok");
  };

  const handleAgregarSede = async () => {
    if (!nuevaSede.nombre || !nuevaSede.lat || !nuevaSede.lng) {
      showToast("Nombre, lat y lng son obligatorios", "error");
      return;
    }
    const ok = await agregarSede({
      nombre: nuevaSede.nombre,
      lat: parseFloat(nuevaSede.lat),
      lng: parseFloat(nuevaSede.lng),
      region: nuevaSede.region,
      ciudad: nuevaSede.ciudad,
      datoCurioso: nuevaSede.datoCurioso,
      foto_ciudad: nuevaSede.foto_ciudad,
    });
    if (ok) {
      setNuevaSede({ nombre: "", lat: "", lng: "", region: "", ciudad: "", datoCurioso: "", foto_ciudad: "" });
    }
  };

  const handleEliminarSede = async (nombre: string) => {
    if (!confirm(`¿Eliminar la sede ${nombre} del Excel y del mapa?`)) return;
    await eliminarSede(nombre);
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [-9.1900, -75.0152], zoom: 5, zoomControl: true, scrollWheelZoom: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 18 }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  const crearBadgeIcon = (total: number, radius: number): L.DivIcon => {
    const badgeSize = Math.max(14, Math.min(radius + 4, 18));
    return L.divIcon({
      className: 'ot-badge-icon',
      html: `<div style="
        width: ${badgeSize}px;
        height: ${badgeSize}px;
        background: #ffffff;
        border: 1.5px solid #1d1d1f;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${Math.max(9, badgeSize - 5)}px;
        font-weight: 700;
        color: #1d1d1f;
        font-family: -apple-system, system-ui, sans-serif;
        box-shadow: 0 1px 2px rgba(0,0,0,0.2);
        line-height: 1;
      ">${total}</div>`,
      iconSize: [badgeSize, badgeSize],
      iconAnchor: [badgeSize - 2, badgeSize - 2],
    });
  };

  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach(m => m.remove());
    groupMarkersRef.current.forEach(m => m.remove());
    badgesRef.current.forEach(m => m.remove());
    markersRef.current = [];
    groupMarkersRef.current = [];
    badgesRef.current = [];

    const getColor = (g: MinaAgrupada) => {
      if (g.total === 0) return "#6b7280";
      if (g.enProceso > 0 && g.enProceso >= g.finalizado) return "#f59e0b";
      if (g.finalizado > 0) return "#10b981";
      if (g.pendiente > 0) return "#3b82f6";
      if (g.perdido > 0) return "#6b7280";
      if (g.cancelado > 0) return "#9ca3af";
      return "#6b7280";
    };

    const getRadius = (total: number) => {
      if (total === 0) return 5;
      return Math.min(6 + total, 14);
    };

    for (const grupo of gruposCercanos) {
      if (grupo.length === 1) {
        const mina = grupo[0];
        const { coord, enProceso, finalizado, pendiente, perdido, cancelado, total } = mina;
        const color = getColor(mina);
        const radius = getRadius(total);

        const marker = L.circleMarker([coord.lat, coord.lng], {
          radius,
          fillColor: color,
          color: "#ffffff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.85
        }).addTo(mapRef.current!);

        const popupHtml = `<div style="font-family: -apple-system, sans-serif; min-width: 180px;"><div style="font-weight: bold; font-size: 13px; color: #1d1d1f; margin-bottom: 4px;">${coord.nombre}</div><div style="font-size: 10px; color: #6e6e73; margin-bottom: 8px;">📍 ${coord.region}</div><div style="display: flex; gap: 8px; font-size: 11px; flex-wrap: wrap;"><span style="color: #f59e0b;">⚡ ${enProceso}</span><span style="color: #10b981;">✓ ${finalizado}</span><span style="color: #3b82f6;">⏳ ${pendiente}</span><span style="color: #6b7280;">⚫ ${perdido}</span><span style="color: #9ca3af;">⊘ ${cancelado}</span></div><div style="font-size: 10px; color: #999; margin-top: 6px;">Total: ${total} OT(s)</div></div>`;
        marker.bindPopup(popupHtml);
        marker.on("click", () => {
          setSelectedMina(mina);
          setOtsAsociadasExpandidas(false);
        });
        markersRef.current.push(marker);

        if (total > 0 && mostrarContadores) {
          const badgeIcon = crearBadgeIcon(total, radius);
          const badgeMarker = L.marker([coord.lat, coord.lng], {
            icon: badgeIcon,
            interactive: false,
            zIndexOffset: 1000,
          }).addTo(mapRef.current!);
          badgesRef.current.push(badgeMarker);
        }
      } else {
        const primera = grupo[0];
        const totalOts = grupo.reduce((sum, g) => sum + g.total, 0);
        const totalEnProceso = grupo.reduce((sum, g) => sum + g.enProceso, 0);
        const totalFinalizado = grupo.reduce((sum, g) => sum + g.finalizado, 0);
        const totalPendiente = grupo.reduce((sum, g) => sum + g.pendiente, 0);
        const totalPerdido = grupo.reduce((sum, g) => sum + g.perdido, 0);
        const totalCancelado = grupo.reduce((sum, g) => sum + g.cancelado, 0);

        let color = "#6b7280";
        if (totalEnProceso > 0) color = "#f59e0b";
        else if (totalFinalizado > 0) color = "#10b981";
        else if (totalPendiente > 0) color = "#3b82f6";

        const radius = Math.min(8 + totalOts * 0.5, 16);

        const marker = L.circleMarker([primera.coord.lat, primera.coord.lng], {
          radius,
          fillColor: color,
          color: "#ffffff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.85
        }).addTo(mapRef.current!);

        const popupHtml = `<div style="font-family: -apple-system, sans-serif; min-width: 200px;"><div style="font-weight: bold; font-size: 13px; color: #1d1d1f; margin-bottom: 4px;">📍 ${grupo.length} sedes en esta ubicación</div><div style="font-size: 10px; color: #6e6e73; margin-bottom: 8px;">Click para ver el listado</div><div style="display: flex; gap: 8px; font-size: 11px; flex-wrap: wrap;"><span style="color: #f59e0b;">⚡ ${totalEnProceso}</span><span style="color: #10b981;">✓ ${totalFinalizado}</span><span style="color: #3b82f6;">⏳ ${totalPendiente}</span><span style="color: #6b7280;">⚫ ${totalPerdido}</span><span style="color: #9ca3af;">⊘ ${totalCancelado}</span></div><div style="font-size: 10px; color: #999; margin-top: 6px;">Total: ${totalOts} OT(s)</div></div>`;
        marker.bindPopup(popupHtml);
        marker.on("click", () => {
          setGrupoSeleccionado(grupo);
        });
        groupMarkersRef.current.push(marker);

        if (totalOts > 0 && mostrarContadores) {
          const badgeIcon = crearBadgeIcon(totalOts, radius);
          const badgeMarker = L.marker([primera.coord.lat, primera.coord.lng], {
            icon: badgeIcon,
            interactive: false,
            zIndexOffset: 1000,
          }).addTo(mapRef.current!);
          badgesRef.current.push(badgeMarker);
        }
      }
    }
  }, [gruposCercanos, mostrarContadores]);

  const zoomToMina = (mina: MinaAgrupada) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo([mina.coord.lat, mina.coord.lng], 8, { duration: 1.2 });
    setSelectedMina(mina);
    setOtsAsociadasExpandidas(false);
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
    const e = (estado || "").toUpperCase();
    if (e === "EN PROCESO") return "bg-yellow-100 text-yellow-700";
    if (e === "FINALIZADO") return "bg-green-100 text-green-700";
    if (e === "PENDIENTE") return "bg-blue-100 text-blue-700";
    if (e === "PERDIDO") return "bg-gray-200 text-gray-700";
    if (e === "CANCELADO") return "bg-gray-100 text-gray-500";
    return "bg-gray-100 text-gray-700";
  };

  return (
    <div className="flex h-full overflow-hidden relative">
      <div className="w-72 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-3 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">🗺️ Mapa de Minas</div>
            <div className="flex gap-1">
              <button
                onClick={() => setMostrarContadores(!mostrarContadores)}
                className={`p-1 rounded ${mostrarContadores ? "text-[#E91E63] bg-pink-50" : "text-gray-400 hover:text-gray-600"}`}
                title={mostrarContadores ? "Ocultar contadores de OTs" : "Mostrar contadores de OTs"}
              >
                <Hash size={14} />
              </button>
              <button
                onClick={() => setPanelSedesAbierto(!panelSedesAbierto)}
                className={`p-1 rounded ${panelSedesAbierto ? "text-[#E91E63] bg-pink-50" : "text-gray-500 hover:text-[#E91E63]"}`}
                title="Gestionar sedes"
              >
                <Settings size={14} />
              </button>
              <button onClick={handleActualizar} disabled={actualizando} className="p-1 text-gray-500 hover:text-[#E91E63] disabled:opacity-50" title="Actualizar datos">
                <RefreshCw size={14} className={actualizando ? "animate-spin" : ""} />
              </button>
            </div>
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
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-500"></span>Perdido</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span>Cancelado</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {minasFiltradasLista.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400">No hay sedes que coincidan</div>
          ) : (
            minasFiltradasLista.map((mina) => {
              const isVisible = mina.coord.visible !== false;
              const numTecnicos = filtroFechasActivo ? contarTecnicosEnSede(mina) : 0;
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
                      <div className="text-[10px] text-gray-500 truncate">
                        {filtroFechasActivo 
                          ? `${mina.otsRealizandose.length} OTs · ${numTecnicos} Técnicos` 
                          : `${mina.total} OTs`}
                      </div>
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

      <div className="flex-1 flex flex-col min-w-0 relative">
        <div className="flex-1 relative">
          <div ref={containerRef} className="w-full h-full" style={{ minHeight: "400px" }} />
        </div>

        {panelSedesAbierto && (
          <div className="absolute top-2 right-2 w-80 bg-white rounded-lg shadow-2xl border border-gray-200 z-[1000] max-h-[calc(100%-2rem)] flex flex-col">
            <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between" style={{ backgroundColor: "#1d1d1f" }}>
              <div className="text-xs font-bold text-white uppercase">Gestionar Sedes</div>
              <button onClick={() => setPanelSedesAbierto(false)} className="text-white/60 hover:text-white"><X size={14} /></button>
            </div>
            <div className="p-3 overflow-y-auto flex-1">
              <div className="text-[10px] font-bold text-gray-500 uppercase mb-2">Añadir nueva sede</div>
              <div className="space-y-1 mb-3">
                <input type="text" placeholder="Nombre *" value={nuevaSede.nombre} onChange={(e) => setNuevaSede({...nuevaSede, nombre: e.target.value})} className="w-full px-2 py-1 text-[10px] border border-gray-200 rounded" />
                <div className="flex gap-1">
                  <input type="number" step="any" placeholder="Lat *" value={nuevaSede.lat} onChange={(e) => setNuevaSede({...nuevaSede, lat: e.target.value})} className="flex-1 px-2 py-1 text-[10px] border border-gray-200 rounded" />
                  <input type="number" step="any" placeholder="Lng *" value={nuevaSede.lng} onChange={(e) => setNuevaSede({...nuevaSede, lng: e.target.value})} className="flex-1 px-2 py-1 text-[10px] border border-gray-200 rounded" />
                </div>
                <input type="text" placeholder="Región" value={nuevaSede.region} onChange={(e) => setNuevaSede({...nuevaSede, region: e.target.value})} className="w-full px-2 py-1 text-[10px] border border-gray-200 rounded" />
                <input type="text" placeholder="Ciudad" value={nuevaSede.ciudad} onChange={(e) => setNuevaSede({...nuevaSede, ciudad: e.target.value})} className="w-full px-2 py-1 text-[10px] border border-gray-200 rounded" />
                <input type="text" placeholder="URL Foto" value={nuevaSede.foto_ciudad} onChange={(e) => setNuevaSede({...nuevaSede, foto_ciudad: e.target.value})} className="w-full px-2 py-1 text-[10px] border border-gray-200 rounded" />
                <textarea placeholder="Dato curioso" value={nuevaSede.datoCurioso} onChange={(e) => setNuevaSede({...nuevaSede, datoCurioso: e.target.value})} rows={2} className="w-full px-2 py-1 text-[10px] border border-gray-200 rounded resize-none" />
                <button onClick={handleAgregarSede} className="w-full flex items-center justify-center gap-1 py-1 text-[10px] text-white bg-[#E91E63] rounded hover:bg-[#c2185b]">
                  <Plus size={10} /> Añadir sede
                </button>
              </div>

              <div className="text-[10px] font-bold text-gray-500 uppercase mb-2 mt-3">Sedes actuales ({todasLasSedes.length})</div>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {todasLasSedes.map(s => (
                  <div key={s.nombre} className="p-1.5 border border-gray-200 rounded flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold text-gray-900 truncate">{s.nombre}</div>
                      <div className="text-[9px] text-gray-500">{s.region}</div>
                    </div>
                    <button
                      onClick={() => handleEliminarSede(s.nombre)}
                      className="p-1 rounded text-red-600 hover:bg-red-100"
                      title="Eliminar sede"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="text-[9px] text-gray-400 italic mt-2">
                💡 Los cambios se sincronizan automáticamente con el panel de Admin y el Excel.
              </div>
            </div>
          </div>
        )}

        {grupoSeleccionado && (
          <div className="absolute top-2 right-2 w-80 bg-white rounded-lg shadow-2xl border-2 border-[#E91E63] z-[1001] max-h-[calc(100%-2rem)] flex flex-col">
            <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between" style={{ backgroundColor: "#E91E63" }}>
              <div className="text-xs font-bold text-white uppercase">{grupoSeleccionado.length} sedes en esta ubicación</div>
              <button onClick={() => setGrupoSeleccionado(null)} className="text-white/80 hover:text-white"><X size={14} /></button>
            </div>
            <div className="p-2 overflow-y-auto flex-1">
              <div className="text-[10px] text-gray-500 mb-2">Selecciona una sede para ver detalle:</div>
              {grupoSeleccionado.map(mina => (
                <button
                  key={mina.coord.nombre}
                  onClick={() => {
                    setSelectedMina(mina);
                    setOtsAsociadasExpandidas(false);
                    setGrupoSeleccionado(null);
                  }}
                  className="w-full p-2 text-left border border-gray-200 rounded hover:bg-pink-50 mb-1"
                >
                  <div className="text-xs font-bold text-gray-900">{mina.coord.nombre}</div>
                  <div className="text-[10px] text-gray-500">{mina.coord.region}</div>
                  <div className="flex gap-2 mt-1 text-[9px]">
                    <span className="text-yellow-600">⚡ {mina.enProceso}</span>
                    <span className="text-green-600">✓ {mina.finalizado}</span>
                    <span className="text-blue-600">⏳ {mina.pendiente}</span>
                    <span className="text-gray-500">⚫ {mina.perdido}</span>
                    <span className="text-gray-400">⊘ {mina.cancelado}</span>
                    <span className="text-gray-600 ml-auto font-bold">Total: {mina.total}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

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
                <div className="flex gap-3 mb-3 text-xs flex-wrap">
                  <span className="text-yellow-600">⚡ {selectedMina.enProceso}</span>
                  <span className="text-green-600">✓ {selectedMina.finalizado}</span>
                  <span className="text-blue-600">⏳ {selectedMina.pendiente}</span>
                  <span className="text-gray-600">⚫ {selectedMina.perdido}</span>
                  <span className="text-gray-500">⊘ {selectedMina.cancelado}</span>
                  <span className="text-gray-400 ml-auto">Total: {selectedMina.total}</span>
                </div>

                {(() => {
                  const viajes = getTecnicosEnMina(selectedMina);
                  const plural = viajes.length !== 1 ? 's' : '';
                  return (
                    <>
                      <div className="text-[10px] font-bold text-gray-500 uppercase mb-1 mt-2">
                        Técnicos en sede ({viajes.length} viaje{plural}):
                      </div>
                      <div className="space-y-1 mb-3">
                        {viajes.length === 0 && <p className="text-[10px] text-gray-400 italic">No hay técnicos en estas fechas</p>}
                        {viajes.map((v, i) => (
                          <div key={`${v.tecnico.id}-${i}`} className="p-1.5 bg-gray-50 rounded">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full overflow-hidden border-2 border-[#E91E63] bg-gray-200 shrink-0">
                                {v.tecnico.foto_url ? (
                                  <img src={v.tecnico.foto_url} alt={v.tecnico.nombre} className="w-full h-full object-cover" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-gray-500">{getIniciales(v.tecnico.nombre)}</div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-gray-900 truncate">{v.tecnico.nombre}</div>
                                <div className="text-[10px] text-gray-500 truncate">
                                  {Array.from(v.actividades).join(", ")}
                                </div>
                              </div>
                              <div className="text-[10px] text-gray-600 shrink-0 font-medium">
                                {v.fechaInicio === v.fechaFin ? fmtFecha(v.fechaInicio) : `${fmtFecha(v.fechaInicio)} → ${fmtFecha(v.fechaFin)}`}
                              </div>
                            </div>
                            {v.otsRealizadas.size > 0 && (
                              <div className="mt-1 pl-9 flex flex-wrap gap-1">
                                {Array.from(v.otsRealizadas).map(cod => {
                                  const ot = otMap[cod];
                                  const color = getEstadoColor(ot?.estado || "");
                                  return (
                                    <span key={cod} className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold ${color}`}>
                                      {cod}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}

                <div className="text-[10px] font-bold text-gray-500 uppercase mb-1 flex items-center justify-between mt-3">
                  <span>OTs asociadas a la sede ({selectedMina.ots.length}):</span>
                  <button onClick={() => setOtsAsociadasExpandidas(!otsAsociadasExpandidas)} className="p-0.5 hover:bg-gray-200 rounded">
                    {otsAsociadasExpandidas ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>
                {otsAsociadasExpandidas && (
                  <div className="space-y-1">
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

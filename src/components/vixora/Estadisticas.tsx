"use client";

import { useStore } from "@/lib/store";
import { COLOR_HEX, type Tecnico, type Actividad, type CronogramaMap, type OT } from "@/lib/types";
import { useMemo, useState } from "react";
import { RefreshCw, Search, TrendingUp, Users, Briefcase, Calendar } from "lucide-react";
import { formatFechaISO } from "@/lib/store";

interface Props {
  tecnicos: Tecnico[];
  actividades: Actividad[];
  cronograma: CronogramaMap;
  ots: OT[];
}

const MESES_ES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function Estadisticas({ tecnicos, actividades, cronograma, ots }: Props) {
  const { cargarDatos } = useStore();
  const [hoy] = useState(() => new Date());
  const [inputInicio, setInputInicio] = useState<string>("");
  const [inputFin, setInputFin] = useState<string>("");
  const [rangoAplicado, setRangoAplicado] = useState<{ inicio: string; fin: string }>({ inicio: "", fin: "" });
  const [actualizando, setActualizando] = useState(false);
  const [vistaSecundaria, setVistaSecundaria] = useState<"porTecnico" | "porActividad" | "porDia">("porTecnico");

  const handleActualizar = async () => {
    setActualizando(true);
    await cargarDatos();
    setActualizando(false);
  };

  const handleAplicarRango = () => setRangoAplicado({ inicio: inputInicio, fin: inputFin });
  const handleLimpiarRango = () => {
    setInputInicio("");
    setInputFin("");
    setRangoAplicado({ inicio: "", fin: "" });
  };

  const stats = useMemo(() => {
    const activos = tecnicos.filter((t) => t.activo);
    const total = activos.length;

    let entries = Object.values(cronograma);
    let periodoLabel = `${MESES_ES[hoy.getMonth()]} ${hoy.getFullYear()}`;
    let diasPeriodo = 0;

    if (rangoAplicado.inicio && rangoAplicado.fin) {
      entries = entries.filter((e) => e.fecha >= rangoAplicado.inicio && e.fecha <= rangoAplicado.fin);
      const diff = Math.round((new Date(rangoAplicado.fin).getTime() - new Date(rangoAplicado.inicio).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      diasPeriodo = diff > 0 ? diff : 1;
      periodoLabel = `${rangoAplicado.inicio.split("-").reverse().join("/")} → ${rangoAplicado.fin.split("-").reverse().join("/")}`;
    } else {
      const year = hoy.getFullYear();
      const month = hoy.getMonth();
      entries = entries.filter((e) => {
        const [y, m] = e.fecha.split("-").map(Number);
        return y === year && m === month + 1;
      });
      diasPeriodo = new Date(year, month + 1, 0).getDate();
    }

    const distColor: Record<string, number> = { rojo: 0, amarillo: 0, verde: 0 };
    for (const e of entries) {
      const a = actividades.find((x) => x.nombre === e.actividad);
      if (a) distColor[a.color]++;
    }

    const porTecnico: Record<string, number> = {};
    for (const e of entries) porTecnico[e.tecnico_id] = (porTecnico[e.tecnico_id] ?? 0) + 1;

    const cargaMax = total * diasPeriodo;
    const cargaActual = entries.length;
    const cargaPct = cargaMax > 0 ? Math.round((cargaActual / cargaMax) * 100) : 0;
    const sobrecarga = activos.filter((t) => (porTecnico[t.id] ?? 0) > 22);

    let enProyecto = 0, enOficina = 0, disponibles = 0;
    const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
    for (const t of activos) {
      const entry = cronograma[`${t.id}|${hoyIso}`];
      if (!entry) disponibles++;
      else if (entry.actividad.includes("PROYECTO") || entry.actividad.includes("SERV.")) enProyecto++;
      else if (entry.actividad === "OFICINA") enOficina++;
      else disponibles++;
    }

    const otCount: Record<string, number> = {};
    for (const e of entries) {
      if (e.ots_asignadas && e.ots_asignadas !== "—") {
        for (const cod of e.ots_asignadas.split(",").map((s) => s.trim()).filter(Boolean)) {
          otCount[cod] = (otCount[cod] ?? 0) + 1;
        }
      }
    }
    const statsPorOt = Object.entries(otCount).map(([codigo, count]) => ({ codigo, count })).sort((a, b) => b.count - a.count).slice(0, 10);

    const actCount: Record<string, number> = {};
    for (const e of entries) actCount[e.actividad] = (actCount[e.actividad] ?? 0) + 1;
    const statsPorActividad = Object.entries(actCount).map(([nombre, count]) => ({ nombre, count })).sort((a, b) => b.count - a.count);

    const diaCount: Record<string, number> = {};
    for (const e of entries) diaCount[e.fecha] = (diaCount[e.fecha] ?? 0) + 1;
    const statsPorDia = Object.entries(diaCount).map(([fecha, count]) => ({ fecha, count })).sort((a, b) => a.fecha.localeCompare(b.fecha));

    const statsPorTecnicoLista = activos.map((t) => ({ tecnico: t, count: porTecnico[t.id] ?? 0 })).sort((a, b) => b.count - a.count);

    // Heatmap data
    const yearActual = hoy.getFullYear();
    const heatmapData: Record<string, number> = {};
    for (const e of Object.values(cronograma)) {
      if (e.fecha.startsWith(`${yearActual}-`)) {
        heatmapData[e.fecha] = (heatmapData[e.fecha] ?? 0) + 1;
      }
    }
    const maxHeat = Math.max(...Object.values(heatmapData), 1);

    return {
      total, totalEntries: entries.length, distColor, porTecnico, cargaPct, sobrecarga,
      enProyecto, enOficina, disponibles, statsPorOt, statsPorActividad, statsPorDia,
      statsPorTecnicoLista, periodoLabel, heatmapData, maxHeat, yearActual,
    };
  }, [tecnicos, cronograma, actividades, ots, hoy, rangoAplicado]);

  const donaPct = (n: number) => Math.round((n / (stats.total || 1)) * 100);
  const totalDona = stats.enProyecto + stats.enOficina + stats.disponibles || 1;
  const angProy = (stats.enProyecto / totalDona) * 360;
  const angOfi = (stats.enOficina / totalDona) * 360;

  const arco = (inicio: number, fin: number) => {
    const r = 70, cx = 80, cy = 80;
    const iRad = ((inicio - 90) * Math.PI) / 180;
    const fRad = ((fin - 90) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(iRad), y1 = cy + r * Math.sin(iRad);
    const x2 = cx + r * Math.cos(fRad), y2 = cy + r * Math.sin(fRad);
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${fin - inicio > 180 ? 1 : 0} 1 ${x2} ${y2} Z`;
  };

  const gaugeCirc = 2 * Math.PI * 60;
  const gaugeOffset = gaugeCirc - (stats.cargaPct / 100) * gaugeCirc;

  // Generar semanas para heatmap (formato GitHub)
  const weeks = useMemo(() => {
    const wks: (Date | null)[][] = [];
    let currentWeek: (Date | null)[] = [];
    const jan1 = new Date(stats.yearActual, 0, 1);
    const startDayOfWeek = jan1.getDay(); // 0=Dom, 1=Lun...
    const offset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    
    for (let i = 0; i < offset; i++) currentWeek.push(null);
    
    for (let m = 0; m < 12; m++) {
      const last = new Date(stats.yearActual, m + 1, 0).getDate();
      for (let d = 1; d <= last; d++) {
        currentWeek.push(new Date(stats.yearActual, m, d));
        if (currentWeek.length === 7) {
          wks.push(currentWeek);
          currentWeek = [];
        }
      }
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      wks.push(currentWeek);
    }
    return wks;
  }, [stats.yearActual]);

  const getHeatColor = (count: number) => {
    if (count === 0) return "#ebedf0";
    const intensity = count / stats.maxHeat;
    if (intensity > 0.75) return "#b3261e";
    if (intensity > 0.5) return "#e53935";
    if (intensity > 0.25) return "#ff8a80";
    return "#ffcdd2";
  };

  const colorLabels: Record<string, string> = {
    rojo: "Inamovible",
    amarillo: "Spot",
    verde: "Backlog",
  };

  return (
    <div className="p-6 max-w-7xl mx-auto overflow-y-auto h-full">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard Ejecutivo</h2>
          <p className="text-sm text-gray-500">{stats.periodoLabel}</p>
        </div>
        <button onClick={handleActualizar} disabled={actualizando} className="flex items-center gap-1 px-3 py-1.5 text-xs text-white rounded bg-[#E91E63] hover:bg-[#c2185b] disabled:opacity-50">
          <RefreshCw size={14} className={actualizando ? "animate-spin" : ""} />
          {actualizando ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      <div className="mb-6 p-3 bg-white border border-gray-200 rounded-lg flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-gray-700">Rango:</span>
        <input type="date" value={inputInicio} onChange={(e) => setInputInicio(e.target.value)} className="px-2 py-1 text-xs border border-gray-200 rounded" />
        <span className="text-gray-400">→</span>
        <input type="date" value={inputFin} onChange={(e) => setInputFin(e.target.value)} className="px-2 py-1 text-xs border border-gray-200 rounded" />
        <button onClick={handleAplicarRango} disabled={!inputInicio || !inputFin} className="flex items-center gap-1 px-3 py-1 text-xs text-white rounded bg-[#E91E63] disabled:opacity-50">
          <Search size={12} /> Aplicar
        </button>
        {rangoAplicado.inicio && <button onClick={handleLimpiarRango} className="text-xs text-gray-500 hover:text-red-500">✕ Limpiar</button>}
        {!rangoAplicado.inicio && <span className="text-[10px] text-gray-400 italic">(mes actual)</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard icon={<Users size={20} />} label="Personal Total" value={stats.total} sub="técnicos activos" color="#1d1d1f" />
        <KpiCard icon={<Briefcase size={20} />} label="En Proyecto" value={stats.enProyecto} sub={`hoy · ${donaPct(stats.enProyecto)}%`} color="#b3261e" />
        <KpiCard icon={<Calendar size={20} />} label="Disponibles" value={stats.disponibles} sub={`hoy · ${donaPct(stats.disponibles)}%`} color="#1a7a3a" />
        <KpiCard icon={<TrendingUp size={20} />} label="Asignaciones" value={stats.totalEntries} sub="en el período" color="#E91E63" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col items-center">
          <h3 className="text-sm font-bold text-gray-700 mb-3">% Carga Laboral</h3>
          <div className="relative w-40 h-40">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="60" fill="none" stroke="#f3f4f6" strokeWidth="12" />
              <circle
                cx="80" cy="80" r="60" fill="none" stroke={stats.cargaPct > 85 ? "#b3261e" : stats.cargaPct > 70 ? "#8a6d00" : "#1a7a3a"}
                strokeWidth="12" strokeDasharray={gaugeCirc} strokeDashoffset={gaugeOffset} strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.5s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-gray-900">{stats.cargaPct}%</span>
              <span className="text-[10px] text-gray-500">ocupación</span>
            </div>
          </div>
          {stats.sobrecarga.length > 0 && (
            <div className="mt-2 text-[10px] text-red-600">⚠ {stats.sobrecarga.length} en sobrecarga</div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col items-center">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Estado Hoy</h3>
          <svg width="160" height="160" viewBox="0 0 160 160">
            <path d={arco(0, angProy)} fill="#fdeaea" stroke="#b3261e" strokeWidth="1" />
            <path d={arco(angProy, angProy + angOfi)} fill="#fff6d6" stroke="#8a6d00" strokeWidth="1" />
            <path d={arco(angProy + angOfi, 360)} fill="#e6f9ed" stroke="#1a7a3a" strokeWidth="1" />
            <circle cx="80" cy="80" r="40" fill="white" />
            <text x="80" y="75" textAnchor="middle" className="text-xl font-bold fill-gray-900">{stats.total}</text>
            <text x="80" y="92" textAnchor="middle" className="text-[9px] fill-gray-500">activos</text>
          </svg>
          <div className="flex gap-3 mt-2 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400"></span>Proy: {stats.enProyecto}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400"></span>Ofi: {stats.enOficina}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400"></span>Disp: {stats.disponibles}</span>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Distribución por Categoría</h3>
          <div className="space-y-3">
            {(["rojo", "amarillo", "verde"] as const).map((c) => {
              const hex = COLOR_HEX[c];
              const count = stats.distColor[c] || 0;
              const pct = stats.totalEntries > 0 ? Math.round((count / stats.totalEntries) * 100) : 0;
              return (
                <div key={c}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold" style={{ color: hex.text }}>{colorLabels[c]}</span>
                    <span className="text-gray-600">{count} ({pct}%)</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: hex.border }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* HEATMAP TIPO GITHUB (Compacto y ordenado) */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
        <h3 className="text-sm font-bold text-gray-700 mb-3">Heatmap de Actividad {stats.yearActual}</h3>
        <div className="flex flex-col gap-1">
          {/* Etiquetas de meses arriba */}
          <div className="flex gap-[3px] ml-6">
            {weeks.map((week, idx) => {
              const firstDay = week.find(d => d && d.getDate() <= 7);
              const showLabel = firstDay && (idx === 0 || (idx > 0 && weeks[idx-1].find(d => d && d.getDate() <= 7)?.getMonth() !== firstDay.getMonth()));
              return (
                <div key={idx} style={{ width: "11px", position: "relative" }}>
                  {showLabel && (
                    <span style={{ position: "absolute", top: 0, left: 0, fontSize: "9px", color: "#9ca3af", whiteSpace: "nowrap" }}>
                      {MESES_CORTOS[firstDay.getMonth()]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Grid de semanas y días */}
          <div className="flex gap-1">
            {/* Etiquetas de días a la izquierda */}
            <div className="flex flex-col gap-[3px] mr-1 text-[8px] text-gray-400 justify-around">
              <span style={{ height: "11px", lineHeight: "11px" }}>Lun</span>
              <span style={{ height: "11px", lineHeight: "11px" }}></span>
              <span style={{ height: "11px", lineHeight: "11px" }}>Mié</span>
              <span style={{ height: "11px", lineHeight: "11px" }}></span>
              <span style={{ height: "11px", lineHeight: "11px" }}>Vie</span>
              <span style={{ height: "11px", lineHeight: "11px" }}></span>
              <span style={{ height: "11px", lineHeight: "11px" }}></span>
            </div>
            
            {/* Cuadrículas */}
            <div className="flex gap-[3px]">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-[3px]">
                  {week.map((day, dIdx) => {
                    if (!day) return <div key={dIdx} style={{ width: "11px", height: "11px" }} />;
                    const iso = formatFechaISO(day);
                    const count = stats.heatmapData[iso] || 0;
                    return (
                      <div
                        key={dIdx}
                        title={`${iso}: ${count} asignación(es)`}
                        style={{
                          width: "11px",
                          height: "11px",
                          borderRadius: "2px",
                          backgroundColor: getHeatColor(count),
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          
          {/* Leyenda */}
          <div className="flex items-center gap-1 mt-2 text-[8px] text-gray-500 justify-end">
            <span>Menos</span>
            <div style={{ width: "11px", height: "11px", borderRadius: "2px", backgroundColor: "#ebedf0" }}></div>
            <div style={{ width: "11px", height: "11px", borderRadius: "2px", backgroundColor: "#ffcdd2" }}></div>
            <div style={{ width: "11px", height: "11px", borderRadius: "2px", backgroundColor: "#ff8a80" }}></div>
            <div style={{ width: "11px", height: "11px", borderRadius: "2px", backgroundColor: "#e53935" }}></div>
            <div style={{ width: "11px", height: "11px", borderRadius: "2px", backgroundColor: "#b3261e" }}></div>
            <span>Más</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Top 10 OTs Más Asignadas</h3>
          {stats.statsPorOt.length === 0 ? (
            <p className="text-xs text-gray-400">Sin datos.</p>
          ) : (
            <div className="space-y-2">
              {stats.statsPorOt.map((item, i) => {
                const ot = ots.find((o) => o.codigo === item.codigo);
                const maxCount = stats.statsPorOt[0].count || 1;
                const pct = Math.round((item.count / maxCount) * 100);
                return (
                  <div key={item.codigo} className="flex items-center gap-2">
                    <div className="w-6 text-xs font-bold text-gray-400">{i + 1}</div>
                    <div className="w-24 text-xs font-semibold text-gray-900">{item.codigo}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-gray-600 truncate">{ot ? ot.cliente : "—"}</div>
                      <div className="h-2 bg-gray-100 rounded overflow-hidden mt-0.5">
                        <div className="h-full bg-[#E91E63]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="text-xs font-bold text-gray-900 w-8 text-right">{item.count}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-sm font-bold text-gray-700">Estadísticas Detalladas</h3>
            <div className="flex gap-1 text-[10px]">
              <button onClick={() => setVistaSecundaria("porTecnico")} className={`px-2 py-1 rounded font-medium ${vistaSecundaria === "porTecnico" ? "bg-[#E91E63] text-white" : "bg-gray-100 text-gray-600"}`}>Técnico</button>
              <button onClick={() => setVistaSecundaria("porActividad")} className={`px-2 py-1 rounded font-medium ${vistaSecundaria === "porActividad" ? "bg-[#E91E63] text-white" : "bg-gray-100 text-gray-600"}`}>Actividad</button>
              <button onClick={() => setVistaSecundaria("porDia")} className={`px-2 py-1 rounded font-medium ${vistaSecundaria === "porDia" ? "bg-[#E91E63] text-white" : "bg-gray-100 text-gray-600"}`}>Día</button>
            </div>
          </div>

          {vistaSecundaria === "porTecnico" && (
            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
              {stats.statsPorTecnicoLista.map((item, i) => {
                const maxCount = stats.statsPorTecnicoLista[0].count || 1;
                const pct = Math.round((item.count / maxCount) * 100);
                return (
                  <div key={item.tecnico.id} className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded-lg">
                    <div className="w-5 text-[10px] font-bold text-gray-400">{i + 1}</div>
                    <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100 flex items-center justify-center shrink-0">
                      {item.tecnico.foto_url ? (
                        <img src={item.tecnico.foto_url} alt={item.tecnico.nombre} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <span className="text-[8px] font-bold text-gray-500">{item.tecnico.nombre.substring(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-900 truncate">{item.tecnico.nombre}</div>
                      <div className="h-2 bg-gray-100 rounded overflow-hidden mt-0.5">
                        <div className="h-full bg-[#E91E63]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="text-xs font-bold text-gray-900 w-8 text-right">{item.count}</div>
                  </div>
                );
              })}
            </div>
          )}

          {vistaSecundaria === "porActividad" && (
            <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
              {stats.statsPorActividad.map((item, i) => {
                const act = actividades.find((a) => a.nombre === item.nombre);
                const hex = act ? COLOR_HEX[act.color] : COLOR_HEX.verde;
                const maxCount = stats.statsPorActividad[0].count || 1;
                const pct = Math.round((item.count / maxCount) * 100);
                return (
                  <div key={item.nombre} className="flex items-center gap-2">
                    <div className="w-5 text-[10px] font-bold text-gray-400">{i + 1}</div>
                    <div className="w-28 text-[11px] font-semibold truncate" style={{ color: hex.text }}>{item.nombre}</div>
                    <div className="flex-1">
                      <div className="h-2 bg-gray-100 rounded overflow-hidden">
                        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: hex.border }} />
                      </div>
                    </div>
                    <div className="text-xs font-bold text-gray-900 w-8 text-right">{item.count}</div>
                  </div>
                );
              })}
            </div>
          )}

          {vistaSecundaria === "porDia" && (
            <div className="space-y-1 max-h-[250px] overflow-y-auto">
              {stats.statsPorDia.map((item) => {
                const maxCount = stats.statsPorDia.length > 0 ? Math.max(...stats.statsPorDia.map((d) => d.count)) : 1;
                const pct = Math.round((item.count / maxCount) * 100);
                const [y, m, d] = item.fecha.split("-");
                return (
                  <div key={item.fecha} className="flex items-center gap-2">
                    <div className="w-20 text-[10px] font-mono text-gray-600">{d}/{m}/{y}</div>
                    <div className="flex-1">
                      <div className="h-2 bg-gray-100 rounded overflow-hidden">
                        <div className="h-full bg-[#E91E63]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="text-xs font-bold text-gray-900 w-8 text-right">{item.count}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: number; sub: string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3">
      <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}15`, color }}>
        {icon}
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</div>
        <div className="text-2xl font-bold" style={{ color }}>{value}</div>
        <div className="text-[10px] text-gray-400">{sub}</div>
      </div>
    </div>
  );
}

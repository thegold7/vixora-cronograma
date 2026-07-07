"use client";

import { useStore } from "@/lib/store";
import { COLOR_HEX, type Tecnico, type Actividad, type CronogramaMap, type OT } from "@/lib/types";
import { useMemo, useState } from "react";
import { RefreshCw, Search, TrendingUp, Users, Briefcase, Calendar } from "lucide-react";

interface Props {
  tecnicos: Tecnico[];
  actividades: Actividad[];
  cronograma: CronogramaMap;
  ots: OT[];
}

const MESES_ES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const DOW_ES = ["D", "L", "M", "M", "J", "V", "S"];

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

    // Heatmap: agrupar por día del año (solo año actual)
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

  // Gauge circular para % carga
  const gaugeCirc = 2 * Math.PI * 60;
  const gaugeOffset = gaugeCirc - (stats.cargaPct / 100) * gaugeCirc;

  // Generar días del año para heatmap
  const diasAño = useMemo(() => {
    const dias: Date[] = [];
    for (let m = 0; m < 12; m++) {
      const last = new Date(stats.yearActual, m + 1, 0).getDate();
      for (let d = 1; d <= last; d++) dias.push(new Date(stats.yearActual, m, d));
    }
    return dias;
  }, [stats.yearActual]);

  const getHeatColor = (count: number) => {
    if (count === 0) return "#f3f4f6";
    const intensity = count / stats.maxHeat;
    if (intensity > 0.75) return "#b3261e";
    if (intensity > 0.5) return "#e53935";
    if (intensity > 0.25) return "#ff8a80";
    return "#ffcdd2";
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

      {/* Selector de rango */}
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

      {/* KPIs grandes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard icon={<Users size={20} />} label="Personal Total" value={stats.total} sub="técnicos activos" color="#1d1d1f" />
        <KpiCard icon={<Briefcase size={20} />} label="En Proyecto" value={stats.enProyecto} sub={`hoy · ${donaPct(stats.enProyecto)}%`} color="#b3261e" />
        <KpiCard icon={<Calendar size={20} />} label="Disponibles" value={stats.disponibles} sub={`hoy · ${donaPct(stats.disponibles)}%`} color="#1a7a3a" />
        <KpiCard icon={<TrendingUp size={20} />} label="Asignaciones" value={stats.totalEntries} sub="en el período" color="#E91E63" />
      </div>

      {/* Gauge de carga + Dona de estado */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Gauge circular de carga */}
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

        {/* Dona de estado del personal */}
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

        {/* Distribución por color */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Distribución por Color</h3>
          <div className="space-y-3">
            {(["rojo", "amarillo", "verde"] as const).map((c) => {
              const hex = COLOR_HEX[c];
              const count = stats.distColor[c] || 0;
              const pct = stats.totalEntries > 0 ? Math.round((count / stats.totalEntries) * 100) : 0;
              return (
                <div key={c}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold capitalize" style={{ color: hex.text }}>{c}</span>
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

      {/* HEATMAP de actividad anual */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
        <h3 className="text-sm font-bold text-gray-700 mb-3">Heatmap de Actividad {stats.yearActual}</h3>
        <div className="flex gap-1 min-w-max">
          {MESES_CORTOS.map((mes, mIdx) => {
            const diasMes = diasAño.filter((d) => d.getMonth() === mIdx);
            return (
              <div key={mIdx} className="flex flex-col gap-1">
                <div className="text-[9px] text-gray-500 text-center mb-1">{mes}</div>
                <div className="flex flex-col gap-0.5">
                  {diasMes.map((d) => {
                    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                    const count = stats.heatmapData[iso] || 0;
                    return (
                      <div
                        key={iso}
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: getHeatColor(count) }}
                        title={`${iso}: ${count} asignación(es)`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 mt-3 text-[9px] text-gray-500">
          <span>Menos</span>
          <div className="w-3 h-3 rounded-sm bg-gray-100"></div>
          <div className="w-3 h-3 rounded-sm bg-red-200"></div>
          <div className="w-3 h-3 rounded-sm bg-red-300"></div>
          <div className="w-3 h-3 rounded-sm bg-red-400"></div>
          <div className="w-3 h-3 rounded-sm bg-red-700"></div>
          <span>Más</span>
        </div>
      </div>

      {/* Top 10 OTs */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
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

      {/* Estadísticas detalladas con tabs */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-gray-700">Estadísticas Detalladas</h3>
          <div className="flex gap-1 text-[10px]">
            <button onClick={() => setVistaSecundaria("porTecnico")} className={`px-2 py-1 rounded font-medium ${vistaSecundaria === "porTecnico" ? "bg-[#E91E63] text-white" : "bg-gray-100 text-gray-600"}`}>Por técnico</button>
            <button onClick={() => setVistaSecundaria("porActividad")} className={`px-2 py-1 rounded font-medium ${vistaSecundaria === "porActividad" ? "bg-[#E91E63] text-white" : "bg-gray-100 text-gray-600"}`}>Por actividad</button>
            <button onClick={() => setVistaSecundaria("porDia")} className={`px-2 py-1 rounded font-medium ${vistaSecundaria === "porDia" ? "bg-[#E91E63] text-white" : "bg-gray-100 text-gray-600"}`}>Por día</button>
          </div>
        </div>

        {vistaSecundaria === "porTecnico" && (
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {stats.statsPorTecnicoLista.map((item, i) => {
              const maxCount = stats.statsPorTecnicoLista[0].count || 1;
              const pct = Math.round((item.count / maxCount) * 100);
              return (
                <div key={item.tecnico.id} className="flex items-center gap-2">
                  <div className="w-5 text-[10px] font-bold text-gray-400">{i + 1}</div>
                  <div className="w-40 text-[11px] font-semibold text-gray-900 truncate">{item.tecnico.nombre}</div>
                  <div className="flex-1">
                    <div className="text-[10px] text-gray-500">{item.tecnico.cargo}</div>
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
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {stats.statsPorActividad.map((item, i) => {
              const act = actividades.find((a) => a.nombre === item.nombre);
              const hex = act ? COLOR_HEX[act.color] : COLOR_HEX.verde;
              const maxCount = stats.statsPorActividad[0].count || 1;
              const pct = Math.round((item.count / maxCount) * 100);
              return (
                <div key={item.nombre} className="flex items-center gap-2">
                  <div className="w-5 text-[10px] font-bold text-gray-400">{i + 1}</div>
                  <div className="w-32 text-[11px] font-semibold truncate" style={{ color: hex.text }}>{item.nombre}</div>
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
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {stats.statsPorDia.map((item) => {
              const maxCount = stats.statsPorDia.length > 0 ? Math.max(...stats.statsPorDia.map((d) => d.count)) : 1;
              const pct = Math.round((item.count / maxCount) * 100);
              const [y, m, d] = item.fecha.split("-");
              return (
                <div key={item.fecha} className="flex items-center gap-2">
                  <div className="w-24 text-[10px] font-mono text-gray-600">{d}/{m}/{y}</div>
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

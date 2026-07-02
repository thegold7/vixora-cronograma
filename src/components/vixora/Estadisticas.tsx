"use client";

import { useStore } from "@/lib/store";
import { COLOR_HEX, type Tecnico, type Actividad, type CronogramaMap, type OT } from "@/lib/types";
import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

interface Props {
  tecnicos: Tecnico[];
  actividades: Actividad[];
  cronograma: CronogramaMap;
  ots: OT[];
}

const MESES_ES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export function Estadisticas({ tecnicos, actividades, cronograma, ots }: Props) {
  const { fechaActual, cargarDatos } = useStore();
  const [rangoInicio, setRangoInicio] = useState<string>("");
  const [rangoFin, setRangoFin] = useState<string>("");
  const [actualizando, setActualizando] = useState(false);

  const handleActualizar = async () => {
    setActualizando(true);
    await cargarDatos();
    setActualizando(false);
  };

  const stats = useMemo(() => {
    const activos = tecnicos.filter((t) => t.activo);
    const total = activos.length;

    // Filtrar entradas por rango de fechas si está especificado
    let entries = Object.values(cronograma);
    if (rangoInicio && rangoFin) {
      entries = entries.filter((e) => {
        return e.fecha >= rangoInicio && e.fecha <= rangoFin;
      });
    } else {
      // Si no hay rango, usar mes actual
      const year = fechaActual.getFullYear();
      const month = fechaActual.getMonth();
      entries = entries.filter((e) => {
        const [y, m] = e.fecha.split("-").map(Number);
        return y === year && m === month + 1;
      });
    }

    const distColor: Record<string, number> = { rojo: 0, amarillo: 0, verde: 0 };
    for (const e of entries) {
      const a = actividades.find((x) => x.nombre === e.actividad);
      if (a) distColor[a.color]++;
    }

    const porTecnico: Record<string, number> = {};
    for (const e of entries) {
      porTecnico[e.tecnico_id] = (porTecnico[e.tecnico_id] ?? 0) + 1;
    }

    let diasPeriodo = 0;
    if (rangoInicio && rangoFin) {
      const diff = Math.round(
        (new Date(rangoFin).getTime() - new Date(rangoInicio).getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
      diasPeriodo = diff > 0 ? diff : 1;
    } else {
      const year = fechaActual.getFullYear();
      const month = fechaActual.getMonth();
      diasPeriodo = new Date(year, month + 1, 0).getDate();
    }
    const cargaMax = total * diasPeriodo;
    const cargaActual = entries.length;
    const cargaPct = cargaMax > 0 ? Math.round((cargaActual / cargaMax) * 100) : 0;

    const sobrecarga = activos.filter((t) => (porTecnico[t.id] ?? 0) > 22);

    let enProyecto = 0;
    let enOficina = 0;
    let disponibles = 0;
    const hoy = new Date();
    const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
    for (const t of activos) {
      const entry = cronograma[`${t.id}|${hoyIso}`];
      if (!entry) {
        disponibles++;
      } else if (entry.actividad.includes("PROYECTO") || entry.actividad.includes("SERV.")) {
        enProyecto++;
      } else if (entry.actividad === "OFICINA") {
        enOficina++;
      } else {
        disponibles++;
      }
    }

    const otCount: Record<string, number> = {};
    for (const e of entries) {
      if (e.ots_asignadas && e.ots_asignadas !== "—") {
        const codigos = e.ots_asignadas.split(",").map((s) => s.trim()).filter(Boolean);
        for (const cod of codigos) {
          otCount[cod] = (otCount[cod] ?? 0) + 1;
        }
      }
    }
    const statsPorOt = Object.entries(otCount)
      .map(([codigo, count]) => ({ codigo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total,
      totalEntries: entries.length,
      distColor,
      porTecnico,
      cargaPct,
      sobrecarga,
      enProyecto,
      enOficina,
      disponibles,
      statsPorOt,
    };
  }, [tecnicos, cronograma, actividades, fechaActual, ots, rangoInicio, rangoFin]);

  const total = stats.total || 1;
  const donaPct = (n: number) => Math.round((n / total) * 100);

  const totalDona = stats.enProyecto + stats.enOficina + stats.disponibles || 1;
  const angProy = (stats.enProyecto / totalDona) * 360;
  const angOfi = (stats.enOficina / totalDona) * 360;

  const arco = (inicio: number, fin: number, color: string) => {
    const r = 60;
    const cx = 70;
    const cy = 70;
    const inicioRad = ((inicio - 90) * Math.PI) / 180;
    const finRad = ((fin - 90) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(inicioRad);
    const y1 = cy + r * Math.sin(inicioRad);
    const x2 = cx + r * Math.cos(finRad);
    const y2 = cy + r * Math.sin(finRad);
    const large = fin - inicio > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  };

  const periodoLabel = rangoInicio && rangoFin
    ? `${rangoInicio.split("-").reverse().join("/")} → ${rangoFin.split("-").reverse().join("/")}`
    : `${MESES_ES[fechaActual.getMonth()]} ${fechaActual.getFullYear()}`;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold text-gray-900">
          Estadísticas — {periodoLabel}
        </h2>
        <button
          onClick={handleActualizar}
          disabled={actualizando}
          className="flex items-center gap-1 px-3 py-1.5 text-xs text-white rounded bg-[#E91E63] hover:bg-[#c2185b] disabled:opacity-50"
        >
          <RefreshCw size={14} className={actualizando ? "animate-spin" : ""} />
          {actualizando ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {/* Selector de rango de fechas */}
      <div className="mb-6 p-3 bg-white border border-gray-200 rounded-lg flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-gray-700">Rango de fechas:</span>
        <input
          type="date"
          value={rangoInicio}
          onChange={(e) => setRangoInicio(e.target.value)}
          className="px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-pink-400"
        />
        <span className="text-gray-400">→</span>
        <input
          type="date"
          value={rangoFin}
          onChange={(e) => setRangoFin(e.target.value)}
          className="px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-pink-400"
        />
        {(rangoInicio || rangoFin) && (
          <button
            onClick={() => { setRangoInicio(""); setRangoFin(""); }}
            className="text-xs text-gray-500 hover:text-red-500"
          >
            ✕ Limpiar
          </button>
        )}
        {!rangoInicio && !rangoFin && (
          <span className="text-[10px] text-gray-400 italic">
            (vacío = mes actual)
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard titulo="Personal Total" valor={stats.total} subtitulo="técnicos activos" color="#1d1d1f" />
        <StatCard titulo="En Proyecto" valor={stats.enProyecto} subtitulo={`hoy · ${donaPct(stats.enProyecto)}%`} color="#b3261e" />
        <StatCard titulo="Disponibles" valor={stats.disponibles} subtitulo={`hoy · ${donaPct(stats.disponibles)}%`} color="#1a7a3a" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Estado del personal (hoy)</h3>
          <div className="flex items-center gap-4">
            <svg width="140" height="140" viewBox="0 0 140 140">
              <path d={arco(0, angProy, "#b3261e")} fill="#fdeaea" stroke="#b3261e" strokeWidth="1" />
              <path d={arco(angProy, angProy + angOfi, "#8a6d00")} fill="#fff6d6" stroke="#8a6d00" strokeWidth="1" />
              <path d={arco(angProy + angOfi, 360, "#1a7a3a")} fill="#e6f9ed" stroke="#1a7a3a" strokeWidth="1" />
              <circle cx="70" cy="70" r="35" fill="white" />
              <text x="70" y="65" textAnchor="middle" className="text-2xl font-bold fill-gray-900">
                {stats.total}
              </text>
              <text x="70" y="80" textAnchor="middle" className="text-[10px] fill-gray-500">
                activos
              </text>
            </svg>
            <div className="space-y-2 flex-1">
              <LegendItem color="#fdeaea" border="#b3261e" label="En proyecto" value={stats.enProyecto} pct={donaPct(stats.enProyecto)} />
              <LegendItem color="#fff6d6" border="#8a6d00" label="En oficina" value={stats.enOficina} pct={donaPct(stats.enOficina)} />
              <LegendItem color="#e6f9ed" border="#1a7a3a" label="Disponibles" value={stats.disponibles} pct={donaPct(stats.disponibles)} />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Carga laboral del período</h3>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">% Carga promedio</span>
              <span className="text-lg font-bold text-gray-900">{stats.cargaPct}%</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${stats.cargaPct}%`,
                  backgroundColor: stats.cargaPct > 85 ? "#b3261e" : stats.cargaPct > 70 ? "#8a6d00" : "#1a7a3a",
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center mt-4">
            <div className="bg-red-50 rounded p-2">
              <div className="text-xs font-bold text-red-700">{stats.sobrecarga.length}</div>
              <div className="text-[10px] text-red-600">Sobrecarga</div>
            </div>
            <div className="bg-yellow-50 rounded p-2">
              <div className="text-xs font-bold text-yellow-700">{stats.totalEntries}</div>
              <div className="text-[10px] text-yellow-600">Asignaciones</div>
            </div>
            <div className="bg-green-50 rounded p-2">
              <div className="text-xs font-bold text-green-700">{stats.total - stats.sobrecarga.length}</div>
              <div className="text-[10px] text-green-600">Sin alerta</div>
            </div>
          </div>

          {stats.sobrecarga.length > 0 && (
            <div className="mt-3 text-xs">
              <div className="font-semibold text-red-700 mb-1">⚠ Técnicos con sobrecarga:</div>
              <ul className="space-y-0.5 text-red-600">
                {stats.sobrecarga.map((t) => (
                  <li key={t.id} className="text-[11px]">• {t.nombre}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 lg:col-span-2">
          <h3 className="text-sm font-bold text-gray-700 mb-3">
            Top 10 OTs más asignadas
          </h3>
          {stats.statsPorOt.length === 0 ? (
            <p className="text-xs text-gray-400">No hay asignaciones en el período seleccionado.</p>
          ) : (
            <div className="space-y-2">
              {stats.statsPorOt.map((item, i) => {
                const ot = ots.find((o) => o.codigo === item.codigo);
                const maxCount = stats.statsPorOt[0].count || 1;
                const pct = Math.round((item.count / maxCount) * 100);
                return (
                  <div key={item.codigo} className="flex items-center gap-2">
                    <div className="w-6 text-xs font-bold text-gray-400">{i + 1}</div>
                    <div className="w-20 text-xs font-semibold text-gray-900">{item.codigo}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-gray-600 truncate">
                        {ot ? ot.cliente : "—"}
                      </div>
                      <div className="h-2 bg-gray-100 rounded overflow-hidden mt-0.5">
                        <div
                          className="h-full bg-[#E91E63]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-xs font-bold text-gray-900 w-8 text-right">
                      {item.count}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 lg:col-span-2">
          <h3 className="text-sm font-bold text-gray-700 mb-3">
            Distribución de actividades por color
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {(["rojo", "amarillo", "verde"] as const).map((c) => {
              const hex = COLOR_HEX[c];
              const count = stats.distColor[c] || 0;
              const pct = stats.totalEntries > 0 ? Math.round((count / stats.totalEntries) * 100) : 0;
              return (
                <div
                  key={c}
                  className="rounded p-3"
                  style={{ backgroundColor: hex.soft, border: `1px solid ${hex.border}` }}
                >
                  <div className="text-xs font-bold capitalize" style={{ color: hex.text }}>
                    {c}
                  </div>
                  <div className="text-2xl font-bold mt-1" style={{ color: hex.text }}>
                    {count}
                  </div>
                  <div className="text-[10px]" style={{ color: hex.text }}>
                    {pct}% del período
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ titulo, valor, subtitulo, color }: { titulo: string; valor: number; subtitulo: string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
        {titulo}
      </div>
      <div className="text-3xl font-bold mt-1" style={{ color }}>
        {valor}
      </div>
      <div className="text-[10px] text-gray-400 mt-1">{subtitulo}</div>
    </div>
  );
}

function LegendItem({ color, border, label, value, pct }: { color: string; border: string; label: string; value: number; pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded" style={{ backgroundColor: color, border: `1px solid ${border}` }} />
      <div className="flex-1">
        <div className="text-xs text-gray-700">{label}</div>
        <div className="text-[10px] text-gray-400">{pct}%</div>
      </div>
      <div className="text-sm font-bold text-gray-900">{value}</div>
    </div>
  );
}

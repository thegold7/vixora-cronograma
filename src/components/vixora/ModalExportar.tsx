"use client";

import { useStore, formatFechaISO } from "@/lib/store";
import { COLOR_HEX } from "@/lib/types";
import { X, Download, Printer, FileText, CheckSquare, Square } from "lucide-react";
import { useState, useMemo } from "react";

export function ModalExportar() {
  const {
    modalExportarAbierto,
    setModalExportarAbierto,
    tecnicos,
    actividades,
    cronograma,
    ots,
    fechaActual,
    showToast,
  } = useStore();

  const primerDiaMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1);
  const ultimoDiaMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0);

  const [fechaInicio, setFechaInicio] = useState(formatFechaISO(primerDiaMes));
  const [fechaFin, setFechaFin] = useState(formatFechaISO(ultimoDiaMes));

  const tecnicosActivos = useMemo(() => tecnicos.filter((t) => t.activo), [tecnicos]);
  const [tecnicosSel, setTecnicosSel] = useState<Set<string>>(
    new Set(tecnicosActivos.map((t) => t.id))
  );
  const [actividadesSel, setActividadesSel] = useState<Set<string>>(
    new Set(actividades.map((a) => a.nombre))
  );
  const [formato, setFormato] = useState<"pdf" | "excel">("pdf");

  const entradasFiltradas = useMemo(() => {
    return Object.values(cronograma).filter((e) => {
      if (e.fecha < fechaInicio || e.fecha > fechaFin) return false;
      if (!tecnicosSel.has(e.tecnico_id)) return false;
      if (!actividadesSel.has(e.actividad)) return false;
      return true;
    });
  }, [cronograma, fechaInicio, fechaFin, tecnicosSel, actividadesSel]);

  const otMap: Record<string, typeof ots[0]> = {};
  for (const o of ots) otMap[o.codigo] = o;
  const tecnicoMap: Record<string, typeof tecnicos[0]> = {};
  for (const t of tecnicos) tecnicoMap[t.id] = t;

  if (!modalExportarAbierto) return null;

  const toggleTecnico = (id: string) => {
    setTecnicosSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleActividad = (nombre: string) => {
    setActividadesSel((prev) => {
      const next = new Set(prev);
      if (next.has(nombre)) next.delete(nombre);
      else next.add(nombre);
      return next;
    });
  };

  const selectAllTecnicos = () => setTecnicosSel(new Set(tecnicosActivos.map((t) => t.id)));
  const deselectAllTecnicos = () => setTecnicosSel(new Set());
  const selectAllActividades = () => setActividadesSel(new Set(actividades.map((a) => a.nombre)));
  const deselectAllActividades = () => setActividadesSel(new Set());

  const handleClose = () => setModalExportarAbierto(false);

  const handleExportExcel = () => {
    if (entradasFiltradas.length === 0) {
      showToast("No hay datos para exportar", "error");
      return;
    }
    const headers = ["Fecha", "Técnico", "Cargo", "Actividad", "OTs", "Detalle", "Notas"];
    const rows = entradasFiltradas
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.tecnico_id.localeCompare(b.tecnico_id))
      .map((e) => {
        const t = tecnicoMap[e.tecnico_id];
        return [
          e.fecha,
          t?.nombre ?? e.tecnico_id,
          t?.cargo ?? "",
          e.actividad,
          e.ots_asignadas === "—" ? "" : e.ots_asignadas,
          e.detalle === "—" ? "" : e.detalle.replace(/\n/g, " | "),
          e.notas || "",
        ];
      });
    const escapeCsv = (s: string) => {
      if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const csv = [headers.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `VIXORA_cronograma_${fechaInicio}_a_${fechaFin}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exportadas ${entradasFiltradas.length} entradas a CSV`, "ok");
  };

  const handleExportPDF = () => {
    if (entradasFiltradas.length === 0) {
      showToast("No hay datos para exportar", "error");
      return;
    }
    const tecnicosIncluidos = tecnicosActivos.filter((t) => tecnicosSel.has(t.id));
    
    const porTecnico: Record<string, typeof entradasFiltradas> = {};
    for (const e of entradasFiltradas) {
      if (!porTecnico[e.tecnico_id]) porTecnico[e.tecnico_id] = [];
      porTecnico[e.tecnico_id].push(e);
    }

    function sumarDiasISO(iso: string, dias: number): string {
      const d = new Date(iso + "T00:00:00");
      d.setDate(d.getDate() + dias);
      return formatFechaISO(d);
    }

    const agruparConsecutivos = (entradas: typeof entradasFiltradas) => {
      const ordenadas = entradas.sort((a, b) => a.fecha.localeCompare(b.fecha));
      const grupos: { 
        actividad: string; 
        fechaInicio: string; 
        fechaFin: string; 
        ots: string;
        count: number;
      }[] = [];
      
      for (const e of ordenadas) {
        const ultimo = grupos[grupos.length - 1];
        const fechaAnterior = ultimo ? sumarDiasISO(ultimo.fechaFin, 1) : null;
        
        if (ultimo && 
            ultimo.actividad === e.actividad && 
            ultimo.ots === e.ots_asignadas &&
            fechaAnterior === e.fecha) {
          ultimo.fechaFin = e.fecha;
          ultimo.count++;
        } else {
          grupos.push({
            actividad: e.actividad,
            fechaInicio: e.fecha,
            fechaFin: e.fecha,
            ots: e.ots_asignadas,
            count: 1,
          });
        }
      }
      return grupos;
    };

    const fmtFechaLarga = (iso: string) => {
      const [y, m, d] = iso.split("-");
      const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      return `${d} ${meses[parseInt(m) - 1]}`;
    };

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>VIXORA Cronograma ${fechaInicio} a ${fechaFin}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; }
  body { padding: 24px; color: #1d1d1f; background: white; }
  .header { border-bottom: 3px solid #E91E63; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { color: #E91E63; font-size: 24px; margin-bottom: 4px; }
  .header .sub { font-size: 13px; color: #6e6e73; }
  .header .meta { font-size: 11px; color: #999; margin-top: 8px; }
  .resumen-general { background: linear-gradient(135deg, #E91E63 0%, #c2185b 100%); color: white; padding: 16px 20px; border-radius: 12px; margin-bottom: 24px; display: flex; justify-content: space-around; text-align: center; }
  .resumen-item .num { font-size: 28px; font-weight: bold; }
  .resumen-item .lbl { font-size: 10px; opacity: 0.9; text-transform: uppercase; }
  .tecnico-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; margin-bottom: 16px; overflow: hidden; page-break-inside: avoid; }
  .tecnico-header { background: #1d1d1f; color: white; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
  .tecnico-header .nombre { font-weight: bold; font-size: 14px; }
  .tecnico-header .cargo { font-size: 11px; opacity: 0.7; }
  .tecnico-header .badge { background: #E91E63; padding: 4px 10px; border-radius: 12px; font-size: 10px; font-weight: bold; }
  .actividad-row { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #eee; gap: 12px; }
  .actividad-row:last-child { border-bottom: none; }
  .color-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
  .fecha-block { min-width: 120px; flex-shrink: 0; }
  .fecha-block .rango { font-size: 12px; font-weight: bold; color: #1d1d1f; }
  .fecha-block .duracion { font-size: 9px; color: #999; }
  .actividad-info { flex: 1; }
  .actividad-info .actividad { font-size: 12px; font-weight: 600; color: #1d1d1f; margin-bottom: 2px; }
  .actividad-info .ots { font-size: 10px; color: #6e6e73; }
  @media print { body { padding: 12px; } .no-print { display: none; } }
</style>
</head>
<body>
  <div class="header">
    <h1>VIXORA — Cronograma de Actividades</h1>
    <div class="sub">Período: ${fmtFechaLarga(fechaInicio)} → ${fmtFechaLarga(fechaFin)}</div>
    <div class="meta">Generado: ${new Date().toLocaleString("es-PE")} · ${entradasFiltradas.length} asignaciones · ${tecnicosIncluidos.length} técnicos</div>
  </div>
  <div class="resumen-general">
    <div class="resumen-item"><div class="num">${entradasFiltradas.length}</div><div class="lbl">Asignaciones</div></div>
    <div class="resumen-item"><div class="num">${tecnicosIncluidos.length}</div><div class="lbl">Técnicos</div></div>
    <div class="resumen-item"><div class="num">${actividades.filter(a => actividadesSel.has(a.nombre)).length}</div><div class="lbl">Actividades</div></div>
  </div>
  ${tecnicosIncluidos.map((t) => {
    const entradas = porTecnico[t.id] || [];
    if (entradas.length === 0) return "";
    const grupos = agruparConsecutivos(entradas);
    return `
      <div class="tecnico-card">
        <div class="tecnico-header">
          <div>
            <div class="nombre">${t.nombre}</div>
            <div class="cargo">${t.cargo}</div>
          </div>
          <div class="badge">${grupos.length} actividad(es)</div>
        </div>
        ${grupos.map((g) => {
          const act = actividades.find((a) => a.nombre === g.actividad);
          const hex = act ? COLOR_HEX[act.color] : null;
          const rangoTxt = g.count === 1 ? fmtFechaLarga(g.fechaInicio) : `${fmtFechaLarga(g.fechaInicio)} → ${fmtFechaLarga(g.fechaFin)}`;
          const duracionTxt = g.count === 1 ? "1 día" : `${g.count} días`;
          const otsTxt = g.ots === "—" ? "" : g.ots;
          return `
            <div class="actividad-row">
              <div class="color-dot" style="background: ${hex?.border ?? "#999"}"></div>
              <div class="fecha-block">
                <div class="rango">${rangoTxt}</div>
                <div class="duracion">${duracionTxt}</div>
              </div>
              <div class="actividad-info">
                <div class="actividad">${g.actividad}</div>
                ${otsTxt ? `<div class="ots">OTs: ${otsTxt}</div>` : ""}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }).join("")}
  <div class="no-print" style="margin-top: 24px; text-align: center;">
    <button onclick="window.print()" style="background: #E91E63; color: white; border: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: bold;">🖨️ Imprimir / Guardar como PDF</button>
  </div>
</body>
</html>`;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      showToast(`PDF generado con ${entradasFiltradas.length} entradas`, "ok");
    } else {
      showToast("Permite popups para generar el PDF", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={handleClose}>
      <div className="bg-white rounded-lg shadow-2xl w-[95%] max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 flex items-center justify-between text-white" style={{ backgroundColor: "#1d1d1f" }}>
          <div className="flex items-center gap-2"><FileText size={18} /><span className="text-sm font-bold">Exportar Cronograma</span></div>
          <button onClick={handleClose} className="p-1 hover:bg-white/20 rounded"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Rango de fechas</label>
            <div className="flex items-center gap-2">
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="px-2 py-1.5 text-xs border border-gray-200 rounded" />
              <span className="text-gray-400">→</span>
              <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="px-2 py-1.5 text-xs border border-gray-200 rounded" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-700">Técnicos ({tecnicosSel.size} de {tecnicosActivos.length})</label>
              <div className="flex gap-2"><button onClick={selectAllTecnicos} className="text-[10px] text-pink-600 hover:underline">Todos</button><button onClick={deselectAllTecnicos} className="text-[10px] text-gray-500 hover:underline">Ninguno</button></div>
            </div>
            <div className="max-h-32 overflow-y-auto border border-gray-100 rounded p-2 grid grid-cols-2 gap-1">
              {tecnicosActivos.map((t) => (
                <label key={t.id} className="flex items-center gap-1.5 text-[11px] cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                  <button onClick={() => toggleTecnico(t.id)} className="shrink-0">{tecnicosSel.has(t.id) ? <CheckSquare size={12} className="text-pink-600" /> : <Square size={12} className="text-gray-300" />}</button>
                  <span className="truncate">{t.nombre}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-700">Actividades ({actividadesSel.size} de {actividades.length})</label>
              <div className="flex gap-2"><button onClick={selectAllActividades} className="text-[10px] text-pink-600 hover:underline">Todas</button><button onClick={deselectAllActividades} className="text-[10px] text-gray-500 hover:underline">Ninguna</button></div>
            </div>
            <div className="max-h-32 overflow-y-auto border border-gray-100 rounded p-2 grid grid-cols-3 gap-1">
              {actividades.map((a) => {
                const hex = COLOR_HEX[a.color as keyof typeof COLOR_HEX];
                return (
                  <label key={a.codigo} className="flex items-center gap-1.5 text-[11px] cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                    <button onClick={() => toggleActividad(a.nombre)} className="shrink-0">{actividadesSel.has(a.nombre) ? <CheckSquare size={12} className="text-pink-600" /> : <Square size={12} className="text-gray-300" />}</button>
                    <span className="w-2 h-2 rounded shrink-0" style={{ backgroundColor: hex.border }} />
                    <span className="truncate">{a.nombre}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="p-3 bg-pink-50 border border-pink-200 rounded">
            <div className="text-xs font-semibold text-pink-700 mb-1">Resumen:</div>
            <div className="text-[11px] text-pink-900 space-y-0.5">
              <div>📅 {fechaInicio.split("-").reverse().join("/")} → {fechaFin.split("-").reverse().join("/")}</div>
              <div>👥 {tecnicosSel.size} técnico(s) · 🎯 {actividadesSel.size} actividad(es)</div>
              <div className="font-bold mt-1">📊 {entradasFiltradas.length} asignación(es) a exportar</div>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Formato</label>
            <div className="flex gap-2">
              <button onClick={() => setFormato("pdf")} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs rounded border-2 ${formato === "pdf" ? "border-[#E91E63] bg-pink-50 text-pink-700" : "border-gray-200 text-gray-600"}`}><Printer size={14} />PDF</button>
              <button onClick={() => setFormato("excel")} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs rounded border-2 ${formato === "excel" ? "border-[#E91E63] bg-pink-50 text-pink-700" : "border-gray-200 text-gray-600"}`}><Download size={14} />Excel (CSV)</button>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-200 p-3 flex justify-end gap-2">
          <button onClick={handleClose} className="px-3 py-1.5 text-xs border border-gray-200 rounded hover:bg-gray-50">Cancelar</button>
          <button onClick={formato === "pdf" ? handleExportPDF : handleExportExcel} disabled={entradasFiltradas.length === 0} className="flex items-center gap-1 px-4 py-1.5 text-xs text-white rounded disabled:opacity-50" style={{ backgroundColor: "#E91E63" }}>
            {formato === "pdf" ? <Printer size={14} /> : <Download size={14} />}
            {formato === "pdf" ? "Generar PDF" : "Descargar CSV"}
          </button>
        </div>
      </div>
    </div>
  );
}

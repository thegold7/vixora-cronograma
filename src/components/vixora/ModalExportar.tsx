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

  // IMPORTANTE: useMemo ANTES del return null
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

  // AHORA sí el return null (después de todos los hooks)
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
    
    // Agrupar por técnico, luego por actividad consecutiva
    const porTecnico: Record<string, typeof entradasFiltradas> = {};
    for (const e of entradasFiltradas) {
      if (!porTecnico[e.tecnico_id]) porTecnico[e.tecnico_id] = [];
      porTecnico[e.tecnico_id].push(e);
    }

    // Función para agrupar días consecutivos con misma actividad y OTs
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
        
        // Si es consecutivo y misma actividad + mismas OTs → agrupar
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

    // Función helper para sumar días (definida inline)
    function sumarDiasISO(iso: string, dias: number): string {
      const d = new Date(iso + "T00:00:00");
      d.setDate(d.getDate() + dias);
      return formatFechaISO(d);
    }

    // Formatear rango de fechas bonito
    const fmtFecha = (iso: string) => {
      const [y, m, d] = iso.split("-");
      return `${d}/${m}`;
    };
    const fmtFechaLarga = (iso: string) => {
      const [y, m, d] = iso.split("-");
      const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      return `${d} ${meses[parseInt(m) - 1]}`;
    };

    // Construir HTML con tarjetas visuales
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
  
  .resumen-general { 
    background: linear-gradient(135deg, #E91E63 0%, #c2185b 100%); 
    color: white; 
    padding: 16px 20px; 
    border-radius: 12px; 
    margin-bottom: 24px; 
    display: flex; 
    justify-content: space-around;
    text-align: center;
  }
  .resumen-item .num { font-size: 28px; font-weight: bold; }
  .resumen-item .lbl { font-size: 10px; opacity: 0.9; text-transform: uppercase; }
  
  .tecnico-card { 
    background: #f9fafb; 
    border: 1px solid #e5e7eb; 
    border-radius: 12px; 
    margin-bottom: 16px; 
    overflow: hidden;
    page-break-inside: avoid;
  }
  .tecnico-header { 
    background: #1d1d1f; 
    color: white; 
    padding: 12px 16px; 
    display: flex; 
    align-items: center; 
    justify-content: space-between;
  }
  .tecnico-header .nombre { font-weight: bold; font-size: 14px; }
  .tecnico-header .cargo { font-size: 11px; opacity: 0.7; }
  .tecnico-header .badge { 
    background: #E91E63; 
    padding: 4px 10px; 
    border-radius: 12px; 
    font-size: 10px; 
    font-weight: bold;
  }
  
  .actividad-row { 
    display: flex; 
    align-items: center; 
    padding: 12px 16px; 
    border-bottom: 1px solid #eee;
    gap: 12px;
  }
  .actividad-row:last-child { border-bottom: none; }
  
  .color-dot { 
    width: 12px; 
    height: 12px; 
    border-radius: 50%; 
    flex-shrink: 0;
  }
  
  .fecha-block { 
    min-width: 120px; 
    flex-shrink: 0;
  }
  .fecha-block .rango { 
    font-size: 12px; 
    font-weight: bold; 
    color: #1d1d1f;
  }
  .fecha-block .duracion { 
    font-size: 9px; 
    color: #999;
  }
  
  .actividad-info { 
    flex: 1;
  }
  .actividad-info .actividad { 
    font-size: 12px; 
    font-weight: 600;
    color: #1d1d1f;
    margin-bottom: 2px;
  }
  .actividad-info .ots { 
    font-size: 10px; 
    color: #6e6e73;
  }
  
  @media print {
    body { padding: 12px; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <div class="header">
    <h1>VIXORA — Cronograma de Actividades</h1>
    <div class="sub">Período: ${fmtFechaLarga(fechaInicio)} → ${fmtFechaLarga(fechaFin)} ${fechaInicio.split("-")[0] !== fechaFin.split("-")[0] ? "(" + fechaInicio.split("-")[0] + "-" + fechaFin.split("-")[0] + ")" : "(" + fechaInicio.split("-")[0] + ")"}</div>
    <div class="meta">Generado: ${new Date().toLocaleString("es-PE")} · ${entradasFiltradas.length} asignaciones · ${tecnicosIncluidos.length} técnicos</div>
  </div>
  
  <div class="resumen-general">
    <div class="resumen-item">
      <div class="num">${entradasFiltradas.length}</div>
      <div class="lbl">Asignaciones</div>
    </div>
    <div class="resumen-item">
      <div class="num">${tecnicosIncluidos.length}</div>
      <div class="lbl">Técnicos</div>
    </div>
    <div class="resumen-item">
      <div class="num">${actividades.filter(a => actividadesSel.has(a.nombre)).length}</div>
      <div class="lbl">Actividades</div>
    </div>
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
          const rangoTxt = g.count === 1 
            ? fmtFechaLarga(g.fechaInicio)
            : `${fmtFechaLarga(g.fechaInicio)} → ${fmtFechaLarga(g.fechaFin)}`;
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
    <button onclick="window.print()" style="background: #E91E63; color: white; border: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: bold;">
      🖨️ Imprimir / Guardar como PDF
    </button>
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

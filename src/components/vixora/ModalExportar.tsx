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

  // Fechas default: mes actual
  const primerDiaMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1);
  const ultimoDiaMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0);

  const [fechaInicio, setFechaInicio] = useState(formatFechaISO(primerDiaMes));
  const [fechaFin, setFechaFin] = useState(formatFechaISO(ultimoDiaMes));

  // Selección de técnicos (todos activos por defecto)
  const tecnicosActivos = useMemo(() => tecnicos.filter((t) => t.activo), [tecnicos]);
  const [tecnicosSel, setTecnicosSel] = useState<Set<string>>(
    new Set(tecnicosActivos.map((t) => t.id))
  );

  // Selección de actividades (todas por defecto)
  const [actividadesSel, setActividadesSel] = useState<Set<string>>(
    new Set(actividades.map((a) => a.nombre))
  );

  // Formato de exportación
  const [formato, setFormato] = useState<"pdf" | "excel">("pdf");

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

  // Filtrar entradas según selección
  const entradasFiltradas = useMemo(() => {
    return Object.values(cronograma).filter((e) => {
      if (e.fecha < fechaInicio || e.fecha > fechaFin) return false;
      if (!tecnicosSel.has(e.tecnico_id)) return false;
      if (!actividadesSel.has(e.actividad)) return false;
      return true;
    });
  }, [cronograma, fechaInicio, fechaFin, tecnicosSel, actividadesSel]);

  // Mapa de OTs
  const otMap: Record<string, typeof ots[0]> = {};
  for (const o of ots) otMap[o.codigo] = o;

  // Mapa de técnicos
  const tecnicoMap: Record<string, typeof tecnicos[0]> = {};
  for (const t of tecnicos) tecnicoMap[t.id] = t;

  const handleClose = () => {
    setModalExportarAbierto(false);
  };

  // Exportar a Excel (CSV)
  const handleExportExcel = () => {
    if (entradasFiltradas.length === 0) {
      showToast("No hay datos para exportar con los filtros seleccionados", "error");
      return;
    }

    // Construir CSV
    const headers = ["Fecha", "Técnico", "Cargo", "Actividad", "OTs", "Detalle", "Notas"];
    const rows = entradasFiltradas
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.tecnico_id.localeCompare(b.tecnico_id))
      .map((e) => {
        const t = tecnicoMap[e.tecnico_id];
        const otsStr = e.ots_asignadas === "—" ? "" : e.ots_asignadas;
        const detalleStr = e.detalle === "—" ? "" : e.detalle.replace(/\n/g, " | ");
        return [
          e.fecha,
          t?.nombre ?? e.tecnico_id,
          t?.cargo ?? "",
          e.actividad,
          otsStr,
          detalleStr,
          e.notas || "",
        ];
      });

    // Escapar CSV (campos con comas o comillas)
    const escapeCsv = (s: string) => {
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map(escapeCsv).join(",")),
    ].join("\n");

    // Descargar
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `VIXORA_cronograma_${fechaInicio}_a_${fechaFin}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast(`Exportadas ${entradasFiltradas.length} entradas a CSV`, "ok");
  };

  // Exportar a PDF (imprimir)
  const handleExportPDF = () => {
    if (entradasFiltradas.length === 0) {
      showToast("No hay datos para exportar con los filtros seleccionados", "error");
      return;
    }

    const tecnicosIncluidos = tecnicosActivos.filter((t) => tecnicosSel.has(t.id));
    const actividadesIncluidas = actividades.filter((a) => actividadesSel.has(a.nombre));

    // Agrupar por técnico
    const porTecnico: Record<string, typeof entradasFiltradas> = {};
    for (const e of entradasFiltradas) {
      if (!porTecnico[e.tecnico_id]) porTecnico[e.tecnico_id] = [];
      porTecnico[e.tecnico_id].push(e);
    }

    // Construir HTML para imprimir
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>VIXORA Cronograma ${fechaInicio} a ${fechaFin}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; }
  body { padding: 20px; color: #1d1d1f; }
  h1 { color: #E91E63; font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 14px; color: #6e6e73; margin-bottom: 16px; font-weight: normal; }
  .info { background: #f5f5f7; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 11px; }
  .info strong { color: #1d1d1f; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { background: #1d1d1f; color: white; padding: 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-size: 10px; vertical-align: top; }
  .tecnico-header { background: #E91E63; color: white; padding: 8px 12px; font-weight: bold; font-size: 12px; margin-top: 16px; border-radius: 4px 4px 0 0; }
  .color-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
  .actividad { font-weight: bold; }
  .ots { color: #6e6e73; font-size: 9px; }
  .detalle { color: #6e6e73; font-size: 9px; white-space: pre-line; }
  @media print {
    body { padding: 0; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <h1>VIXORA — Cronograma de Actividades</h1>
  <h2>Período: ${fechaInicio.split("-").reverse().join("/")} → ${fechaFin.split("-").reverse().join("/")}</h2>
  
  <div class="info">
    <strong>Técnicos incluidos:</strong> ${tecnicosIncluidos.length} de ${tecnicosActivos.length} activos<br>
    <strong>Actividades incluidas:</strong> ${actividadesIncluidas.length} de ${actividades.length} totales<br>
    <strong>Total de asignaciones:</strong> ${entradasFiltradas.length}<br>
    <strong>Generado:</strong> ${new Date().toLocaleString("es-PE")}
  </div>

  ${tecnicosIncluidos.map((t) => {
    const entradas = (porTecnico[t.id] || []).sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (entradas.length === 0) return "";
    return `
      <div class="tecnico-header">${t.nombre} — ${t.cargo}</div>
      <table>
        <thead>
          <tr>
            <th style="width: 100px">Fecha</th>
            <th style="width: 140px">Actividad</th>
            <th>OTs</th>
            <th>Detalle</th>
            <th>Notas</th>
          </tr>
        </thead>
        <tbody>
          ${entradas.map((e) => {
            const act = actividades.find((a) => a.nombre === e.actividad);
            const hex = act ? COLOR_HEX[act.color] : null;
            const otsStr = e.ots_asignadas === "—" ? "" : e.ots_asignadas.split(",").map((c) => {
              const cod = c.trim();
              const ot = otMap[cod];
              return ot ? `${cod} (${ot.cliente})` : cod;
            }).join(", ");
            const detalleStr = e.detalle === "—" ? "" : e.detalle;
            return `
              <tr>
                <td>${e.fecha.split("-").reverse().join("/")}</td>
                <td><span class="color-dot" style="background:${hex?.border ?? "#999"}"></span><span class="actividad">${e.actividad}</span></td>
                <td class="ots">${otsStr}</td>
                <td class="detalle">${detalleStr}</td>
                <td class="detalle">${e.notas || ""}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  }).join("")}

  <div class="no-print" style="margin-top: 24px; text-align: center;">
    <button onclick="window.print()" style="background: #E91E63; color: white; border: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; cursor: pointer;">
      🖨️ Imprimir / Guardar como PDF
    </button>
  </div>
</body>
</html>`;

    // Abrir en nueva ventana
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-[95%] max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between text-white" style={{ backgroundColor: "#1d1d1f" }}>
          <div className="flex items-center gap-2">
            <FileText size={18} />
            <span className="text-sm font-bold">Exportar Cronograma</span>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-white/20 rounded">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Rango de fechas */}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
              Rango de fechas
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-pink-400"
              />
              <span className="text-gray-400">→</span>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-pink-400"
              />
            </div>
          </div>

          {/* Técnicos */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-700">
                Técnicos ({tecnicosSel.size} de {tecnicosActivos.length} seleccionados)
              </label>
              <div className="flex gap-2">
                <button onClick={selectAllTecnicos} className="text-[10px] text-pink-600 hover:underline">
                  Todos
                </button>
                <button onClick={deselectAllTecnicos} className="text-[10px] text-gray-500 hover:underline">
                  Ninguno
                </button>
              </div>
            </div>
            <div className="max-h-32 overflow-y-auto border border-gray-100 rounded p-2 grid grid-cols-2 gap-1">
              {tecnicosActivos.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-1.5 text-[11px] cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded"
                >
                  <button
                    onClick={() => toggleTecnico(t.id)}
                    className="shrink-0"
                  >
                    {tecnicosSel.has(t.id) ? (
                      <CheckSquare size={12} className="text-pink-600" />
                    ) : (
                      <Square size={12} className="text-gray-300" />
                    )}
                  </button>
                  <span className="truncate">{t.nombre}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Actividades */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-700">
                Actividades ({actividadesSel.size} de {actividades.length} seleccionadas)
              </label>
              <div className="flex gap-2">
                <button onClick={selectAllActividades} className="text-[10px] text-pink-600 hover:underline">
                  Todas
                </button>
                <button onClick={deselectAllActividades} className="text-[10px] text-gray-500 hover:underline">
                  Ninguna
                </button>
              </div>
            </div>
            <div className="max-h-32 overflow-y-auto border border-gray-100 rounded p-2 grid grid-cols-3 gap-1">
              {actividades.map((a) => {
                const hex = COLOR_HEX[a.color as keyof typeof COLOR_HEX];
                return (
                  <label
                    key={a.codigo}
                    className="flex items-center gap-1.5 text-[11px] cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded"
                  >
                    <button
                      onClick={() => toggleActividad(a.nombre)}
                      className="shrink-0"
                    >
                      {actividadesSel.has(a.nombre) ? (
                        <CheckSquare size={12} className="text-pink-600" />
                      ) : (
                        <Square size={12} className="text-gray-300" />
                      )}
                    </button>
                    <span
                      className="w-2 h-2 rounded shrink-0"
                      style={{ backgroundColor: hex.border }}
                    />
                    <span className="truncate">{a.nombre}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Resumen */}
          <div className="p-3 bg-pink-50 border border-pink-200 rounded">
            <div className="text-xs font-semibold text-pink-700 mb-1">Resumen de exportación:</div>
            <div className="text-[11px] text-pink-900 space-y-0.5">
              <div>📅 Período: {fechaInicio.split("-").reverse().join("/")} → {fechaFin.split("-").reverse().join("/")}</div>
              <div>👥 Técnicos: {tecnicosSel.size} seleccionado(s)</div>
              <div>🎯 Actividades: {actividadesSel.size} seleccionada(s)</div>
              <div className="font-bold mt-1">📊 Total: {entradasFiltradas.length} asignación(es) a exportar</div>
            </div>
          </div>

          {/* Formato */}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
              Formato de exportación
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setFormato("pdf")}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs rounded border-2 ${
                  formato === "pdf" ? "border-[#E91E63] bg-pink-50 text-pink-700" : "border-gray-200 text-gray-600"
                }`}
              >
                <Printer size={14} />
                PDF (imprimir)
              </button>
              <button
                onClick={() => setFormato("excel")}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs rounded border-2 ${
                  formato === "excel" ? "border-[#E91E63] bg-pink-50 text-pink-700" : "border-gray-200 text-gray-600"
                }`}
              >
                <Download size={14} />
                Excel (CSV)
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-3 flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={formato === "pdf" ? handleExportPDF : handleExportExcel}
            disabled={entradasFiltradas.length === 0}
            className="flex items-center gap-1 px-4 py-1.5 text-xs text-white rounded disabled:opacity-50"
            style={{ backgroundColor: "#E91E63" }}
          >
            {formato === "pdf" ? <Printer size={14} /> : <Download size={14} />}
            {formato === "pdf" ? "Generar PDF" : "Descargar CSV"}
          </button>
        </div>
      </div>
    </div>
  );
}

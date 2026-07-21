"use client";

import { useStore } from "@/lib/store";
import { useState, useMemo, useEffect } from "react";
import {
  Plus, RefreshCw, Pencil, X, Search, UserPlus,
  ArrowUp, ArrowDown, Save,
  calcularEstadoHabilitacion,
  ESTADO_VISUAL, type EstadoDocumento,
} from "@/lib/types";
import type { Habilitacion } from "@/lib/types";

interface Props {
  tecnicos: any[];
  modoAcceso: "lector" | "editor";
}

export function TecnicosManager({ tecnicos, modoAcceso }: Props) {
  const {
    ots, habilitaciones, cargarHabilitaciones, cargarDatosSilencioso,
    agregarTecnico, actualizarTecnico, toggleTecnico,
    sincronizarTecnicosExcel, showToast,
  } = useStore();

  const [query, setQuery] = useState("");
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [editandoTecnico, setEditandoTecnico] = useState<any | null>(null);
  const [creandoTecnico, setCreandoTecnico] = useState(false);
  const [actualizando, setActualizando] = useState(false);

  useEffect(() => {
    cargarHabilitaciones();
  }, [cargarHabilitaciones]);

  // Filtrar técnicos: eliminar filas vacías + filtro inactivos + búsqueda
  const tecnicosFiltrados = useMemo(() => {
    let result = tecnicos.filter(t => t.id && t.nombre && t.id.trim() !== "" && t.nombre.trim() !== "");
    if (!mostrarInactivos) {
      result = result.filter(t => t.activo);
    }
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(t =>
        t.id.toLowerCase().includes(q) ||
        t.nombre.toLowerCase().includes(q) ||
        t.cargo.toLowerCase().includes(q) ||
        (t.correo || "").toLowerCase().includes(q) ||
        (t.codigo_sap || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [tecnicos, query, mostrarInactivos]);

  const generarSiguienteId = () => {
    const ids = tecnicos.map(t => t.id).filter(id => id && id.startsWith("T"));
    const nums = ids.map(id => parseInt(id.substring(1), 10)).filter(n => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `T${String(max + 1).padStart(2, "0")}`;
  };

  const handleToggleActivo = async (t: any) => {
    if (t.activo) {
      if (!confirm(`¿Desactivar a ${t.nombre}? Aparecerá como inactivo hasta que lo reactives.`)) return;
    }
    await toggleTecnico(t.id, !t.activo);
  };

  const handleActualizarExcel = async () => {
    setActualizando(true);
    await sincronizarTecnicosExcel();
    setActualizando(false);
  };

  // FIX: Calcular resumen por OT para cada técnico
  // - Habilitado totalmente: OTs donde TODOS los docs están 🟢
  // - Habilitado parcialmente: OTs con algún 🟡 pero sin 🔴 ni ⚫
  // - En riesgo: OTs con algún 🔴 pero sin ⚫
  // - Inhabilitado: OTs con algún ⚫
  const calcularResumenPorTecnico = (tecId: string) => {
    const habsTec = habilitaciones.filter(h => h.tecnico_id === tecId && h.contabilizar !== false);
    if (habsTec.length === 0) return { total: 0, parcial: 0, riesgo: 0, inhabilitado: 0 };

    // Agrupar por OT
    const porOt: Record<string, Habilitacion[]> = {};
    for (const h of habsTec) {
      if (!porOt[h.ot_codigo]) porOt[h.ot_codigo] = [];
      porOt[h.ot_codigo].push(h);
    }

    let total = 0, parcial = 0, riesgo = 0, inhabilitado = 0;
    for (const habs of Object.values(porOt)) {
      const estados = habs.map(h => calcularEstadoHabilitacion(h));
      const tieneVencido = estados.some(e => e === "vencido");
      const tieneRiesgo = estados.some(e => e === "en_riesgo");
      const tienePorVencer = estados.some(e => e === "por_vencer");

      if (tieneVencido) inhabilitado++;
      else if (tieneRiesgo) riesgo++;
      else if (tienePorVencer) parcial++;
      else total++;
    }
    return { total, parcial, riesgo, inhabilitado };
  };

  const getIniciales = (nombre: string) => {
    const partes = nombre.trim().split(/\s+/);
    return partes.length >= 2 ? (partes[0][0] + partes[1][0]).toUpperCase() : nombre.substring(0, 2).toUpperCase();
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Técnicos</h2>
            <p className="text-sm text-gray-500">
              {tecnicosFiltrados.length} de {tecnicos.filter(t => t.id && t.nombre).length} técnicos
              {habilitaciones.length > 0 && ` · ${habilitaciones.length} habilitaciones`}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {modoAcceso === "editor" && (
              <>
                <button
                  onClick={() => setCreandoTecnico(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-white rounded bg-[#E91E63] hover:bg-[#c2185b]"
                >
                  <UserPlus size={14} /> Nuevo técnico
                </button>
                <button
                  onClick={handleActualizarExcel}
                  disabled={actualizando}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-[#E91E63] border border-[#E91E63] rounded hover:bg-pink-50 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={actualizando ? "animate-spin" : ""} />
                  {actualizando ? "Sincronizando..." : "Actualizar Excel"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-4 items-center flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por ID, nombre, cargo, correo o SAP..."
              className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={mostrarInactivos}
              onChange={(e) => setMostrarInactivos(e.target.checked)}
            />
            Mostrar inactivos
          </label>
        </div>

        {/* Tabla */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 w-12">Foto</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">ID</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Nombre</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Cargo</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Correo</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">SAP</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-600 w-16">🟢<br/>Total</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-600 w-16">🟡<br/>Parcial</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-600 w-16">🔴<br/>Riesgo</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-600 w-16">⚫<br/>Inhab.</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600 w-20">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tecnicosFiltrados.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-4 text-gray-400">No hay técnicos que coincidan</td></tr>
                ) : (
                  tecnicosFiltrados.map((t) => {
                    const resumen = calcularResumenPorTecnico(t.id);
                    return (
                      <tr
                        key={t.id}
                        className={`border-b border-gray-100 hover:bg-gray-50 ${!t.activo ? "opacity-50" : ""}`}
                      >
                        <td className="px-3 py-2">
                          <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-200 shrink-0">
                            {t.foto_url ? (
                              <img src={t.foto_url} alt={t.nombre} className="w-full h-full object-cover" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-500">{getIniciales(t.nombre)}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-700">{t.id}</td>
                        <td className="px-3 py-2 font-semibold text-gray-900">{t.nombre}</td>
                        <td className="px-3 py-2 text-gray-600">{t.cargo}</td>
                        <td className="px-3 py-2 text-gray-600">{t.correo || "—"}</td>
                        <td className="px-3 py-2 text-gray-600 font-mono">{t.codigo_sap || "—"}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`font-bold ${resumen.total > 0 ? "text-green-600" : "text-gray-300"}`}>
                            {resumen.total}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`font-bold ${resumen.parcial > 0 ? "text-yellow-600" : "text-gray-300"}`}>
                            {resumen.parcial}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`font-bold ${resumen.riesgo > 0 ? "text-red-600" : "text-gray-300"}`}>
                            {resumen.riesgo}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`font-bold ${resumen.inhabilitado > 0 ? "text-gray-900" : "text-gray-300"}`}>
                            {resumen.inhabilitado}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {modoAcceso === "editor" && (
                            <>
                              <button
                                onClick={() => setEditandoTecnico(t)}
                                className="p-1 rounded text-blue-600 hover:bg-blue-100"
                                title="Editar"
                              >
                                <Pencil size={14} />
                              </button>
                              {/* FIX: Toggle con flecha verde ↑ (activo) / roja ↓ (inactivo) */}
                              <button
                                onClick={() => handleToggleActivo(t)}
                                className={`p-1 rounded ml-1 ${t.activo ? "text-green-600 hover:bg-green-100" : "text-red-600 hover:bg-red-100"}`}
                                title={t.activo ? "Activo — click para desactivar" : "Inactivo — click para reactivar"}
                              >
                                {t.activo ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Leyenda */}
        <div className="mt-3 p-2 bg-gray-50 rounded text-[10px] text-gray-600 flex flex-wrap gap-3">
          <span className="font-bold">Resumen por OT:</span>
          <span className="flex items-center gap-1">🟢 <span className="text-green-700 font-semibold">Total</span>: todos los docs habilitados</span>
          <span className="flex items-center gap-1">🟡 <span className="text-yellow-700 font-semibold">Parcial</span>: faltan regularizar docs (por vencer)</span>
          <span className="flex items-center gap-1">🔴 <span className="text-red-700 font-semibold">Riesgo</span>: en riesgo de quedar deshabilitado</span>
          <span className="flex items-center gap-1">⚫ <span className="text-gray-700 font-semibold">Inhabilitado</span>: docs vencidos</span>
        </div>
      </div>

      {/* Modal crear técnico */}
      {creandoTecnico && (
        <ModalTecnico
          tecnico={null}
          siguienteId={generarSiguienteId()}
          onClose={() => setCreandoTecnico(false)}
          onSave={async (data) => {
            const ok = await agregarTecnico(data);
            if (ok) setCreandoTecnico(false);
          }}
        />
      )}

      {/* Modal editar técnico */}
      {editandoTecnico && (
        <ModalTecnico
          tecnico={editandoTecnico}
          siguienteId={editandoTecnico.id}
          onClose={() => setEditandoTecnico(null)}
          onSave={async (data) => {
            const ok = await actualizarTecnico(editandoTecnico.id, data);
            if (ok) setEditandoTecnico(null);
          }}
        />
      )}
    </div>
  );
}

// =============================================================
// SUBCOMPONENTE: Modal crear/editar técnico
// =============================================================
function ModalTecnico({
  tecnico, siguienteId, onClose, onSave,
}: {
  tecnico: any | null;
  siguienteId: string;
  onClose: () => void;
  onSave: (data: { id: string; cargo: string; nombre: string; correo: string; codigo_sap: string; foto_url?: string }) => Promise<void>;
}) {
  const [id, setId] = useState(tecnico?.id || siguienteId);
  const [cargo, setCargo] = useState(tecnico?.cargo || "Técnico");
  const [nombre, setNombre] = useState(tecnico?.nombre || "");
  const [correo, setCorreo] = useState(tecnico?.correo || "");
  const [codigo_sap, setCodigoSap] = useState(tecnico?.codigo_sap || "");
  const [foto_url, setFotoUrl] = useState(tecnico?.foto_url || "");
  const [guardando, setGuardando] = useState(false);

  const handleSave = async () => {
    if (!nombre.trim()) {
      alert("Nombre es obligatorio");
      return;
    }
    setGuardando(true);
    await onSave({ id, cargo, nombre, correo, codigo_sap, foto_url });
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-[95%] max-w-md max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 flex items-center justify-between text-white" style={{ backgroundColor: "#1d1d1f" }}>
          <div className="text-sm font-bold">{tecnico ? "Editar técnico" : "Nuevo técnico"}</div>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">ID</label>
            <input type="text" value={id} onChange={(e) => setId(e.target.value)} disabled={!!tecnico} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded disabled:bg-gray-100" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Nombre *</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Cargo</label>
            <select value={cargo} onChange={(e) => setCargo(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded bg-white">
              <option value="Supervisor">Supervisor</option>
              <option value="Especialista">Especialista</option>
              <option value="Técnico">Técnico</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Correo</label>
            <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Código SAP</label>
            <input type="text" value={codigo_sap} onChange={(e) => setCodigoSap(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">URL Foto</label>
            <input type="text" value={foto_url} onChange={(e) => setFotoUrl(e.target.value)} placeholder="https://..." className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
          </div>
        </div>
        <div className="border-t border-gray-200 p-3 flex justify-end gap-2">
          <button onClick={onClose} disabled={guardando} className="px-3 py-1.5 text-xs border border-gray-200 rounded hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={guardando} className="flex items-center gap-1 px-3 py-1.5 text-xs text-white rounded bg-[#E91E63] hover:bg-[#c2185b] disabled:opacity-50">
            <Save size={14} /> {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

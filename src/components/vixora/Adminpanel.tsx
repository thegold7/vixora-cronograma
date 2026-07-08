"use client";

import { useStore } from "@/lib/store";
import { useState, useEffect } from "react";
import { Plus, Trash2, Eye, EyeOff, Building2, Briefcase, Save, MapPin, RefreshCw } from "lucide-react";

export function AdminPanel() {
  const { ots, cargarDatosSilencioso, showToast } = useStore();
  const [sedes, setSedes] = useState<any[]>([]);
  const [cargandoSedes, setCargandoSedes] = useState(true);

  // Formularios
  const [nuevaSede, setNuevaSede] = useState({ nombre: "", lat: "", lng: "", region: "", ciudad: "", datoCurioso: "", foto_ciudad: "" });
  const [nuevaOt, setNuevaOt] = useState({ codigo: "", cliente: "", sede: "", estado: "EN PROCESO", visible_mapa: true });
  const [tabActivo, setTabActivo] = useState<"ots" | "sedes">("ots");

  // Cargar sedes desde la API
  const fetchSedes = async () => {
    setCargandoSedes(true);
    try {
      const res = await fetch("/api/sedes", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setSedes(json.data);
    } catch (err) {
      console.error("Error al cargar sedes:", err);
    } finally {
      setCargandoSedes(false);
    }
  };

  useEffect(() => {
    fetchSedes();
  }, []);

  // === Handlers OTs ===
  const handleAddOt = async () => {
    if (!nuevaOt.codigo || !nuevaOt.cliente) {
      showToast("Código y cliente son obligatorios", "error");
      return;
    }
    try {
      const res = await fetch("/api/ot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          accion: "agregar", 
          codigo: nuevaOt.codigo, 
          cliente: nuevaOt.cliente, 
          sede: nuevaOt.sede, 
          estado: nuevaOt.estado 
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      
      // Si se marcó como visible, asegurarse de que tenga visible_mapa=TRUE
      if (!nuevaOt.visible_mapa) {
        await fetch("/api/sedes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion: "toggle_visible", codigo: nuevaOt.codigo, visible: false }),
        });
      }
      
      await cargarDatosSilencioso();
      showToast(`OT ${nuevaOt.codigo} agregada`, "ok");
      setNuevaOt({ codigo: "", cliente: "", sede: "", estado: "EN PROCESO", visible_mapa: true });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al agregar OT", "error");
    }
  };

  const handleDeleteOt = async (codigo: string) => {
    if (!confirm(`¿Eliminar la OT ${codigo}?`)) return;
    try {
      const res = await fetch("/api/sedes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "eliminar_ot", codigo }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await cargarDatosSilencioso();
      showToast(`OT ${codigo} eliminada`, "ok");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al eliminar OT", "error");
    }
  };

  const handleToggleVisible = async (codigo: string, visible: boolean) => {
    try {
      const res = await fetch("/api/sedes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "toggle_visible", codigo, visible: !visible }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await cargarDatosSilencioso();
      showToast(`OT ${codigo} ${!visible ? 'visible' : 'oculta'} en mapa`, "ok");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al cambiar visibilidad", "error");
    }
  };

  // === Handlers Sedes ===
  const handleAddSede = async () => {
    if (!nuevaSede.nombre || !nuevaSede.lat || !nuevaSede.lng) {
      showToast("Nombre, latitud y longitud son obligatorios", "error");
      return;
    }
    try {
      const res = await fetch("/api/sedes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "agregar", ...nuevaSede }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await fetchSedes();
      showToast(`Sede ${nuevaSede.nombre} agregada`, "ok");
      setNuevaSede({ nombre: "", lat: "", lng: "", region: "", ciudad: "", datoCurioso: "", foto_ciudad: "" });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al agregar sede", "error");
    }
  };

  const handleDeleteSede = async (nombre: string) => {
    if (!confirm(`¿Eliminar la sede ${nombre}?`)) return;
    try {
      const res = await fetch("/api/sedes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "eliminar", nombre }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await fetchSedes();
      showToast(`Sede ${nombre} eliminada`, "ok");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al eliminar sede", "error");
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto overflow-y-auto h-full">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Panel de Administración</h2>
          <p className="text-sm text-gray-500">Gestiona OTs, Sedes y visibilidad en el mapa</p>
        </div>
        <button 
          onClick={() => { cargarDatosSilencioso(); fetchSedes(); }} 
          className="flex items-center gap-1 px-3 py-1.5 text-xs text-white rounded bg-[#E91E63] hover:bg-[#c2185b]"
        >
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTabActivo("ots")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${
            tabActivo === "ots" ? "border-[#E91E63] text-[#E91E63]" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Briefcase size={16} /> OTs
        </button>
        <button
          onClick={() => setTabActivo("sedes")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${
            tabActivo === "sedes" ? "border-[#E91E63] text-[#E91E63]" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Building2 size={16} /> Sedes (Ciudades)
        </button>
      </div>

      {/* Contenido Tab OTs */}
      {tabActivo === "ots" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario nueva OT */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 h-fit">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Plus size={16} className="text-[#E91E63]" /> Nueva OT
            </h3>
            <div className="space-y-2">
              <input type="text" placeholder="Código" value={nuevaOt.codigo} onChange={(e) => setNuevaOt({...nuevaOt, codigo: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
              <input type="text" placeholder="Cliente" value={nuevaOt.cliente} onChange={(e) => setNuevaOt({...nuevaOt, cliente: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
              <input type="text" placeholder="Sede (ej. MARCOBRE)" value={nuevaOt.sede} onChange={(e) => setNuevaOt({...nuevaOt, sede: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
              <select value={nuevaOt.estado} onChange={(e) => setNuevaOt({...nuevaOt, estado: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded">
                <option value="EN PROCESO">EN PROCESO</option>
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="FINALIZADO">FINALIZADO</option>
              </select>
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input type="checkbox" checked={nuevaOt.visible_mapa} onChange={(e) => setNuevaOt({...nuevaOt, visible_mapa: e.target.checked})} className="rounded" />
                Visible en mapa
              </label>
              <button onClick={handleAddOt} className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-white rounded bg-[#E91E63] hover:bg-[#c2185b]">
                <Save size={14} /> Guardar OT
              </button>
            </div>
          </div>

          {/* Lista de OTs */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">OTs Existentes ({ots.length})</h3>
            <div className="space-y-1 max-h-[600px] overflow-y-auto">
              {ots.map((ot) => (
                <div key={ot.codigo} className="flex items-center gap-2 p-2 border border-gray-100 rounded hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono font-bold text-gray-900">{ot.codigo}</div>
                    <div className="text-[11px] text-gray-600 truncate">{ot.cliente} · {ot.sede || "Sin sede"}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggleVisible(ot.codigo, ot.visible_mapa ?? true)}
                      className={`p-1.5 rounded ${ot.visible_mapa ? "text-green-600 bg-green-50" : "text-gray-400 bg-gray-100"}`}
                      title={ot.visible_mapa ? "Ocultar del mapa" : "Mostrar en mapa"}
                    >
                      {ot.visible_mapa ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button
                      onClick={() => handleDeleteOt(ot.codigo)}
                      className="p-1.5 rounded text-red-600 bg-red-50 hover:bg-red-100"
                      title="Eliminar OT"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Contenido Tab Sedes */}
      {tabActivo === "sedes" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario nueva Sede */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 h-fit">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Plus size={16} className="text-[#E91E63]" /> Nueva Sede/Ciudad
            </h3>
            <div className="space-y-2">
              <input type="text" placeholder="Nombre (ej. MARCOBRE)" value={nuevaSede.nombre} onChange={(e) => setNuevaSede({...nuevaSede, nombre: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
              <div className="flex gap-2">
                <input type="number" step="any" placeholder="Latitud" value={nuevaSede.lat} onChange={(e) => setNuevaSede({...nuevaSede, lat: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
                <input type="number" step="any" placeholder="Longitud" value={nuevaSede.lng} onChange={(e) => setNuevaSede({...nuevaSede, lng: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
              </div>
              <input type="text" placeholder="Región (ej. Nazca, Ica)" value={nuevaSede.region} onChange={(e) => setNuevaSede({...nuevaSede, region: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
              <input type="text" placeholder="Ciudad" value={nuevaSede.ciudad} onChange={(e) => setNuevaSede({...nuevaSede, ciudad: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
              <textarea placeholder="Dato curioso" value={nuevaSede.datoCurioso} onChange={(e) => setNuevaSede({...nuevaSede, datoCurioso: e.target.value})} rows={2} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded resize-none" />
              <input type="text" placeholder="URL Foto ciudad" value={nuevaSede.foto_ciudad} onChange={(e) => setNuevaSede({...nuevaSede, foto_ciudad: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
              <button onClick={handleAddSede} className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-white rounded bg-[#E91E63] hover:bg-[#c2185b]">
                <Save size={14} /> Guardar Sede
              </button>
            </div>
          </div>

          {/* Lista de Sedes */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Sedes Existentes ({sedes.length})</h3>
            {cargandoSedes ? (
              <p className="text-xs text-gray-400">Cargando...</p>
            ) : (
              <div className="space-y-1 max-h-[600px] overflow-y-auto">
                {sedes.map((sede) => (
                  <div key={sede.nombre} className="flex items-center gap-2 p-2 border border-gray-100 rounded hover:bg-gray-50">
                    <MapPin size={16} className="text-[#E91E63] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-gray-900">{sede.nombre}</div>
                      <div className="text-[11px] text-gray-600 truncate">{sede.ciudad} · {sede.region} ({sede.lat}, {sede.lng})</div>
                    </div>
                    <button
                      onClick={() => handleDeleteSede(sede.nombre)}
                      className="p-1.5 rounded text-red-600 bg-red-50 hover:bg-red-100 shrink-0"
                      title="Eliminar Sede"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {sedes.length === 0 && (
                  <p className="text-xs text-gray-400 italic mt-2">No hay sedes personalizadas. Se usan las coordenadas predefinidas.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

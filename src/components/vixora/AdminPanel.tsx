"use client";

import { useStore } from "@/lib/store";
import { useState, useEffect } from "react";
import { Plus, Trash2, Eye, EyeOff, Building2, Briefcase, Save, MapPin, RefreshCw, Pencil, X, ChevronDown, ChevronUp } from "lucide-react";

export function AdminPanel() {
  const { cargarDatosSilencioso, showToast } = useStore();
  const [allOts, setAllOts] = useState<any[]>([]);
  const [sedes, setSedes] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  const [editandoOt, setEditandoOt] = useState<string | null>(null);
  const [formData, setFormData] = useState({ codigo: "", cliente: "", sede: "", estado: "EN PROCESO", visible_mapa: true });
  
  const [editandoSede, setEditandoSede] = useState<string | null>(null);
  const [formSede, setFormSede] = useState({ nombre: "", lat: "", lng: "", region: "", ciudad: "", datoCurioso: "", foto_ciudad: "" });
  
  const [tabActivo, setTabActivo] = useState<"ots" | "sedes">("ots");
  const [sedeExpandida, setSedeExpandida] = useState<string | null>(null);

  const fetchAllData = async () => {
    setCargando(true);
    try {
      const [resOts, resSedes] = await Promise.all([
        fetch("/api/ot", { cache: "no-store" }),
        fetch("/api/sedes", { cache: "no-store" })
      ]);
      const jsonOts = await resOts.json();
      const jsonSedes = await resSedes.json();
      if (jsonOts.ok) setAllOts(jsonOts.data);
      if (jsonSedes.ok) setSedes(jsonSedes.data);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { fetchAllData(); }, []);

  const resetFormOt = () => {
    setEditandoOt(null);
    setFormData({ codigo: "", cliente: "", sede: "", estado: "EN PROCESO", visible_mapa: true });
  };

  const handleEditOt = (ot: any) => {
    setEditandoOt(ot.codigo);
    setFormData({ codigo: ot.codigo, cliente: ot.cliente, sede: ot.sede, estado: ot.estado, visible_mapa: ot.visible_mapa ?? true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitOt = async () => {
    if (!formData.codigo || !formData.cliente) return showToast("Código y cliente son obligatorios", "error");
    try {
      if (editandoOt) {
        const res = await fetch("/api/ot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion: "actualizar", codigoOriginal: editandoOt, nuevoCodigo: formData.codigo, cliente: formData.cliente, sede: formData.sede, estado: formData.estado }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error);
        showToast(`OT actualizada`, "ok");
      } else {
        const res = await fetch("/api/ot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion: "agregar", codigo: formData.codigo, cliente: formData.cliente, sede: formData.sede, estado: formData.estado }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error);
        if (!formData.visible_mapa) {
          await fetch("/api/sedes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "toggle_visible", codigo: formData.codigo, visible: false }) });
        }
        showToast(`OT agregada`, "ok");
      }
      await fetchAllData();
      await cargarDatosSilencioso();
      resetFormOt();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error", "error");
    }
  };

  const handleDeleteOt = async (codigo: string) => {
    if (!confirm(`¿Eliminar OT ${codigo}?`)) return;
    try {
      const res = await fetch("/api/sedes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "eliminar_ot", codigo }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await fetchAllData();
      await cargarDatosSilencioso();
      showToast(`OT eliminada`, "ok");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error", "error");
    }
  };

  const handleToggleVisibleOt = async (codigo: string, visible: boolean) => {
    try {
      const res = await fetch("/api/sedes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "toggle_visible", codigo, visible: !visible }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await fetchAllData();
      await cargarDatosSilencioso();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error", "error");
    }
  };

  const resetFormSede = () => {
    setEditandoSede(null);
    setFormSede({ nombre: "", lat: "", lng: "", region: "", ciudad: "", datoCurioso: "", foto_ciudad: "" });
  };

  const handleEditSede = (sede: any) => {
    setEditandoSede(sede.nombre);
    setFormSede({ nombre: sede.nombre, lat: String(sede.lat), lng: String(sede.lng), region: sede.region, ciudad: sede.ciudad, datoCurioso: sede.datoCurioso, foto_ciudad: sede.foto_ciudad });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitSede = async () => {
    if (!formSede.nombre || !formSede.lat || !formSede.lng) return showToast("Nombre, lat y lng son obligatorios", "error");
    try {
      if (editandoSede) {
        const res = await fetch("/api/sedes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion: "actualizar_sede", nombreOriginal: editandoSede, newData: formSede }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error);
        showToast(`Sede actualizada en Excel`, "ok");
      } else {
        const res = await fetch("/api/sedes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion: "agregar", ...formSede }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error);
        showToast(`Sede agregada al Excel`, "ok");
      }
      await fetchAllData();
      resetFormSede();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error", "error");
    }
  };

  const handleDeleteSede = async (nombre: string) => {
    if (!confirm(`¿Eliminar la sede ${nombre}?`)) return;
    try {
      const res = await fetch("/api/sedes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "eliminar", nombre }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await fetchAllData();
      showToast(`Sede eliminada`, "ok");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error", "error");
    }
  };

  // NUEVO: Ocultar/mostrar sede en el mapa
  const handleToggleVisibleSede = async (nombre: string, visible: boolean) => {
    try {
      const res = await fetch("/api/sedes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "toggle_visible_sede", nombre, visible: !visible }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await fetchAllData();
      showToast(`Sede ${!visible ? 'visible' : 'oculta'} en el mapa`, "ok");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error", "error");
    }
  };

  const getOtsDeSede = (sedeNombre: string) => allOts.filter(ot => ot.sede === sedeNombre);

  return (
    <div className="p-6 max-w-7xl mx-auto overflow-y-auto h-full">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Panel de Administración</h2>
          <p className="text-sm text-gray-500">Gestiona OTs, Sedes y visibilidad en el mapa</p>
        </div>
        <button onClick={() => { cargarDatosSilencioso(); fetchAllData(); }} className="flex items-center gap-1 px-3 py-1.5 text-xs text-white rounded bg-[#E91E63] hover:bg-[#c2185b]">
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button onClick={() => setTabActivo("ots")} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${tabActivo === "ots" ? "border-[#E91E63] text-[#E91E63]" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          <Briefcase size={16} /> OTs ({allOts.length})
        </button>
        <button onClick={() => setTabActivo("sedes")} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${tabActivo === "sedes" ? "border-[#E91E63] text-[#E91E63]" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          <Building2 size={16} /> Sedes ({sedes.length})
        </button>
      </div>

      {tabActivo === "ots" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4 h-fit">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              {editandoOt ? <Pencil size={16} className="text-[#E91E63]" /> : <Plus size={16} className="text-[#E91E63]" />}
              {editandoOt ? `Editar OT ${editandoOt}` : "Nueva OT"}
            </h3>
            <div className="space-y-2">
              <input type="text" placeholder="Código" value={formData.codigo} onChange={(e) => setFormData({...formData, codigo: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
              <input type="text" placeholder="Cliente" value={formData.cliente} onChange={(e) => setFormData({...formData, cliente: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
              <select value={formData.sede} onChange={(e) => setFormData({...formData, sede: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded bg-white">
                <option value="">Seleccionar Sede...</option>
                {sedes.map((s) => (<option key={s.nombre} value={s.nombre}>{s.nombre} ({s.ciudad})</option>))}
              </select>
              <select value={formData.estado} onChange={(e) => setFormData({...formData, estado: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded bg-white">
                <option value="EN PROCESO">EN PROCESO</option>
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="FINALIZADO">FINALIZADO</option>
                <option value="PERDIDO">PERDIDO</option>
              </select>
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input type="checkbox" checked={formData.visible_mapa} onChange={(e) => setFormData({...formData, visible_mapa: e.target.checked})} className="rounded" />
                Visible en mapa
              </label>
              <div className="flex gap-2">
                {editandoOt && (<button onClick={resetFormOt} className="flex items-center justify-center gap-1 py-1.5 px-3 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50"><X size={14} /> Cancelar</button>)}
                <button onClick={handleSubmitOt} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-white rounded bg-[#E91E63] hover:bg-[#c2185b]"><Save size={14} /> {editandoOt ? "Actualizar" : "Guardar"}</button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Backlog de OTs</h3>
            {cargando ? <p className="text-xs text-gray-400">Cargando...</p> : (
              <div className="space-y-1 max-h-[600px] overflow-y-auto">
                {allOts.map((ot) => (
                  <div key={ot.codigo} className="flex items-center gap-2 p-2 border border-gray-100 rounded hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono font-bold text-gray-900">{ot.codigo}</div>
                      <div className="text-[11px] text-gray-600 truncate">{ot.cliente} · {ot.sede || "Sin sede"}</div>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold ${ot.estado === "EN PROCESO" ? "bg-yellow-100 text-yellow-700" : ot.estado === "FINALIZADO" ? "bg-green-100 text-green-700" : ot.estado === "PENDIENTE" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>{ot.estado}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => handleToggleVisibleOt(ot.codigo, ot.visible_mapa ?? true)} className={`p-1.5 rounded ${ot.visible_mapa ? "text-green-600 bg-green-50" : "text-gray-400 bg-gray-100"}`} title="Visibilidad mapa">{ot.visible_mapa ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                      <button onClick={() => handleEditOt(ot)} className="p-1.5 rounded text-blue-600 bg-blue-50 hover:bg-blue-100" title="Editar"><Pencil size={14} /></button>
                      <button onClick={() => handleDeleteOt(ot.codigo)} className="p-1.5 rounded text-red-600 bg-red-50 hover:bg-red-100" title="Eliminar"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tabActivo === "sedes" && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              {editandoSede ? <Pencil size={16} className="text-[#E91E63]" /> : <Plus size={16} className="text-[#E91E63]" />}
              {editandoSede ? `Editar Sede: ${editandoSede}` : "Nueva Sede"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-7 gap-2 items-end">
              <div className="md:col-span-1">
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Nombre</label>
                <input type="text" value={formSede.nombre} onChange={(e) => setFormSede({...formSede, nombre: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Latitud</label>
                <input type="number" step="any" value={formSede.lat} onChange={(e) => setFormSede({...formSede, lat: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Longitud</label>
                <input type="number" step="any" value={formSede.lng} onChange={(e) => setFormSede({...formSede, lng: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Región</label>
                <input type="text" value={formSede.region} onChange={(e) => setFormSede({...formSede, region: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Ciudad</label>
                <input type="text" value={formSede.ciudad} onChange={(e) => setFormSede({...formSede, ciudad: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase">URL Foto</label>
                <input type="text" value={formSede.foto_ciudad} onChange={(e) => setFormSede({...formSede, foto_ciudad: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
              </div>
              <div className="md:col-span-7">
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Dato Curioso</label>
                <textarea value={formSede.datoCurioso} onChange={(e) => setFormSede({...formSede, datoCurioso: e.target.value})} rows={2} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded resize-none" />
              </div>
              <div className="md:col-span-7 flex gap-2 justify-end mt-2">
                {editandoSede && (<button onClick={resetFormSede} className="flex items-center justify-center gap-1 py-1.5 px-3 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50"><X size={14} /> Cancelar</button>)}
                <button onClick={handleSubmitSede} className="flex items-center justify-center gap-1 py-1.5 px-4 text-xs text-white rounded bg-[#E91E63] hover:bg-[#c2185b]"><Save size={14} /> Guardar en Excel</button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Nombre</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Lat</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Lng</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Región</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Ciudad</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Dato Curioso</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-600">OTs</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cargando ? (
                    <tr><td colSpan={8} className="text-center py-4 text-gray-400">Cargando...</td></tr>
                  ) : (
                    sedes.map((sede) => {
                      const otsDeSede = getOtsDeSede(sede.nombre);
                      const isExpanded = sedeExpandida === sede.nombre;
                      const isVisible = sede.visible ?? true;
                      return (
                        <>
                          <tr key={sede.nombre} className={`border-b border-gray-100 hover:bg-gray-50 ${!isVisible ? 'opacity-50' : ''}`}>
                            <td className="px-3 py-2 font-medium text-gray-900">
                              <div className="flex items-center gap-2">
                                <button onClick={() => setSedeExpandida(isExpanded ? null : sede.nombre)} className="p-0.5 hover:bg-gray-200 rounded">
                                  {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>
                                {sede.nombre}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-gray-600">{sede.lat}</td>
                            <td className="px-3 py-2 text-gray-600">{sede.lng}</td>
                            <td className="px-3 py-2 text-gray-600">{sede.region}</td>
                            <td className="px-3 py-2 text-gray-600">{sede.ciudad}</td>
                            <td className="px-3 py-2 text-gray-500 max-w-xs truncate">{sede.datoCurioso}</td>
                            <td className="px-3 py-2 text-center"><span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-medium">{otsDeSede.length}</span></td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              <button onClick={() => handleToggleVisibleSede(sede.nombre, isVisible)} className={`p-1 rounded ${isVisible ? "text-green-600 hover:bg-green-100" : "text-gray-400 hover:bg-gray-200"}`} title="Visibilidad en mapa">
                                {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                              </button>
                              <button onClick={() => handleEditSede(sede)} className="p-1 rounded text-blue-600 hover:bg-blue-100 ml-1" title="Editar"><Pencil size={14} /></button>
                              <button onClick={() => handleDeleteSede(sede.nombre)} className="p-1 rounded text-red-600 hover:bg-red-100 ml-1" title="Eliminar"><Trash2 size={14} /></button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-gray-50">
                              <td colSpan={8} className="px-4 py-2">
                                <div className="text-[10px] font-bold text-gray-500 uppercase mb-2">OTs Asignadas ({otsDeSede.length}):</div>
                                {otsDeSede.length === 0 ? (
                                  <p className="text-[10px] text-gray-400">No hay OTs asignadas a esta sede.</p>
                                ) : (
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {otsDeSede.map(ot => (
                                      <div key={ot.codigo} className="flex items-center gap-2 text-[10px] bg-white p-1.5 rounded border border-gray-100">
                                        <span className="font-mono font-bold text-gray-900">{ot.codigo}</span>
                                        <span className="text-gray-600 truncate flex-1">{ot.cliente}</span>
                                        <span className={`px-1 py-0.5 rounded font-semibold ${ot.estado === "EN PROCESO" ? "bg-yellow-100 text-yellow-700" : ot.estado === "FINALIZADO" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{ot.estado.slice(0,3)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

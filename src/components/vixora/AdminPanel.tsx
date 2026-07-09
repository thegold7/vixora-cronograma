"use client";

import { useStore } from "@/lib/store";
import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Save, MapPin, RefreshCw, Pencil, X, ChevronDown, ChevronUp, Building2, Upload, Search, ArrowUpDown } from "lucide-react";
import { MINAS_PERU } from "@/lib/minasData";

export function AdminPanel() {
  const { cargarDatosSilencioso, showToast } = useStore();
  const [allOts, setAllOts] = useState<any[]>([]);
  const [sedes, setSedes] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  const [editandoTipo, setEditandoTipo] = useState<"ot" | "sede" | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  
  const [formOt, setFormOt] = useState({ codigo: "", cliente: "", sede: "", estado: "EN PROCESO" });
  const [formSede, setFormSede] = useState({ nombre: "", lat: "", lng: "", region: "", ciudad: "", datoCurioso: "", foto_ciudad: "" });
  
  const [sedeExpandida, setSedeExpandida] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filtroOts, setFiltroOts] = useState<"todas" | "conOts" | "sinOts" | "masOts" | "menosOts">("todas");

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

  const getOtsDeSede = (sedeNombre: string) => allOts.filter(ot => ot.sede === sedeNombre);

  const sedesFiltradas = useMemo(() => {
    let result = sedes.map(s => ({ ...s, otCount: getOtsDeSede(s.nombre).length }));

    if (query) {
      const q = query.toLowerCase();
      result = result.filter(s => 
        s.nombre.toLowerCase().includes(q) || 
        s.ciudad.toLowerCase().includes(q) || 
        s.region.toLowerCase().includes(q)
      );
    }

    switch (filtroOts) {
      case "conOts": result = result.filter(s => s.otCount > 0); break;
      case "sinOts": result = result.filter(s => s.otCount === 0); break;
      case "masOts": result = result.sort((a, b) => b.otCount - a.otCount); break;
      case "menosOts": result = result.sort((a, b) => a.otCount - b.otCount); break;
    }

    return result;
  }, [sedes, allOts, query, filtroOts]);

  // === Handlers ===
  const resetFormOt = () => { setEditandoTipo(null); setEditandoId(null); setFormOt({ codigo: "", cliente: "", sede: "", estado: "EN PROCESO" }); };
  const handleEditOt = (ot: any) => { setEditandoTipo("ot"); setEditandoId(ot.codigo); setFormOt({ codigo: ot.codigo, cliente: ot.cliente, sede: ot.sede, estado: ot.estado }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleSubmitOt = async () => {
    if (!formOt.codigo || !formOt.cliente) return showToast("Código y cliente son obligatorios", "error");
    try {
      const accion = editandoId ? "actualizar" : "agregar";
      const body = editandoId ? { accion, codigoOriginal: editandoId, nuevoCodigo: formOt.codigo, cliente: formOt.cliente, sede: formOt.sede, estado: formOt.estado } : { accion, ...formOt };
      const res = await fetch("/api/ot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      showToast(`OT ${editandoId ? 'actualizada' : 'agregada'}`, "ok");
      await fetchAllData(); await cargarDatosSilencioso(); resetFormOt();
    } catch (err) { showToast(err instanceof Error ? err.message : "Error", "error"); }
  };
  const handleDeleteOt = async (codigo: string) => {
    if (!confirm(`¿Eliminar OT ${codigo}?`)) return;
    try {
      const res = await fetch("/api/sedes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "eliminar_ot", codigo }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await fetchAllData(); await cargarDatosSilencioso(); showToast(`OT eliminada`, "ok");
    } catch (err) { showToast(err instanceof Error ? err.message : "Error", "error"); }
  };

  const resetFormSede = () => { setEditandoTipo(null); setEditandoId(null); setFormSede({ nombre: "", lat: "", lng: "", region: "", ciudad: "", datoCurioso: "", foto_ciudad: "" }); };
  const handleEditSede = (sede: any) => { setEditandoTipo("sede"); setEditandoId(sede.nombre); setFormSede({ nombre: sede.nombre, lat: String(sede.lat), lng: String(sede.lng), region: sede.region, ciudad: sede.ciudad, datoCurioso: sede.datoCurioso, foto_ciudad: sede.foto_ciudad }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleSubmitSede = async () => {
    if (!formSede.nombre || !formSede.lat || !formSede.lng) return showToast("Nombre, lat y lng son obligatorios", "error");
    try {
      const accion = editandoId ? "actualizar_sede" : "agregar";
      const body = editandoId ? { accion, nombreOriginal: editandoId, newData: formSede } : { accion, ...formSede };
      const res = await fetch("/api/sedes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      showToast(`Sede ${editandoId ? 'actualizada' : 'agregada'}`, "ok");
      await fetchAllData(); resetFormSede();
    } catch (err) { showToast(err instanceof Error ? err.message : "Error", "error"); }
  };
  const handleDeleteSede = async (nombre: string) => {
    if (!confirm(`¿Eliminar la sede ${nombre}?`)) return;
    try {
      const res = await fetch("/api/sedes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "eliminar", nombre }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await fetchAllData(); showToast(`Sede eliminada`, "ok");
    } catch (err) { showToast(err instanceof Error ? err.message : "Error", "error"); }
  };

  // FIX: Sincronizar TODO (Excel + Predefinidas) sin borrar las custom
  const handleSincronizarTodo = async () => {
    if (!confirm("¿Sincronizar todas las sedes al Excel? Se agregarán las 30 predefinidas manteniendo las que ya creaste.")) return;
    try {
      // 1. Copiar las sedes actuales del Excel
      const sedesActuales = sedes.map(s => ({ ...s }));
      
      // 2. Agregar las predefinidas que no existan ya
      const nombresActuales = new Set(sedesActuales.map(s => s.nombre.toUpperCase()));
      MINAS_PERU.forEach(p => {
        if (!nombresActuales.has(p.nombre.toUpperCase())) {
          sedesActuales.push({ ...p, visible: true });
        }
      });

      // 3. Enviar todo al Excel
      const res = await fetch("/api/sedes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "sincronizar", sedes: sedesActuales }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await fetchAllData(); showToast("Sedes sincronizadas en Excel", "ok");
    } catch (err) { showToast(err instanceof Error ? err.message : "Error", "error"); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto overflow-y-auto h-full">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Panel de Administración</h2>
          <p className="text-sm text-gray-500">Gestión unificada de Sedes y OTs</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSincronizarTodo} className="flex items-center gap-1 px-3 py-1.5 text-xs text-[#E91E63] border border-[#E91E63] rounded hover:bg-pink-50">
            <Upload size={14} /> Sincronizar Excel
          </button>
          <button onClick={() => { cargarDatosSilencioso(); fetchAllData(); }} className="flex items-center gap-1 px-3 py-1.5 text-xs text-white rounded bg-[#E91E63] hover:bg-[#c2185b]">
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
      </div>

      {/* Formulario flotante */}
      {editandoTipo && (
        <div className="mb-6 bg-white border-2 border-[#E91E63] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              {editandoTipo === "sede" ? <Building2 size={16} className="text-[#E91E63]" /> : <Plus size={16} className="text-[#E91E63]" />}
              {editandoId ? `Editando: ${editandoId}` : `Nueva ${editandoTipo === "sede" ? "Sede" : "OT"}`}
            </h3>
            <button onClick={() => { editandoTipo === "sede" ? resetFormSede() : resetFormOt(); }} className="p-1 text-gray-400 hover:text-red-500"><X size={16} /></button>
          </div>

          {editandoTipo === "sede" ? (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-2 items-end">
              <div className="md:col-span-1"><label className="text-[10px] font-semibold text-gray-500 uppercase">Nombre</label><input type="text" value={formSede.nombre} onChange={(e) => setFormSede({...formSede, nombre: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" /></div>
              <div><label className="text-[10px] font-semibold text-gray-500 uppercase">Lat</label><input type="number" step="any" value={formSede.lat} onChange={(e) => setFormSede({...formSede, lat: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" /></div>
              <div><label className="text-[10px] font-semibold text-gray-500 uppercase">Lng</label><input type="number" step="any" value={formSede.lng} onChange={(e) => setFormSede({...formSede, lng: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" /></div>
              <div><label className="text-[10px] font-semibold text-gray-500 uppercase">Región</label><input type="text" value={formSede.region} onChange={(e) => setFormSede({...formSede, region: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" /></div>
              <div><label className="text-[10px] font-semibold text-gray-500 uppercase">Ciudad</label><input type="text" value={formSede.ciudad} onChange={(e) => setFormSede({...formSede, ciudad: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" /></div>
              <div><label className="text-[10px] font-semibold text-gray-500 uppercase">URL Foto</label><input type="text" value={formSede.foto_ciudad} onChange={(e) => setFormSede({...formSede, foto_ciudad: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" /></div>
              <div className="md:col-span-7"><label className="text-[10px] font-semibold text-gray-500 uppercase">Dato Curioso</label><textarea value={formSede.datoCurioso} onChange={(e) => setFormSede({...formSede, datoCurioso: e.target.value})} rows={2} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded resize-none" /></div>
              <div className="md:col-span-7 flex justify-end mt-2"><button onClick={handleSubmitSede} className="flex items-center gap-1 py-1.5 px-4 text-xs text-white rounded bg-[#E91E63] hover:bg-[#c2185b]"><Save size={14} /> Guardar</button></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
              <div><label className="text-[10px] font-semibold text-gray-500 uppercase">Código</label><input type="text" value={formOt.codigo} onChange={(e) => setFormOt({...formOt, codigo: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" /></div>
              <div><label className="text-[10px] font-semibold text-gray-500 uppercase">Cliente</label><input type="text" value={formOt.cliente} onChange={(e) => setFormOt({...formOt, cliente: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" /></div>
              <div><label className="text-[10px] font-semibold text-gray-500 uppercase">Sede</label>
                <select value={formOt.sede} onChange={(e) => setFormOt({...formOt, sede: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded bg-white">
                  <option value="">Sin sede</option>
                  {sedes.map((s) => (<option key={s.nombre} value={s.nombre}>{s.nombre}</option>))}
                </select>
              </div>
              <div><label className="text-[10px] font-semibold text-gray-500 uppercase">Estado</label>
                <select value={formOt.estado} onChange={(e) => setFormOt({...formOt, estado: e.target.value})} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded bg-white">
                  <option value="EN PROCESO">EN PROCESO</option><option value="PENDIENTE">PENDIENTE</option><option value="FINALIZADO">FINALIZADO</option><option value="PERDIDO">PERDIDO</option>
                </select>
              </div>
              <div className="md:col-span-4 flex justify-end mt-2"><button onClick={handleSubmitOt} className="flex items-center gap-1 py-1.5 px-4 text-xs text-white rounded bg-[#E91E63] hover:bg-[#c2185b]"><Save size={14} /> Guardar</button></div>
            </div>
          )}
        </div>
      )}

      {/* Botones de agregar */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => { resetFormSede(); setEditandoTipo("sede"); }} className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50">
          <Building2 size={14} /> Nueva Sede
        </button>
        <button onClick={() => { resetFormOt(); setEditandoTipo("ot"); }} className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50">
          <Plus size={14} /> Nueva OT
        </button>
      </div>

      {/* Filtros y Búsqueda */}
      <div className="flex gap-2 mb-4 items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar sede o ciudad..." className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded" />
        </div>
        <select value={filtroOts} onChange={(e) => setFiltroOts(e.target.value as any)} className="px-2 py-1.5 text-xs border border-gray-200 rounded bg-white">
          <option value="todas">Todas las sedes</option>
          <option value="conOts">Con OTs asignadas</option>
          <option value="sinOts">Sin OTs asignadas</option>
          <option value="masOts">Con más OTs</option>
          <option value="menosOts">Con menos OTs</option>
        </select>
      </div>

      {/* Tabla unificada */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 w-8"></th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Sede / OT</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Región / Cliente</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Coordenadas</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Ciudad / Estado</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-600">OTs</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={7} className="text-center py-4 text-gray-400">Cargando...</td></tr>
              ) : (
                sedesFiltradas.map((sede) => {
                  const otsDeSede = getOtsDeSede(sede.nombre);
                  const isExpanded = sedeExpandida === sede.nombre;
                  return (
                    <>
                      <tr key={sede.nombre} className="border-b border-gray-200 hover:bg-gray-50 font-medium">
                        <td className="px-3 py-2">
                          <button onClick={() => setSedeExpandida(isExpanded ? null : sede.nombre)} className="p-0.5 hover:bg-gray-200 rounded">
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-gray-900"><span className="flex items-center gap-1"><MapPin size={12} className="text-[#E91E63]" /> {sede.nombre}</span></td>
                        <td className="px-3 py-2 text-gray-600">{sede.region}</td>
                        <td className="px-3 py-2 text-gray-500 text-[10px]">{sede.lat}, {sede.lng}</td>
                        <td className="px-3 py-2 text-gray-500">{sede.ciudad}</td>
                        <td className="px-3 py-2 text-center"><span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-medium">{otsDeSede.length}</span></td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button onClick={() => handleEditSede(sede)} className="p-1 rounded text-blue-600 hover:bg-blue-100"><Pencil size={14} /></button>
                          <button onClick={() => handleDeleteSede(sede.nombre)} className="p-1 rounded text-red-600 hover:bg-red-100 ml-1"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <>
                          {otsDeSede.length === 0 ? (
                            <tr className="bg-gray-50"><td colSpan={7} className="px-8 py-2 text-[10px] text-gray-400 italic">No hay OTs asignadas a esta sede</td></tr>
                          ) : (
                            otsDeSede.map(ot => (
                              <tr key={ot.codigo} className="bg-gray-50 border-b border-gray-100">
                                <td className="px-3 py-1.5"></td>
                                <td className="px-3 py-1.5 font-mono text-[10px] text-gray-700 pl-8">↳ {ot.codigo}</td>
                                <td className="px-3 py-1.5 text-gray-600 text-[10px]">{ot.cliente}</td>
                                <td className="px-3 py-1.5 text-gray-400 text-[10px]">—</td>
                                <td className="px-3 py-1.5">
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold ${ot.estado === "EN PROCESO" ? "bg-yellow-100 text-yellow-700" : ot.estado === "FINALIZADO" ? "bg-green-100 text-green-700" : ot.estado === "PENDIENTE" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>{ot.estado}</span>
                                </td>
                                <td className="px-3 py-1.5"></td>
                                <td className="px-3 py-1.5 text-right whitespace-nowrap">
                                  <button onClick={() => handleEditOt(ot)} className="p-1 rounded text-blue-600 hover:bg-blue-100"><Pencil size={12} /></button>
                                  <button onClick={() => handleDeleteOt(ot.codigo)} className="p-1 rounded text-red-600 hover:bg-red-100 ml-1"><Trash2 size={12} /></button>
                                </td>
                              </tr>
                            ))
                          )}
                        </>
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
  );
}

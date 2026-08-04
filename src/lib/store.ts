/**
 * Store Zustand para la app VIXORA.
 * FIX: Añadidas acciones de backup. borrarEntradaRango ahora usa deleteEntradasRango (batch).
 */
"use client";

import { create } from "zustand";
import type {
  Tecnico,
  OT,
  Actividad,
  EntradaCronograma,
  VistaCalendario,
  ModoAcceso,
  ColorActividad,
  Habilitacion,
  SubDocumento,
  Sede,
  PresetSede,
  PresetDocumento,
} from "@/lib/types";

export interface CronogramaMap {
  [key: string]: EntradaCronograma;
}

export interface SeleccionRango {
  inicio: string | null;
  fin: string | null;
  tecnico_id: string | null;
}

export interface ClipboardData {
  tecnico_origen: string;
  entradas: { offset_dias: number; entrada: EntradaCronograma }[];
}

interface AppState {
  tecnicos: Tecnico[];
  ots: OT[];
  actividades: Actividad[];
  cronograma: CronogramaMap;
  habilitaciones: Habilitacion[];
  presets: PresetSede[];
  sedes: Sede[];
  modoAcceso: ModoAcceso;
  cargando: boolean;
  actualizando: boolean;
  error: string | null;

  vista: VistaCalendario;
  fechaActual: Date;
  seleccionRango: SeleccionRango;
  mostrarDetalles: boolean;
  sidebarDerechaVisible: boolean;
  modalEdicion: {
    abierto: boolean;
    tecnico_id: string | null;
    fecha: string | null;
    aplicarARango: boolean;
  } | null;
  otSeleccionadas: string[];
  loginModalAbierto: boolean;
  toast: { mensaje: string; tipo: "ok" | "error" | "info" } | null;

  busquedaTecnico: string;
  filtroCargo: string;
  filtroActividad: string;

  clipboard: ClipboardData | null;
  pegarMode: boolean;

  modalExportarAbierto: boolean;

  cargarDatos: () => Promise<void>;
  cargarDatosSilencioso: () => Promise<void>;
  setVista: (v: VistaCalendario) => void;
  setFechaActual: (d: Date) => void;
  avanzaMes: () => void;
  retrocedeMes: () => void;
  avanzaSemana: () => void;
  retrocedeSemana: () => void;
  toggleMostrarDetalles: () => void;
  toggleSidebarDerecha: () => void;
  abrirModalEdicion: (tecnico_id: string, fecha: string, aplicarARango?: boolean) => void;
  cerrarModalEdicion: () => void;
  toggleOTSeleccionada: (codigo: string) => void;
  limpiarOTsSeleccionadas: () => void;
  setSeleccionRango: (r: SeleccionRango) => void;
  limpiarSeleccionRango: () => void;
  setLoginModalAbierto: (b: boolean) => void;
  showToast: (mensaje: string, tipo?: "ok" | "error" | "info") => void;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  guardarEntrada: (
    tecnico_id: string,
    fecha: string,
    data: { actividad: string; ots_asignadas: string; detalle: string; notas: string; }
  ) => Promise<boolean>;
  guardarEntradasRango: (
    tecnico_id: string,
    fechaInicio: string,
    fechaFin: string,
    data: { actividad: string; ots_asignadas: string; detalle: string; notas: string; }
  ) => Promise<boolean>;
  cambiarEstadoRango: (
    tecnico_id: string,
    fechaInicio: string,
    fechaFin: string,
    nuevaActividad: string
  ) => Promise<boolean>;
  borrarEntrada: (tecnico_id: string, fecha: string) => Promise<boolean>;
  borrarEntradasRango: (tecnico_id: string, fechaInicio: string, fechaFin: string) => Promise<boolean>;
  toggleTecnico: (tecnico_id: string, activo: boolean) => Promise<boolean>;
  regenerarVisual: (year: number, month?: number) => Promise<boolean>;
  generarBackup: (year: number) => Promise<boolean>;
  restaurarBackup: (year: number) => Promise<boolean>;
  cambiarEstadoOt: (codigo: string, nuevoEstado: string) => Promise<boolean>;
  agregarOt: (codigo: string, cliente: string, sede: string, estado: string) => Promise<boolean>;

  setBusquedaTecnico: (s: string) => void;
  setFiltroCargo: (c: string) => void;
  setFiltroActividad: (a: string) => void;
  limpiarFiltros: () => void;

  copiarRango: () => void;
  pegarEnCelda: (tecnico_id: string, fecha: string) => Promise<boolean>;
  duplicarDia: () => Promise<boolean>;
  repetirPatron: (veces: number) => Promise<boolean>;
  setPegarMode: (b: boolean) => void;
  limpiarClipboard: () => void;

  setModalExportarAbierto: (b: boolean) => void;

  // ===== Habilitaciones =====
  cargarHabilitaciones: () => Promise<void>;
  agregarHabilitacion: (h: Omit<Habilitacion, "id">) => Promise<boolean>;
  actualizarHabilitacion: (id: string, newData: Partial<Habilitacion>) => Promise<boolean>;
  eliminarHabilitacion: (id: string) => Promise<boolean>;
  agregarSubDocumento: (habilitacionId: string, sub: Omit<SubDocumento, "id">) => Promise<boolean>;
  actualizarSubDocumento: (id: string, newData: Partial<SubDocumento>) => Promise<boolean>;
  eliminarSubDocumento: (id: string) => Promise<boolean>;
  toggleContabilizarHabilitacion: (id: string, contabilizar: boolean, es_subdoc: boolean) => Promise<boolean>;
  sincronizarHabilitacionesExcel: () => Promise<boolean>;
  setHabilitaciones: (habs: Habilitacion[]) => void;

  // ===== Técnicos CRUD =====
  agregarTecnico: (t: { id: string; cargo: string; nombre: string; correo: string; codigo_sap: string; foto_url?: string }) => Promise<boolean>;
  actualizarTecnico: (id: string, newData: { cargo: string; nombre: string; correo: string; codigo_sap: string; foto_url?: string }) => Promise<boolean>;
  eliminarTecnicoLogico: (id: string) => Promise<boolean>;
  reactivarTecnico: (id: string) => Promise<boolean>;
  sincronizarTecnicosExcel: () => Promise<boolean>;

  // ===== Sedes CRUD =====
  agregarSede: (s: { nombre: string; lat: number; lng: number; region: string; ciudad: string; datoCurioso: string; foto_ciudad: string }) => Promise<boolean>;
  actualizarSede: (nombreOriginal: string, newData: { nombre: string; lat: number; lng: number; region: string; ciudad: string; datoCurioso: string; foto_ciudad: string }) => Promise<boolean>;
  eliminarSede: (nombre: string) => Promise<boolean>;
  toggleSedeVisible: (nombre: string, visible: boolean) => Promise<boolean>;
  sincronizarSedesExcel: () => Promise<boolean>;

  // ===== Presets de Sedes =====
  cargarPresets: () => Promise<void>;
  agregarPresetSede: (sedeNombre: string) => Promise<boolean>;
  eliminarPresetSede: (id: string) => Promise<boolean>;
  agregarPresetDocumento: (presetSedeId: string, doc: Omit<PresetDocumento, "id">) => Promise<boolean>;
  eliminarPresetDocumento: (id: string) => Promise<boolean>;
  agregarPresetSubDoc: (presetDocId: string, sub: Omit<SubDocumento, "id">) => Promise<boolean>;
  eliminarPresetSubDoc: (id: string) => Promise<boolean>;
  aplicarPresetATecnico: (presetSedeId: string, tecnicoId: string, copiarFechas: boolean) => Promise<boolean>;
  sincronizarPresetsExcel: () => Promise<boolean>;
}

export function formatFechaISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sumarDiasISO(iso: string, dias: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + dias);
  return formatFechaISO(d);
}

export const useStore = create<AppState>((set, get) => ({
  tecnicos: [],
  ots: [],
  actividades: [],
  cronograma: {},
  habilitaciones: [],
  presets: [],
  sedes: [],
  modoAcceso: "lector",
  cargando: true,
  actualizando: false,
  error: null,

  vista: "mes",
  fechaActual: new Date(),
  seleccionRango: { inicio: null, fin: null, tecnico_id: null },
  mostrarDetalles: true,
  sidebarDerechaVisible: true,
  modalEdicion: null,
  otSeleccionadas: [],
  loginModalAbierto: false,
  toast: null,

  busquedaTecnico: "",
  filtroCargo: "",
  filtroActividad: "",
  clipboard: null,
  pegarMode: false,
  modalExportarAbierto: false,

  cargarDatos: async () => {
    set({ cargando: true, error: null });
    try {
      const res = await fetch("/api/data", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error al cargar datos");
      const d = json.data;
      set({
        tecnicos: d.tecnicos,
        ots: d.ots,
        actividades: d.actividades,
        cronograma: d.cronograma,
        sedes: d.sedes ?? [],
        modoAcceso: d.modoAcceso,
        cargando: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Error desconocido",
        cargando: false,
      });
    }
  },

  cargarDatosSilencioso: async () => {
    set({ actualizando: true });
    try {
      const res = await fetch("/api/data", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error al cargar datos");
      const d = json.data;
      set({
        tecnicos: d.tecnicos,
        ots: d.ots,
        actividades: d.actividades,
        cronograma: d.cronograma,
        sedes: d.sedes ?? [],
        modoAcceso: d.modoAcceso,
        actualizando: false,
      });
    } catch (err) {
      set({ actualizando: false });
      get().showToast(
        err instanceof Error ? err.message : "Error al actualizar",
        "error"
      );
    }
  },

  setVista: (v) => set({ vista: v }),
  setFechaActual: (d) => set({ fechaActual: d }),

  avanzaMes: () => {
    const d = new Date(get().fechaActual);
    d.setMonth(d.getMonth() + 1);
    set({ fechaActual: d });
  },
  retrocedeMes: () => {
    const d = new Date(get().fechaActual);
    d.setMonth(d.getMonth() - 1);
    set({ fechaActual: d });
  },
  avanzaSemana: () => {
    const d = new Date(get().fechaActual);
    d.setDate(d.getDate() + 7);
    set({ fechaActual: d });
  },
  retrocedeSemana: () => {
    const d = new Date(get().fechaActual);
    d.setDate(d.getDate() - 7);
    set({ fechaActual: d });
  },

  toggleMostrarDetalles: () => set((s) => ({ mostrarDetalles: !s.mostrarDetalles })),
  toggleSidebarDerecha: () => set((s) => ({ sidebarDerechaVisible: !s.sidebarDerechaVisible })),

  abrirModalEdicion: (tecnico_id, fecha, aplicarARango = false) =>
    set({ modalEdicion: { abierto: true, tecnico_id, fecha, aplicarARango } }),
  cerrarModalEdicion: () => set({ modalEdicion: null }),

  toggleOTSeleccionada: (codigo) =>
    set((s) => {
      const existe = s.otSeleccionadas.includes(codigo);
      return {
        otSeleccionadas: existe
          ? s.otSeleccionadas.filter((c) => c !== codigo)
          : [...s.otSeleccionadas, codigo],
      };
    }),
  limpiarOTsSeleccionadas: () => set({ otSeleccionadas: [] }),
  setSeleccionRango: (r) => set({ seleccionRango: r }),
  limpiarSeleccionRango: () => set({ seleccionRango: { inicio: null, fin: null, tecnico_id: null } }),
  setLoginModalAbierto: (b) => set({ loginModalAbierto: b }),

  showToast: (mensaje, tipo = "info") => {
    set({ toast: { mensaje, tipo } });
    setTimeout(() => set({ toast: null }), 3500);
  },

  login: async (password) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (json.ok) {
        set({ modoAcceso: "editor" });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  logout: async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    set({ modoAcceso: "lector" });
  },

  guardarEntrada: async (tecnico_id, fecha, data) => {
    try {
      const res = await fetch("/api/cronograma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tecnico_id, fecha, ...data }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarDatosSilencioso();
      get().showToast("Entrada guardada", "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al guardar", "error");
      return false;
    }
  },

  guardarEntradasRango: async (tecnico_id, fechaInicio, fechaFin, data) => {
    try {
      const inicio = new Date(fechaInicio + "T00:00:00");
      const fin = new Date(fechaFin + "T00:00:00");
      const fechas: string[] = [];
      const actual = new Date(inicio);
      while (actual <= fin) {
        fechas.push(formatFechaISO(actual));
        actual.setDate(actual.getDate() + 1);
      }
      let ok = true;
      for (const fecha of fechas) {
        const res = await fetch("/api/cronograma", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tecnico_id, fecha, ...data }),
        });
        const json = await res.json();
        if (!json.ok) { ok = false; break; }
      }
      if (ok) {
        await get().cargarDatosSilencioso();
        get().showToast(`Asignado a ${fechas.length} día(s)`, "ok");
      }
      return ok;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al guardar rango", "error");
      return false;
    }
  },

  cambiarEstadoRango: async (tecnico_id, fechaInicio, fechaFin, nuevaActividad) => {
    try {
      const inicio = new Date(fechaInicio + "T00:00:00");
      const fin = new Date(fechaFin + "T00:00:00");
      const fechas: string[] = [];
      const actual = new Date(inicio);
      while (actual <= fin) {
        fechas.push(formatFechaISO(actual));
        actual.setDate(actual.getDate() + 1);
      }
      let ok = true;
      for (const fecha of fechas) {
        const existing = get().cronograma[`${tecnico_id}|${fecha}`];
        const res = await fetch("/api/cronograma", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tecnico_id, fecha,
            actividad: nuevaActividad,
            ots_asignadas: existing?.ots_asignadas ?? "—",
            detalle: existing?.detalle ?? "—",
            notas: existing?.notas ?? "",
          }),
        });
        const json = await res.json();
        if (!json.ok) { ok = false; break; }
      }
      if (ok) {
        await get().cargarDatosSilencioso();
        get().showToast(`Estado cambiado a ${nuevaActividad} en ${fechas.length} día(s)`, "ok");
      }
      return ok;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al cambiar estado del rango", "error");
      return false;
    }
  },

  borrarEntrada: async (tecnico_id, fecha) => {
    try {
      const res = await fetch("/api/cronograma/borrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tecnico_id, fecha }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarDatosSilencioso();
      get().showToast("Entrada borrada", "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al borrar", "error");
      return false;
    }
  },

  // FIX: Usar el endpoint de borrar rango (batch)
  borrarEntradasRango: async (tecnico_id, fechaInicio, fechaFin) => {
    try {
      const res = await fetch("/api/cronograma/borrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "rango", tecnico_id, fechaInicio, fechaFin }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarDatosSilencioso();
      get().showToast(`${json.data.deleted} entrada(s) borrada(s)`, "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al borrar rango", "error");
      return false;
    }
  },

  toggleTecnico: async (tecnico_id, activo) => {
    try {
      const res = await fetch("/api/tecnico/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tecnico_id, activo }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarDatosSilencioso();
      get().showToast(`Técnico ${activo ? "activado" : "desactivado"}`, "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al cambiar técnico", "error");
      return false;
    }
  },

  regenerarVisual: async (year, month) => {
    try {
      const res = await fetch("/api/cronograma/visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      const esCompleto = !month;
      get().showToast(
        esCompleto
          ? `Excel visual actualizado (365 días): ${json.data.filas} filas × ${json.data.columnas} columnas`
          : `Excel visual actualizado: ${json.data.filas} filas × ${json.data.columnas} columnas`,
        "ok"
      );
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al regenerar", "error");
      return false;
    }
  },

  // FIX: Nuevas acciones de backup
  generarBackup: async (year) => {
    try {
      const res = await fetch("/api/cronograma/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "generar", year }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      get().showToast(`Backup generado: ${json.data.filas} filas × ${json.data.columnas} columnas`, "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al generar backup", "error");
      return false;
    }
  },

  restaurarBackup: async (year) => {
    try {
      const res = await fetch("/api/cronograma/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "restaurar", year }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarDatosSilencioso();
      get().showToast("Cronograma restaurado desde Backup", "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al restaurar backup", "error");
      return false;
    }
  },

  cambiarEstadoOt: async (codigo, nuevoEstado) => {
    try {
      const res = await fetch("/api/ot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "cambiar_estado", codigo, nuevoEstado }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarDatosSilencioso();
      get().showToast(`OT ${codigo} → ${nuevoEstado}`, "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al cambiar estado OT", "error");
      return false;
    }
  },

  agregarOt: async (codigo, cliente, sede, estado) => {
    try {
      const res = await fetch("/api/ot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "agregar", codigo, cliente, sede, estado }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarDatosSilencioso();
      get().showToast(`OT ${codigo} agregada`, "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al agregar OT", "error");
      return false;
    }
  },

  setBusquedaTecnico: (s) => set({ busquedaTecnico: s }),
  setFiltroCargo: (c) => set({ filtroCargo: c }),
  setFiltroActividad: (a) => set({ filtroActividad: a }),
  limpiarFiltros: () => set({ busquedaTecnico: "", filtroCargo: "", filtroActividad: "" }),

  copiarRango: () => {
    const { seleccionRango, cronograma } = get();
    if (!seleccionRango.inicio || !seleccionRango.fin || !seleccionRango.tecnico_id) {
      get().showToast("Selecciona un rango primero", "error");
      return;
    }
    const inicio = new Date(seleccionRango.inicio + "T00:00:00");
    const fin = new Date(seleccionRango.fin + "T00:00:00");
    const entradas: { offset_dias: number; entrada: EntradaCronograma }[] = [];
    const actual = new Date(inicio);
    while (actual <= fin) {
      const iso = formatFechaISO(actual);
      const entrada = cronograma[`${seleccionRango.tecnico_id}|${iso}`];
      if (entrada) {
        const offset = Math.round((actual.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
        entradas.push({ offset_dias: offset, entrada });
      }
      actual.setDate(actual.getDate() + 1);
    }
    if (entradas.length === 0) {
      get().showToast("El rango seleccionado no tiene asignaciones", "info");
      return;
    }
    set({ clipboard: { tecnico_origen: seleccionRango.tecnico_id, entradas } });
    get().showToast(`Copiadas ${entradas.length} asignación(es)`, "ok");
  },

  pegarEnCelda: async (tecnico_id, fecha) => {
    const { clipboard } = get();
    if (!clipboard) {
      get().showToast("No hay nada que pegar (usa Ctrl+C primero)", "error");
      return false;
    }
    let count = 0;
    for (const item of clipboard.entradas) {
      const nuevaFecha = sumarDiasISO(fecha, item.offset_dias);
      const res = await fetch("/api/cronograma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tecnico_id,
          fecha: nuevaFecha,
          actividad: item.entrada.actividad,
          ots_asignadas: item.entrada.ots_asignadas,
          detalle: item.entrada.detalle,
          notas: item.entrada.notas,
        }),
      });
      const json = await res.json();
      if (json.ok) count++;
    }
    await get().cargarDatosSilencioso();
    get().showToast(`Pegadas ${count} asignación(es)`, "ok");
    return true;
  },

  duplicarDia: async () => {
    const { seleccionRango, cronograma } = get();
    if (!seleccionRango.inicio || !seleccionRango.tecnico_id) {
      get().showToast("Selecciona un día primero", "error");
      return false;
    }
    if (seleccionRango.fin && seleccionRango.inicio !== seleccionRango.fin) {
      get().showToast("Duplicar día requiere seleccionar un solo día", "info");
      return false;
    }
    const entrada = cronograma[`${seleccionRango.tecnico_id}|${seleccionRango.inicio}`];
    if (!entrada) {
      get().showToast("El día seleccionado no tiene asignación", "info");
      return false;
    }
    const nuevaFecha = sumarDiasISO(seleccionRango.inicio, 1);
    const res = await fetch("/api/cronograma", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tecnico_id: seleccionRango.tecnico_id,
        fecha: nuevaFecha,
        actividad: entrada.actividad,
        ots_asignadas: entrada.ots_asignadas,
        detalle: entrada.detalle,
        notas: entrada.notas,
      }),
    });
    const json = await res.json();
    if (json.ok) {
      await get().cargarDatosSilencioso();
      get().showToast(`Duplicado a ${nuevaFecha}`, "ok");
    }
    return json.ok;
  },

  repetirPatron: async (veces) => {
    const { seleccionRango, cronograma } = get();
    if (!seleccionRango.inicio || !seleccionRango.fin || !seleccionRango.tecnico_id) {
      get().showToast("Selecciona un rango primero", "error");
      return false;
    }
    const inicio = new Date(seleccionRango.inicio + "T00:00:00");
    const fin = new Date(seleccionRango.fin + "T00:00:00");
    const diasRango = Math.round((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const entradasOriginales: { offset: number; entrada: EntradaCronograma }[] = [];
    const actual = new Date(inicio);
    while (actual <= fin) {
      const iso = formatFechaISO(actual);
      const entrada = cronograma[`${seleccionRango.tecnico_id}|${iso}`];
      if (entrada) {
        const offset = Math.round((actual.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
        entradasOriginales.push({ offset, entrada });
      }
      actual.setDate(actual.getDate() + 1);
    }
    if (entradasOriginales.length === 0) {
      get().showToast("El rango no tiene asignaciones", "info");
      return false;
    }
    let count = 0;
    for (let v = 1; v <= veces; v++) {
      for (const item of entradasOriginales) {
        const nuevaFecha = sumarDiasISO(seleccionRango.inicio, item.offset + v * diasRango);
        const res = await fetch("/api/cronograma", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tecnico_id: seleccionRango.tecnico_id,
            fecha: nuevaFecha,
            actividad: item.entrada.actividad,
            ots_asignadas: item.entrada.ots_asignadas,
            detalle: item.entrada.detalle,
            notas: item.entrada.notas,
          }),
        });
        const json = await res.json();
        if (json.ok) count++;
      }
    }
    await get().cargarDatosSilencioso();
    get().showToast(`Patrón repetido ${veces} veces (${count} asignaciones)`, "ok");
    return true;
  },

  setPegarMode: (b) => set({ pegarMode: b }),
  limpiarClipboard: () => set({ clipboard: null, pegarMode: false }),
  setModalExportarAbierto: (b) => set({ modalExportarAbierto: b }),

  // ===== Habilitaciones =====
  cargarHabilitaciones: async () => {
    try {
      const res = await fetch("/api/habilitaciones", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      set({ habilitaciones: json.data });
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al cargar habilitaciones", "error");
    }
  },

  agregarHabilitacion: async (h) => {
    try {
      const res = await fetch("/api/habilitaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "agregar", habilitacion: h }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarHabilitaciones();
      get().showToast("Habilitación agregada", "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al agregar habilitación", "error");
      return false;
    }
  },

  actualizarHabilitacion: async (id, newData) => {
    try {
      const res = await fetch("/api/habilitaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "actualizar", id, newData }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarHabilitaciones();
      get().showToast("Habilitación actualizada", "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al actualizar habilitación", "error");
      return false;
    }
  },

  eliminarHabilitacion: async (id) => {
    try {
      const res = await fetch("/api/habilitaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "eliminar", id }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarHabilitaciones();
      get().showToast("Habilitación eliminada", "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al eliminar habilitación", "error");
      return false;
    }
  },

  agregarSubDocumento: async (habilitacionId, sub) => {
    try {
      const res = await fetch("/api/habilitaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "agregar_subdoc", habilitacionId, sub }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarHabilitaciones();
      get().showToast("Sub-documento agregado", "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al agregar sub-documento", "error");
      return false;
    }
  },

  actualizarSubDocumento: async (id, newData) => {
    try {
      const res = await fetch("/api/habilitaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "actualizar_subdoc", id, newData }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarHabilitaciones();
      get().showToast("Sub-documento actualizado", "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al actualizar sub-documento", "error");
      return false;
    }
  },

  eliminarSubDocumento: async (id) => {
    try {
      const res = await fetch("/api/habilitaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "eliminar_subdoc", id }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarHabilitaciones();
      get().showToast("Sub-documento eliminado", "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al eliminar sub-documento", "error");
      return false;
    }
  },

  toggleContabilizarHabilitacion: async (id, contabilizar, es_subdoc) => {
    try {
      const res = await fetch("/api/habilitaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "toggle_contabilizar", id, contabilizar, es_subdoc }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarHabilitaciones();
      get().showToast(`Documento ${contabilizar ? "contabilizado" : "excluido"}`, "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al cambiar contabilización", "error");
      return false;
    }
  },

  sincronizarHabilitacionesExcel: async () => {
    try {
      const res = await fetch("/api/habilitaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "sincronizar", habilitaciones: get().habilitaciones }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      get().showToast(`Excel sincronizado (${json.data.count} habilitaciones)`, "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al sincronizar Excel", "error");
      return false;
    }
  },

  setHabilitaciones: (habs) => set({ habilitaciones: habs }),

  // ===== Técnicos CRUD =====
  agregarTecnico: async (t) => {
    try {
      const res = await fetch("/api/tecnico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "agregar", tecnico: t }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarDatosSilencioso();
      get().showToast(`Técnico ${t.nombre} agregado`, "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al agregar técnico", "error");
      return false;
    }
  },

  actualizarTecnico: async (id, newData) => {
    try {
      const res = await fetch("/api/tecnico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "actualizar", id, newData }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarDatosSilencioso();
      get().showToast("Técnico actualizado", "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al actualizar técnico", "error");
      return false;
    }
  },

  eliminarTecnicoLogico: async (id) => {
    try {
      const res = await fetch("/api/tecnico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "eliminar", id }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarDatosSilencioso();
      get().showToast("Técnico marcado como inactivo", "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al eliminar técnico", "error");
      return false;
    }
  },

  reactivarTecnico: async (id) => {
    try {
      const res = await fetch("/api/tecnico/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tecnico_id: id, activo: true }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarDatosSilencioso();
      get().showToast("Técnico reactivado", "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al reactivar técnico", "error");
      return false;
    }
  },

  sincronizarTecnicosExcel: async () => {
    try {
      const res = await fetch("/api/tecnico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "sincronizar", tecnicos: get().tecnicos }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      get().showToast(`Excel sincronizado (${json.data.count} técnicos)`, "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al sincronizar Excel", "error");
      return false;
    }
  },

  // ===== Sedes CRUD =====
  agregarSede: async (s) => {
    try {
      const res = await fetch("/api/sedes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "agregar", ...s }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarDatosSilencioso();
      get().showToast(`Sede ${s.nombre} agregada`, "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al agregar sede", "error");
      return false;
    }
  },

  actualizarSede: async (nombreOriginal, newData) => {
    try {
      const res = await fetch("/api/sedes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "actualizar_sede", nombreOriginal, newData }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarDatosSilencioso();
      get().showToast("Sede actualizada", "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al actualizar sede", "error");
      return false;
    }
  },

  eliminarSede: async (nombre) => {
    try {
      const res = await fetch("/api/sedes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "eliminar", nombre }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarDatosSilencioso();
      get().showToast(`Sede ${nombre} eliminada del Excel y del mapa`, "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al eliminar sede", "error");
      return false;
    }
  },

  toggleSedeVisible: async (nombre, visible) => {
    try {
      const res = await fetch("/api/sedes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "toggle_visible_sede", nombre, visible }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarDatosSilencioso();
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error", "error");
      return false;
    }
  },

  sincronizarSedesExcel: async () => {
    try {
      const res = await fetch("/api/sedes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "sincronizar", sedes: get().sedes }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      get().showToast(`Excel sincronizado (${json.data.count} sedes)`, "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al sincronizar Excel", "error");
      return false;
    }
  },

  // ===== Presets de Sedes =====
  cargarPresets: async () => {
    try {
      const res = await fetch("/api/presets", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      set({ presets: json.data });
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al cargar presets", "error");
    }
  },

  agregarPresetSede: async (sedeNombre) => {
    try {
      const res = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "agregar_sede", sede_nombre: sedeNombre }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarPresets();
      get().showToast(`Preset para ${sedeNombre} creado`, "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al crear preset", "error");
      return false;
    }
  },

  eliminarPresetSede: async (id) => {
    try {
      const res = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "eliminar_sede", id }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarPresets();
      get().showToast("Preset eliminado", "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al eliminar preset", "error");
      return false;
    }
  },

  agregarPresetDocumento: async (presetSedeId, doc) => {
    try {
      const res = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "agregar_documento", presetSedeId, documento: doc }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarPresets();
      get().showToast("Documento agregado al preset", "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al agregar documento al preset", "error");
      return false;
    }
  },

  eliminarPresetDocumento: async (id) => {
    try {
      const res = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "eliminar_documento", id }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarPresets();
      get().showToast("Documento eliminado del preset", "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al eliminar documento del preset", "error");
      return false;
    }
  },

  agregarPresetSubDoc: async (presetDocId, sub) => {
    try {
      const res = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "agregar_subdoc", presetDocId, sub }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarPresets();
      get().showToast("Sub-documento agregado al preset", "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al agregar sub-doc al preset", "error");
      return false;
    }
  },

  eliminarPresetSubDoc: async (id) => {
    try {
      const res = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "eliminar_subdoc", id }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarPresets();
      get().showToast("Sub-documento eliminado del preset", "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al eliminar sub-doc del preset", "error");
      return false;
    }
  },

  aplicarPresetATecnico: async (presetSedeId, tecnicoId, copiarFechas) => {
    try {
      const res = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "aplicar_a_tecnico", presetSedeId, tecnicoId, copiarFechas }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      await get().cargarHabilitaciones();
      get().showToast(`Preset aplicado (${json.data.creadas} documentos creados)`, "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al aplicar preset", "error");
      return false;
    }
  },

  sincronizarPresetsExcel: async () => {
    try {
      const res = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "sincronizar", presets: get().presets }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      get().showToast(`Excel sincronizado (${json.data.count} presets)`, "ok");
      return true;
    } catch (err) {
      get().showToast(err instanceof Error ? err.message : "Error al sincronizar Excel", "error");
      return false;
    }
  },
}));

export function getColorActividad(
  actividades: Actividad[],
  nombre: string
): ColorActividad | null {
  const a = actividades.find((x) => x.nombre === nombre);
  return a ? a.color : null;
}

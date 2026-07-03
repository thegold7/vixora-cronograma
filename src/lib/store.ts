/**
 * Store Zustand para la app VIXORA.
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
} from "@/lib/types";

export interface CronogramaMap {
  [key: string]: EntradaCronograma;
}

// seleccionRango ahora incluye tecnico_id para que solo se pinte la fila
export interface SeleccionRango {
  inicio: string | null;
  fin: string | null;
  tecnico_id: string | null;
}

interface AppState {
  tecnicos: Tecnico[];
  ots: OT[];
  actividades: Actividad[];
  cronograma: CronogramaMap;
  modoAcceso: ModoAcceso;
  cargando: boolean;
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

  cargarDatos: () => Promise<void>;
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
  setLoginModalAbierto: (b: boolean) => void;
  showToast: (mensaje: string, tipo?: "ok" | "error" | "info") => void;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  guardarEntrada: (
    tecnico_id: string,
    fecha: string,
    data: {
      actividad: string;
      ots_asignadas: string;
      detalle: string;
      notas: string;
    }
  ) => Promise<boolean>;
  guardarEntradasRango: (
    tecnico_id: string,
    fechaInicio: string,
    fechaFin: string,
    data: {
      actividad: string;
      ots_asignadas: string;
      detalle: string;
      notas: string;
    }
  ) => Promise<boolean>;
  borrarEntrada: (tecnico_id: string, fecha: string) => Promise<boolean>;
  toggleTecnico: (tecnico_id: string, activo: boolean) => Promise<boolean>;
  regenerarVisual: (year: number, month?: number) => Promise<boolean>;
  cambiarEstadoOt: (codigo: string, nuevoEstado: string) => Promise<boolean>;
  agregarOt: (codigo: string, cliente: string, sede: string, estado: string) => Promise<boolean>;
}

export function formatFechaISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const useStore = create<AppState>((set, get) => ({
  tecnicos: [],
  ots: [],
  actividades: [],
  cronograma: {},
  modoAcceso: "lector",
  cargando: true,
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

  toggleMostrarDetalles: () =>
    set((s) => ({ mostrarDetalles: !s.mostrarDetalles })),

  toggleSidebarDerecha: () =>
    set((s) => ({ sidebarDerechaVisible: !s.sidebarDerechaVisible })),

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
      await get().cargarDatos();
      get().showToast("Entrada guardada", "ok");
      return true;
    } catch (err) {
      get().showToast(
        err instanceof Error ? err.message : "Error al guardar",
        "error"
      );
      return false;
    }
  },

  guardarEntradasRango: async (tecnico_id, fechaInicio, fechaFin, data) => {
    try {
      // Generar todas las fechas del rango
      const inicio = new Date(fechaInicio + "T00:00:00");
      const fin = new Date(fechaFin + "T00:00:00");
      const fechas: string[] = [];
      const actual = new Date(inicio);
      while (actual <= fin) {
        fechas.push(formatFechaISO(actual));
        actual.setDate(actual.getDate() + 1);
      }

      // Guardar cada fecha
      let ok = true;
      for (const fecha of fechas) {
        const res = await fetch("/api/cronograma", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tecnico_id, fecha, ...data }),
        });
        const json = await res.json();
        if (!json.ok) {
          ok = false;
          break;
        }
      }

      if (ok) {
        await get().cargarDatos();
        get().showToast(`Asignado a ${fechas.length} día(s)`, "ok");
      }
      return ok;
    } catch (err) {
      get().showToast(
        err instanceof Error ? err.message : "Error al guardar rango",
        "error"
      );
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
      await get().cargarDatos();
      get().showToast("Entrada borrada", "ok");
      return true;
    } catch (err) {
      get().showToast(
        err instanceof Error ? err.message : "Error al borrar",
        "error"
      );
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
      await get().cargarDatos();
      get().showToast(
        `Técnico ${activo ? "activado" : "desactivado"}`,
        "ok"
      );
      return true;
    } catch (err) {
      get().showToast(
        err instanceof Error ? err.message : "Error al cambiar técnico",
        "error"
      );
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
      get().showToast(
        err instanceof Error ? err.message : "Error al regenerar",
        "error"
      );
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
      await get().cargarDatos();
      get().showToast(`OT ${codigo} → ${nuevoEstado}`, "ok");
      return true;
    } catch (err) {
      get().showToast(
        err instanceof Error ? err.message : "Error al cambiar estado OT",
        "error"
      );
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
      await get().cargarDatos();
      get().showToast(`OT ${codigo} agregada`, "ok");
      return true;
    } catch (err) {
      get().showToast(
        err instanceof Error ? err.message : "Error al agregar OT",
        "error"
      );
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

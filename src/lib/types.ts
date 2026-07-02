/**
 * Tipos del dominio VIXORA Cronograma
 */

export type ColorActividad = "rojo" | "amarillo" | "verde";

export interface Tecnico {
  id: string;
  cargo: string; // Supervisor | Especialista | Técnico
  nombre: string;
  correo: string;
  codigo_sap: string;
  estado: string; // Activo | Inactivo
  activo: boolean;
}

export interface OT {
  codigo: string;
  cliente: string;
  sede: string;
  estado: string; // EN PROCESO | FINALIZADO | PENDIENTE | PERDIDO
  activo: boolean;
}

export interface Actividad {
  codigo: string;
  nombre: string;
  color: ColorActividad;
  descripcion: string;
}

export interface EntradaCronograma {
  id: string;
  tecnico_id: string;
  fecha: string; // YYYY-MM-DD
  actividad: string; // nombre exacto de la actividad
  ots_asignadas: string; // IDs separados por coma o "—"
  detalle: string;
  notas: string;
  modificado_por: string;
  fecha_modif: string;
}

/** Mapa indexado por `${tecnico_id}|${fecha}` para acceso rápido desde la UI */
export type CronogramaMap = Record<string, EntradaCronograma>;

/** Color hex por actividad para usar en la UI */
export const COLOR_HEX: Record<ColorActividad, { bg: string; border: string; text: string; soft: string }> = {
  rojo: {
    bg: "#fdeaea",
    border: "#b3261e",
    text: "#7a1814",
    soft: "#fef4f3",
  },
  amarillo: {
    bg: "#fff6d6",
    border: "#8a6d00",
    text: "#5a4700",
    soft: "#fffbe8",
  },
  verde: {
    bg: "#e6f9ed",
    border: "#1a7a3a",
    text: "#0e5025",
    soft: "#f1fcf6",
  },
};

export const VIXORA_COLORS = {
  primary: "#E91E63",    // magenta del logo
  dark: "#000000",       // negro del logo
  bg: "#f5f5f7",         // gris claro de fondo
};

export type VistaCalendario = "mes" | "semana";
export type ModoAcceso = "lector" | "editor";

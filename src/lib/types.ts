/**
 * Tipos del dominio VIXORA Cronograma
 */

export type ColorActividad = "rojo" | "amarillo" | "verde";

export interface Tecnico {
  id: string;
  cargo: string;
  nombre: string;
  correo: string;
  codigo_sap: string;
  estado: string;
  activo: boolean;
  foto_url?: string; // URL de foto (opcional, columna nueva)
}

export interface OT {
  codigo: string;
  cliente: string;
  sede: string;
  estado: string;
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
  fecha: string;
  actividad: string;
  ots_asignadas: string;
  detalle: string;
  notas: string;
  modificado_por: string;
  fecha_modif: string;
}

export type CronogramaMap = Record<string, EntradaCronograma>;

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
  primary: "#E91E63",
  dark: "#000000",
  bg: "#f5f5f7",
};

export type VistaCalendario = "mes" | "semana" | "año";
export type ModoAcceso = "lector" | "editor";

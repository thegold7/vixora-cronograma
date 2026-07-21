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
  foto_url?: string;
}

export interface OT {
  codigo: string;
  cliente: string;
  sede: string;
  estado: string;
  activo: boolean;
  visible_mapa?: boolean;
}

export interface Sede {
  nombre: string;
  lat: number;
  lng: number;
  region: string;
  ciudad: string;
  datoCurioso: string;
  foto_ciudad: string;
  visible: boolean;
  predefinida?: boolean;
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
  rojo: { bg: "#fdeaea", border: "#b3261e", text: "#7a1814", soft: "#fef4f3" },
  amarillo: { bg: "#fff6d6", border: "#8a6d00", text: "#5a4700", soft: "#fffbe8" },
  verde: { bg: "#e6f9ed", border: "#1a7a3a", text: "#0e5025", soft: "#f1fcf6" },
};

export const VIXORA_COLORS = {
  primary: "#E91E63",
  dark: "#000000",
  bg: "#f5f5f7",
};

export type VistaCalendario = "mes" | "semana";
export type ModoAcceso = "lector" | "editor";

// ============================================================
// HABILITACIONES
// ============================================================

export type EstadoDocumento = "habilitado" | "por_vencer" | "en_riesgo" | "vencido";

export interface SubDocumento {
  id: string;
  nombre: string;
  fecha_vencimiento: string;
  enlace_url?: string;
  notas?: string;
  /** Si es false, no se contabiliza en los estados generales (histórico) */
  contabilizar?: boolean;
}

export interface Habilitacion {
  id: string;
  tecnico_id: string;
  tecnico_nombre?: string; // cache para mostrar en Excel sin join
  ot_codigo: string;
  sede_nombre: string;
  documento_nombre: string;
  sub_documentos?: SubDocumento[];
  fecha_vencimiento?: string;
  enlace_url?: string;
  notas?: string;
  /** Si es false, no se contabiliza en los estados generales (histórico) */
  contabilizar?: boolean;
}

export function calcularEstadoFecha(fechaVenc: string, hoy: Date = new Date()): EstadoDocumento {
  if (!fechaVenc) return "vencido";
  const venc = new Date(fechaVenc + "T00:00:00");
  const diffMs = venc.getTime() - hoy.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "vencido";
  if (diffDays <= 30) return "en_riesgo";
  if (diffDays <= 90) return "por_vencer";
  return "habilitado";
}

export function calcularEstadoHabilitacion(h: Habilitacion, hoy: Date = new Date()): EstadoDocumento {
  // FIX: Si contabilizar=false, ignorar completamente (no aporta estado)
  if (h.contabilizar === false) return "habilitado"; // no afecta conteos
  if (h.sub_documentos && h.sub_documentos.length > 0) {
    const subDocContables = h.sub_documentos.filter(s => s.contabilizar !== false);
    if (subDocContables.length === 0) return "habilitado";
    const estados = subDocContables.map(s => calcularEstadoFecha(s.fecha_vencimiento, hoy));
    const prioridad: Record<EstadoDocumento, number> = {
      vencido: 4, en_riesgo: 3, por_vencer: 2, habilitado: 1,
    };
    return estados.reduce((worst, curr) =>
      prioridad[curr] > prioridad[worst] ? curr : worst
    );
  }
  if (h.fecha_vencimiento) {
    return calcularEstadoFecha(h.fecha_vencimiento, hoy);
  }
  return "vencido";
}

/** FIX: Para conteos reales, contar también los no-contabilizables como "omitido".
 *  Esta función devuelve el estado real sin filtrar por contabilizar. */
export function calcularEstadoHabilitacionReal(h: Habilitacion, hoy: Date = new Date()): EstadoDocumento | null {
  if (h.contabilizar === false) return null; // no se cuenta
  if (h.sub_documentos && h.sub_documentos.length > 0) {
    const subDocContables = h.sub_documentos.filter(s => s.contabilizar !== false);
    if (subDocContables.length === 0) return null;
    const estados = subDocContables.map(s => calcularEstadoFecha(s.fecha_vencimiento, hoy));
    const prioridad: Record<EstadoDocumento, number> = {
      vencido: 4, en_riesgo: 3, por_vencer: 2, habilitado: 1,
    };
    return estados.reduce((worst, curr) =>
      prioridad[curr] > prioridad[worst] ? curr : worst
    );
  }
  if (h.fecha_vencimiento) {
    return calcularEstadoFecha(h.fecha_vencimiento, hoy);
  }
  return "vencido";
}

export const ESTADO_VISUAL: Record<EstadoDocumento, {
  label: string;
  icon: "🟢" | "🟡" | "🔴" | "⚫";
  color: string;
  bg: string;
  border: string;
  shape: "circle" | "triangle" | "square" | "diamond";
}> = {
  habilitado: { label: "Habilitado", icon: "🟢", color: "#1a7a3a", bg: "#e6f9ed", border: "#1a7a3a", shape: "circle" },
  por_vencer: { label: "Por vencer", icon: "🟡", color: "#8a6d00", bg: "#fff6d6", border: "#8a6d00", shape: "triangle" },
  en_riesgo: { label: "En riesgo", icon: "🔴", color: "#b3261e", bg: "#fdeaea", border: "#b3261e", shape: "square" },
  vencido: { label: "Vencido", icon: "⚫", color: "#444444", bg: "#eeeeee", border: "#444444", shape: "diamond" },
};

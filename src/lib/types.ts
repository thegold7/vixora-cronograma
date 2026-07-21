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
  foto_url?: string;
}

export interface OT {
  codigo: string;
  cliente: string;
  sede: string;
  estado: string; // EN PROCESO | FINALIZADO | PENDIENTE | PERDIDO
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
  fecha: string; // YYYY-MM-DD
  actividad: string;
  ots_asignadas: string; // IDs separados por coma o "—"
  detalle: string;
  notas: string;
  modificado_por: string;
  fecha_modif: string;
}

export type CronogramaMap = Record<string, EntradaCronograma>;

/** Color hex por actividad */
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

export type VistaCalendario = "mes" | "semana";
export type ModoAcceso = "lector" | "editor";

// ============================================================
// HABILITACIONES
// ============================================================

/**
 * Estado de un documento según su fecha de vencimiento:
 * - habilitado: vence en >3 meses
 * - por_vencer: vence en ≤3 meses y >1 mes
 * - en_riesgo: vence en ≤1 mes (no vencido)
 * - vencido: fecha ya pasada
 */
export type EstadoDocumento = "habilitado" | "por_vencer" | "en_riesgo" | "vencido";

export interface SubDocumento {
  id: string;
  nombre: string; // "Examen sangre", "Audiometría"
  fecha_vencimiento: string; // YYYY-MM-DD
  enlace_url?: string;
  notas?: string;
}

export interface Habilitacion {
  id: string;
  tecnico_id: string;
  ot_codigo: string;
  sede_nombre: string; // derivado de la OT (para agrupación)
  documento_nombre: string; // "EMO ANTAPACCAY", "Curso Alturas"
  /** Si tiene sub_documentos, la fecha_vencimiento del padre se ignora y el estado
   *  se calcula como el peor de los sub_documentos. */
  sub_documentos?: SubDocumento[];
  /** Si NO tiene sub_documentos, esta es la fecha del documento. */
  fecha_vencimiento?: string; // YYYY-MM-DD
  enlace_url?: string;
  notas?: string;
}

/** Helper: calcula el estado de una fecha de vencimiento */
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

/** Helper: calcula el estado de una habilitación (peor sub-doc o su propia fecha) */
export function calcularEstadoHabilitacion(h: Habilitacion, hoy: Date = new Date()): EstadoDocumento {
  if (h.sub_documentos && h.sub_documentos.length > 0) {
    // El estado del padre es el peor de los sub-documentos
    const estados = h.sub_documentos.map(s => calcularEstadoFecha(s.fecha_vencimiento, hoy));
    const prioridad: Record<EstadoDocumento, number> = {
      vencido: 4,
      en_riesgo: 3,
      por_vencer: 2,
      habilitado: 1,
    };
    return estados.reduce((worst, curr) =>
      prioridad[curr] > prioridad[worst] ? curr : worst
    );
  }
  if (h.fecha_vencimiento) {
    return calcularEstadoFecha(h.fecha_vencimiento, hoy);
  }
  return "vencido"; // sin fecha ni sub-docs → vencido
}

/** Helper: devuelve configuración visual por estado */
export const ESTADO_VISUAL: Record<EstadoDocumento, {
  label: string;
  icon: "🟢" | "🟡" | "🔴" | "⚫";
  color: string;       // texto
  bg: string;          // fondo
  border: string;      // borde
  shape: "circle" | "triangle" | "square" | "diamond";
}> = {
  habilitado: {
    label: "Habilitado",
    icon: "🟢",
    color: "#1a7a3a",
    bg: "#e6f9ed",
    border: "#1a7a3a",
    shape: "circle",
  },
  por_vencer: {
    label: "Por vencer",
    icon: "🟡",
    color: "#8a6d00",
    bg: "#fff6d6",
    border: "#8a6d00",
    shape: "triangle",
  },
  en_riesgo: {
    label: "En riesgo",
    icon: "🔴",
    color: "#b3261e",
    bg: "#fdeaea",
    border: "#b3261e",
    shape: "square",
  },
  vencido: {
    label: "Vencido",
    icon: "⚫",
    color: "#444444",
    bg: "#eeeeee",
    border: "#444444",
    shape: "diamond",
  },
};

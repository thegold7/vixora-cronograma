/**
 * Cliente de Google Sheets para VIXORA Cronograma.
 * Usa googleapis con la Service Account.
 * Solo se ejecuta en el servidor (server-side).
 */
import { google, type sheets_v4 } from "googleapis";
import type {
  Tecnico,
  OT,
  Actividad,
  EntradaCronograma,
} from "./types";

const SHEET_ID = process.env.GOOGLE_SHEETS_ID!;
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n");

let client: sheets_v4.Sheets | null = null;

function getClient(): sheets_v4.Sheets {
  if (client) return client;
  const jwt = new google.auth.JWT({
    email: CLIENT_EMAIL,
    key: PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  client = google.sheets({ version: "v4", auth: jwt });
  return client;
}

/** Lee todos los valores de una hoja, saltando el header */
async function readSheet<T>(
  sheetName: string,
  mapper: (row: string[]) => T
): Promise<T[]> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A2:Z`,
  });
  const rows = (res.data.values ?? []) as string[][];
  return rows
    .filter((r) => r.length > 0 && r.some((c) => c && c.trim() !== ""))
    .map((r) => mapper(r));
}

// ============================================================
// LECTURA — TÉCNICOS
// ============================================================
export async function getTecnicos(): Promise<Tecnico[]> {
  return readSheet("Tecnicos", (r) => ({
    id: r[0] ?? "",
    cargo: r[1] ?? "",
    nombre: r[2] ?? "",
    correo: r[3] ?? "",
    codigo_sap: r[4] ?? "",
    estado: r[5] ?? "Activo",
    activo: (r[6] ?? "TRUE").toUpperCase() === "TRUE",
  }));
}

export async function getTecnicosActivos(): Promise<Tecnico[]> {
  const all = await getTecnicos();
  return all.filter((t) => t.activo);
}

// ============================================================
// LECTURA — OTs
// ============================================================
export async function getOTs(): Promise<OT[]> {
  return readSheet("OTs", (r) => ({
    codigo: r[0] ?? "",
    cliente: r[1] ?? "",
    sede: r[2] ?? "",
    estado: r[3] ?? "",
    activo: (r[4] ?? "TRUE").toUpperCase() === "TRUE",
  }));
}

export async function getOTsActivas(): Promise<OT[]> {
  const all = await getOTs();
  return all.filter((o) => o.activo);
}

// ============================================================
// LECTURA — ACTIVIDADES
// ============================================================
export async function getActividades(): Promise<Actividad[]> {
  return readSheet("Actividades", (r) => ({
    codigo: r[0] ?? "",
    nombre: r[1] ?? "",
    color: (r[2] as Actividad["color"]) ?? "verde",
    descripcion: r[3] ?? "",
  }));
}

// ============================================================
// LECTURA — CRONOGRAMA (hoja oculta _Cronograma_Datos)
// ============================================================
export async function getCronograma(): Promise<EntradaCronograma[]> {
  return readSheet("_Cronograma_Datos", (r) => ({
    id: r[0] ?? "",
    tecnico_id: r[1] ?? "",
    fecha: r[2] ?? "",
    actividad: r[3] ?? "",
    ots_asignadas: r[4] ?? "—",
    detalle: r[5] ?? "",
    notas: r[6] ?? "",
    modificado_por: r[7] ?? "",
    fecha_modif: r[8] ?? "",
  }));
}

/**
 * Devuelve el cronograma en formato mapa indexado por `${tecnico_id}|${fecha}`
 * para acceso O(1) desde la UI.
 */
export async function getCronogramaMap(): Promise<
  Record<string, EntradaCronograma>
> {
  const entries = await getCronograma();
  const map: Record<string, EntradaCronograma> = {};
  for (const e of entries) {
    map[`${e.tecnico_id}|${e.fecha}`] = e;
  }
  return map;
}

// ============================================================
// ESCRITURA — UPDERT entrada de cronograma
// ============================================================
async function getNextId(): Promise<string> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "_Cronograma_Datos!A2:A",
  });
  const rows = (res.data.values ?? []) as string[][];
  let max = 0;
  for (const r of rows) {
    const id = r[0] ?? "";
    const m = id.match(/^C(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `C${String(max + 1).padStart(4, "0")}`;
}

/**
 * Crea o actualiza una entrada del cronograma.
 * Si ya existe una entrada para (tecnico_id, fecha), la actualiza in-place.
 * Si no existe, agrega una nueva fila al final.
 */
export async function upsertEntradaCronograma(
  params: {
    tecnico_id: string;
    fecha: string;
    actividad: string;
    ots_asignadas: string;
    detalle: string;
    notas: string;
    modificado_por: string;
  }
): Promise<{ ok: true; id: string }> {
  const sheets = getClient();
  const all = await getCronograma();
  const idx = all.findIndex(
    (e) => e.tecnico_id === params.tecnico_id && e.fecha === params.fecha
  );

  const now = new Date();
  const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")} ${String(
    now.getHours()
  ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  if (idx >= 0) {
    // update in-place
    const existing = all[idx];
    const rowNumber = idx + 2; // +1 header, +1 index 0
    const values = [
      [
        existing.id,
        params.tecnico_id,
        params.fecha,
        params.actividad,
        params.ots_asignadas || "—",
        params.detalle || "—",
        params.notas || "",
        params.modificado_por,
        ts,
      ],
    ];
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `_Cronograma_Datos!A${rowNumber}:I${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
    return { ok: true, id: existing.id };
  } else {
    // append
    const newId = await getNextId();
    const values = [
      [
        newId,
        params.tecnico_id,
        params.fecha,
        params.actividad,
        params.ots_asignadas || "—",
        params.detalle || "—",
        params.notas || "",
        params.modificado_por,
        ts,
      ],
    ];
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "_Cronograma_Datos!A:I",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
    return { ok: true, id: newId };
  }
}

/**
 * Elimina una entrada del cronograma (cuando se borra una celda).
 * Estrategia: reescribimos toda la hoja sin la fila eliminada.
 */
export async function deleteEntradaCronograma(
  tecnico_id: string,
  fecha: string
): Promise<{ ok: true }> {
  const sheets = getClient();
  const all = await getCronograma();
  const filtered = all.filter(
    (e) => !(e.tecnico_id === tecnico_id && e.fecha === fecha)
  );

  // Reescribir toda la hoja
  const header = [
    ["id", "tecnico_id", "fecha", "actividad", "ots_asignadas", "detalle", "notas", "modificado_por", "fecha_modif"],
  ];
  const rows = filtered.map((e) => [
    e.id,
    e.tecnico_id,
    e.fecha,
    e.actividad,
    e.ots_asignadas,
    e.detalle,
    e.notas,
    e.modificado_por,
    e.fecha_modif,
  ]);

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: "_Cronograma_Datos!A1:Z",
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: "_Cronograma_Datos!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [...header, ...rows] },
  });

  return { ok: true };
}

// ============================================================
// ESCRITURA — TÉCNICOS (toggle activo/inactivo)
// ============================================================
export async function toggleTecnicoActivo(
  tecnicoId: string,
  nuevoEstado: boolean
): Promise<{ ok: true }> {
  const sheets = getClient();
  const all = await getTecnicos();
  const idx = all.findIndex((t) => t.id === tecnicoId);
  if (idx < 0) throw new Error(`Técnico ${tecnicoId} no encontrado`);
  const rowNumber = idx + 2; // +1 header, +1 index 0
  const value = nuevoEstado ? "TRUE" : "FALSE";
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `Tecnicos!G${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[value]] },
  });
  return { ok: true };
}

// ============================================================
// REGENERAR CRONOGRAMA_VISUAL (matriz 13×N días)
// ============================================================
/**
 * Lee _Cronograma_Datos y regenera la hoja Cronograma_Visual
 * con el formato matriz: filas=técnicos, columnas=días.
 *
 * @param year Año a regenerar (ej: 2026)
 * @param month Mes a regenerar (1-12). Si no se pasa, regenera todo el año.
 */
export async function regenerarCronogramaVisual(
  year: number,
  month?: number
): Promise<{ ok: true; filas: number; columnas: number }> {
  const sheets = getClient();
  const tecnicos = (await getTecnicos()).filter((t) => t.activo);
  const ots = await getOTs();
  const otMap: Record<string, OT> = {};
  for (const o of ots) otMap[o.codigo] = o;

  const entries = await getCronograma();
  // index: tecnico_id|fecha -> entry
  const map: Record<string, EntradaCronograma> = {};
  for (const e of entries) map[`${e.tecnico_id}|${e.fecha}`] = e;

  // Días a generar
  const days: Date[] = [];
  if (month) {
    const last = new Date(year, month, 0).getDate();
    for (let d = 1; d <= last; d++) days.push(new Date(year, month - 1, d));
  } else {
    for (let m = 0; m < 12; m++) {
      const last = new Date(year, m + 1, 0).getDate();
      for (let d = 1; d <= last; d++) days.push(new Date(year, m, d));
    }
  }

  // Construir matriz
  // Fila 1: encabezado ["N°", "Nombre", "Cargo", "1 Lun", "2 Mar", ...]
  const DOW_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const header = [
    "N°",
    "Nombre",
    "Cargo",
    ...days.map((d) => `${d.getDate()} ${DOW_ES[d.getDay()]}`),
  ];
  const rows: string[][] = [header];

  for (let i = 0; i < tecnicos.length; i++) {
    const t = tecnicos[i];
    const row: string[] = [String(i + 1), t.nombre, t.cargo];
    for (const d of days) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const e = map[`${t.id}|${iso}`];
      if (!e) {
        row.push("");
        continue;
      }
      let cellText = e.actividad;
      if (e.ots_asignadas && e.ots_asignadas !== "—") {
        const codigos = e.ots_asignadas
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        for (const cod of codigos) {
          const ot = otMap[cod];
          if (ot) {
            cellText += `\n${cod} - ${ot.cliente}${ot.sede ? " " + ot.sede : ""}`;
          } else {
            cellText += `\n${cod}`;
          }
        }
      } else if (e.detalle && e.detalle !== "—") {
        cellText += `\n${e.detalle}`;
      }
      row.push(cellText);
    }
    rows.push(row);
  }

  // Limpiar y escribir
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: "Cronograma_Visual!A1:ZZ",
  });

  // Calcular rango
  const endCol = String.fromCharCode(65 + (3 + days.length - 1)); // A=65
  // Si hay más de 26 columnas esto no alcanza, pero para 365 días se necesita notación AA, AB...
  // Mejor usar writeRange con la última columna calculada:
  const lastCol = colToLetter(3 + days.length);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `Cronograma_Visual!A1:${lastCol}${rows.length}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });

  return { ok: true, filas: rows.length, columnas: header.length };
}

function colToLetter(col: number): string {
  let letter = "";
  while (col > 0) {
    const rem = (col - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

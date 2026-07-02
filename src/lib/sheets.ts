/**
 * Cliente de Google Sheets para VIXORA Cronograma.
 * Usa googleapis con la Service Account.
 * Solo se ejecuta en el servidor (server-side).
 *
 * IMPORTANTE: las variables de entorno se leen de forma diferida (lazy)
 * para evitar errores durante el build de Vercel (donde las env vars
 * de runtime no están disponibles).
 */
import { google, type sheets_v4 } from "googleapis";
import type {
  Tecnico,
  OT,
  Actividad,
  EntradaCronograma,
} from "./types";

let client: sheets_v4.Sheets | null = null;

function getClient(): sheets_v4.Sheets {
  if (client) return client;
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY ?? "";
  if (!sheetId || !clientEmail || !privateKeyRaw) {
    throw new Error(
      "Faltan variables de entorno de Google Sheets. Configura GOOGLE_SHEETS_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY en Vercel."
    );
  }
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
  const jwt = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  client = google.sheets({ version: "v4", auth: jwt });
  return client;
}

function getSheetId(): string {
  const id = process.env.GOOGLE_SHEETS_ID;
  if (!id) {
    throw new Error("Falta GOOGLE_SHEETS_ID en variables de entorno");
  }
  return id;
}

/** Lee todos los valores de una hoja, saltando el header */
async function readSheet<T>(
  sheetName: string,
  mapper: (row: string[]) => T
): Promise<T[]> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
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
// LECTURA — CRONOGRAMA
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
    spreadsheetId: getSheetId(),
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
    const existing = all[idx];
    const rowNumber = idx + 2;
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
      spreadsheetId: getSheetId(),
      range: `_Cronograma_Datos!A${rowNumber}:I${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
    return { ok: true, id: existing.id };
  } else {
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
      spreadsheetId: getSheetId(),
      range: "_Cronograma_Datos!A:I",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
    return { ok: true, id: newId };
  }
}

export async function deleteEntradaCronograma(
  tecnico_id: string,
  fecha: string
): Promise<{ ok: true }> {
  const sheets = getClient();
  const all = await getCronograma();
  const filtered = all.filter(
    (e) => !(e.tecnico_id === tecnico_id && e.fecha === fecha)
  );

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
    spreadsheetId: getSheetId(),
    range: "_Cronograma_Datos!A1:Z",
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
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
  const rowNumber = idx + 2;
  const value = nuevoEstado ? "TRUE" : "FALSE";
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: `Tecnicos!G${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[value]] },
  });
  return { ok: true };
}

// ============================================================
// REGENERAR CRONOGRAMA_VISUAL
// ============================================================
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
  const map: Record<string, EntradaCronograma> = {};
  for (const e of entries) map[`${e.tecnico_id}|${e.fecha}`] = e;

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

  await sheets.spreadsheets.values.clear({
    spreadsheetId: getSheetId(),
    range: "Cronograma_Visual!A1:ZZ",
  });

  const lastCol = colToLetter(3 + days.length);

  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
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

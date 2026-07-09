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
  Sede,
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
// LECTURA — TÉCNICOS (incluye foto_url)
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
    foto_url: r[7] ?? "",
  }));
}

export async function getTecnicosActivos(): Promise<Tecnico[]> {
  const all = await getTecnicos();
  return all.filter((t) => t.activo);
}

// ============================================================
// LECTURA — OTs (incluye visible_mapa)
// ============================================================
export async function getOTs(): Promise<OT[]> {
  return readSheet("OTs", (r) => ({
    codigo: r[0] ?? "",
    cliente: r[1] ?? "",
    sede: r[2] ?? "",
    estado: r[3] ?? "",
    activo: (r[4] ?? "TRUE").toUpperCase() === "TRUE",
    visible_mapa: (r[5] ?? "TRUE").toUpperCase() === "TRUE",
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
// ESCRITURA — OTs (cambiar estado, agregar, actualizar, eliminar)
// ============================================================
export async function updateOtEstado(
  codigo: string,
  nuevoEstado: string
): Promise<{ ok: true }> {
  const sheets = getClient();
  const all = await getOTs();
  const idx = all.findIndex((o) => o.codigo === codigo);
  if (idx < 0) throw new Error(`OT ${codigo} no encontrada`);
  const rowNumber = idx + 2;
  const estadoUpper = nuevoEstado.toUpperCase();
  const activo = (estadoUpper === "EN PROCESO" || estadoUpper === "PENDIENTE") ? "TRUE" : "FALSE";

  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: `OTs!D${rowNumber}:E${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[estadoUpper, activo]] },
  });
  return { ok: true };
}

export async function addOt(
  codigo: string,
  cliente: string,
  sede: string,
  estado: string
): Promise<{ ok: true }> {
  const sheets = getClient();
  const estadoUpper = estado.toUpperCase();
  const activo = (estadoUpper === "EN PROCESO" || estadoUpper === "PENDIENTE") ? "TRUE" : "FALSE";

  const all = await getOTs();
  if (all.some((o) => o.codigo === codigo)) {
    throw new Error(`Ya existe una OT con código ${codigo}`);
  }

  const values = [[codigo, cliente, sede, estadoUpper, activo, "TRUE"]];
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: "OTs!A:F",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
  return { ok: true };
}

export async function updateOt(
  codigoOriginal: string,
  nuevoCodigo: string,
  cliente: string,
  sede: string,
  estado: string
): Promise<{ ok: true }> {
  const sheets = getClient();
  const all = await getOTs();
  const idx = all.findIndex((o) => o.codigo === codigoOriginal);
  if (idx < 0) throw new Error(`OT ${codigoOriginal} no encontrada`);
  
  if (nuevoCodigo !== codigoOriginal && all.some(o => o.codigo === nuevoCodigo)) {
    throw new Error(`Ya existe una OT con código ${nuevoCodigo}`);
  }

  const rowNumber = idx + 2;
  const estadoUpper = estado.toUpperCase();
  const activo = (estadoUpper === "EN PROCESO" || estadoUpper === "PENDIENTE") ? "TRUE" : "FALSE";

  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: `OTs!A${rowNumber}:E${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[nuevoCodigo, cliente, sede, estadoUpper, activo]] },
  });
  return { ok: true };
}

export async function deleteOt(codigo: string): Promise<{ ok: true }> {
  const sheets = getClient();
  const all = await getOTs();
  const filtered = all.filter((o) => o.codigo !== codigo);
  
  const header = [["codigo", "cliente", "sede", "estado", "activo", "visible_mapa"]];
  const rows = filtered.map((o) => [o.codigo, o.cliente, o.sede, o.estado, o.activo ? "TRUE" : "FALSE", o.visible_mapa ? "TRUE" : "FALSE"]);

  await sheets.spreadsheets.values.clear({
    spreadsheetId: getSheetId(),
    range: "OTs!A1:Z",
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: "OTs!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [...header, ...rows] },
  });

  return { ok: true };
}

export async function updateOtVisible(codigo: string, visible: boolean): Promise<{ ok: true }> {
  const sheets = getClient();
  const all = await getOTs();
  const idx = all.findIndex((o) => o.codigo === codigo);
  if (idx < 0) throw new Error(`OT ${codigo} no encontrada`);
  const rowNumber = idx + 2;
  const value = visible ? "TRUE" : "FALSE";
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: `OTs!F${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[value]] },
  });
  return { ok: true };
}

// ============================================================
// LECTURA/ESCRITURA — SEDES (para mapa dinámico)
// ============================================================
export async function getSedes(): Promise<Sede[]> {
  try {
    const sheets = getClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: getSheetId(),
      range: "Sedes!A2:H",
    });
    const rows = (res.data.values ?? []) as string[][];
    return rows
      .filter((r) => r.length > 0 && r.some((c) => c && c.trim() !== ""))
      .map((r) => ({
        nombre: r[0] ?? "",
        lat: parseFloat(r[1]) || 0,
        lng: parseFloat(r[2]) || 0,
        region: r[3] ?? "",
        ciudad: r[4] ?? "",
        datoCurioso: r[5] ?? "",
        foto_ciudad: r[6] ?? "",
        visible: (r[7] ?? "TRUE").toUpperCase() === "TRUE",
      }));
  } catch {
    return [];
  }
}

export async function addSede(sede: {
  nombre: string;
  lat: number;
  lng: number;
  region: string;
  ciudad: string;
  datoCurioso: string;
  foto_ciudad: string;
}): Promise<{ ok: true }> {
  const sheets = getClient();
  const all = await getSedes();
  if (all.some((s) => s.nombre.toUpperCase() === sede.nombre.toUpperCase())) {
    throw new Error(`Ya existe una sede con nombre ${sede.nombre}`);
  }
  const values = [[sede.nombre, sede.lat, sede.lng, sede.region, sede.ciudad, sede.datoCurioso, sede.foto_ciudad, "TRUE"]];
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: "Sedes!A:H",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
  return { ok: true };
}

export async function updateSede(
  nombreOriginal: string,
  newData: {
    nombre: string;
    lat: number;
    lng: number;
    region: string;
    ciudad: string;
    datoCurioso: string;
    foto_ciudad: string;
  }
): Promise<{ ok: true }> {
  const sheets = getClient();
  const all = await getSedes();
  const idx = all.findIndex((s) => s.nombre.toUpperCase() === nombreOriginal.toUpperCase());
  if (idx < 0) throw new Error(`Sede ${nombreOriginal} no encontrada`);
  
  const rowNumber = idx + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: `Sedes!A${rowNumber}:G${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[newData.nombre, newData.lat, newData.lng, newData.region, newData.ciudad, newData.datoCurioso, newData.foto_ciudad]] },
  });
  return { ok: true };
}

export async function toggleSedeVisible(nombre: string, visible: boolean): Promise<{ ok: true }> {
  const sheets = getClient();
  const all = await getSedes();
  const idx = all.findIndex((s) => s.nombre.toUpperCase() === nombre.toUpperCase());
  if (idx < 0) throw new Error(`Sede ${nombre} no encontrada`);
  const rowNumber = idx + 2;
  const value = visible ? "TRUE" : "FALSE";
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: `Sedes!H${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[value]] },
  });
  return { ok: true };
}

export async function deleteSede(nombre: string): Promise<{ ok: true }> {
  const sheets = getClient();
  const all = await getSedes();
  const filtered = all.filter((s) => s.nombre.toUpperCase() !== nombre.toUpperCase());
  
  const header = [["nombre", "lat", "lng", "region", "ciudad", "datoCurioso", "foto_ciudad", "visible"]];
  const rows = filtered.map((s) => [s.nombre, s.lat, s.lng, s.region, s.ciudad, s.datoCurioso, s.foto_ciudad, s.visible ? "TRUE" : "FALSE"]);

  await sheets.spreadsheets.values.clear({
    spreadsheetId: getSheetId(),
    range: "Sedes!A1:Z",
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: "Sedes!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [...header, ...rows] },
  });

  return { ok: true };
}

export async function replaceAllSedes(sedes: Sede[]): Promise<{ ok: true }> {
  const sheets = getClient();
  const header = [["nombre", "lat", "lng", "region", "ciudad", "datoCurioso", "foto_ciudad", "visible"]];
  const rows = sedes.map((s) => [s.nombre, s.lat, s.lng, s.region, s.ciudad, s.datoCurioso, s.foto_ciudad, s.visible ? "TRUE" : "FALSE"]);

  await sheets.spreadsheets.values.clear({
    spreadsheetId: getSheetId(),
    range: "Sedes!A1:Z",
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: "Sedes!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [...header, ...rows] },
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

  const mesesAGenerar: number[] = month ? [month] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  const DOW_COMPLETO = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const MESES_ES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const filaMes: string[] = ["MES", "Nombre", "Cargo"];
  const filaDias: string[] = ["N°", "Nombre", "Cargo"];

  for (const mes of mesesAGenerar) {
    const last = new Date(year, mes, 0).getDate();
    for (let d = 1; d <= last; d++) {
      if (d === 1) {
        filaMes.push(`${MESES_ES[mes - 1].toUpperCase()} ${year}`);
      } else {
        filaMes.push("");
      }
      const date = new Date(year, mes - 1, d);
      filaDias.push(`${String(d).padStart(2, "0")}/${mes} - ${DOW_COMPLETO[date.getDay()]}`);
    }
  }

  const rows: string[][] = [filaMes, filaDias];

  for (let i = 0; i < tecnicos.length; i++) {
    const t = tecnicos[i];
    const row: string[] = [String(i + 1), t.nombre, t.cargo];

    for (const mes of mesesAGenerar) {
      const last = new Date(year, mes, 0).getDate();
      for (let d = 1; d <= last; d++) {
        const iso = `${year}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
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
            let detalleOt = "";
            if (e.detalle && e.detalle !== "—") {
              const lineas = e.detalle.split("\n");
              for (let li = 0; li < lineas.length; li++) {
                const match = lineas[li].match(/^(\S+):$/);
                if (match && match[1] === cod) {
                  if (li + 1 < lineas.length) {
                    detalleOt = lineas[li + 1];
                  }
                  break;
                }
              }
            }
            if (detalleOt) {
              cellText += `\n${cod}:\n${detalleOt}`;
            } else if (ot) {
              const desc = `${ot.cliente}${ot.sede ? " " + ot.sede : ""}`.trim();
              cellText += `\n${cod}:\n${desc}`;
            } else {
              cellText += `\n${cod}:`;
            }
          }
        } else if (e.detalle && e.detalle !== "—") {
          cellText += `\n${e.detalle}`;
        }
        row.push(cellText);
      }
    }
    rows.push(row);
  }

  const totalColumnas = 3 + mesesAGenerar.reduce(
    (sum, mes) => sum + new Date(year, mes, 0).getDate(),
    0
  );

  await sheets.spreadsheets.values.clear({
    spreadsheetId: getSheetId(),
    range: "Cronograma_Visual!A1:ZZ",
  });

  const lastCol = colToLetter(totalColumnas);

  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: `Cronograma_Visual!A1:${lastCol}${rows.length}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });

  return { ok: true, filas: rows.length, columnas: totalColumnas };
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

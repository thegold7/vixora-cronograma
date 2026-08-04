/**
 * Cliente de Google Sheets para VIXORA Cronograma.
 * FIX: generarCronogramaBackup y regenerarCronogramaVisual ahora aceptan entradas de memoria.
 */
import { google, type sheets_v4 } from "googleapis";
import type {
  Tecnico,
  OT,
  Actividad,
  EntradaCronograma,
  Sede,
  Habilitacion,
  SubDocumento,
  PresetSede,
  PresetDocumento,
} from "./types";

let client: sheets_v4.Sheets | null = null;

function getClient(): sheets_v4.Sheets {
  if (client) return client;
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY ?? "";
  if (!sheetId || !clientEmail || !privateKeyRaw) {
    throw new Error("Faltan variables de entorno de Google Sheets.");
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
  if (!id) throw new Error("Falta GOOGLE_SHEETS_ID");
  return id;
}

async function readSheet<T>(sheetName: string, mapper: (row: string[]) => T): Promise<T[]> {
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

function normalizeEstado(raw: string): string {
  const e = (raw || "").trim().toUpperCase();
  if (e === "COMPLETADO") return "FINALIZADO";
  if (e === "EN PROCESO") return "EN PROCESO";
  if (e === "FINALIZADO") return "FINALIZADO";
  if (e === "PENDIENTE") return "PENDIENTE";
  if (e === "PERDIDO") return "PERDIDO";
  if (e === "CANCELADO") return "CANCELADO";
  return e || "PENDIENTE";
}

// ============================================================
// TÉCNICOS
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
// OTs
// ============================================================
export async function getOTs(): Promise<OT[]> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: "OTs!A2:Z",
  });
  const rows = (res.data.values ?? []) as string[][];
  const seen = new Set<string>();
  const result: OT[] = [];
  for (const r of rows) {
    if (r.length === 0 || !r.some((c) => c && c.trim() !== "")) continue;
    const codigo = (r[0] ?? "").trim();
    if (!codigo) continue;
    if (seen.has(codigo.toUpperCase())) continue;
    seen.add(codigo.toUpperCase());
    const estadoRaw = (r[3] ?? "").trim();
    const estado = normalizeEstado(estadoRaw);
    const activoRaw = (r[4] ?? "").trim().toUpperCase();
    const visibleRaw = (r[5] ?? "").trim().toUpperCase();
    result.push({
      codigo,
      cliente: (r[1] ?? "").trim(),
      sede: (r[2] ?? "").trim(),
      estado,
      activo: activoRaw === "" ? true : activoRaw === "TRUE",
      visible_mapa: visibleRaw === "" ? true : visibleRaw === "TRUE",
    });
  }
  return result;
}

export async function getOTsActivas(): Promise<OT[]> {
  const all = await getOTs();
  return all.filter((o) => o.activo);
}

export async function fillEmptyOtFields(): Promise<{ ok: true; updated: number }> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: getSheetId(), range: "OTs!A2:F" });
  const rows = (res.data.values ?? []) as string[][];
  let updated = 0;
  const batchUpdates: { range: string; values: string[][] }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const codigo = (r[0] ?? "").trim();
    if (!codigo) continue;
    const rowNumber = i + 2;
    const estadoRaw = (r[3] ?? "").trim();
    const estadoNorm = normalizeEstado(estadoRaw);
    const activoRaw = (r[4] ?? "").trim().toUpperCase();
    const visibleRaw = (r[5] ?? "").trim().toUpperCase();
    const needsEstadoUpdate = estadoRaw !== "" && estadoRaw.toUpperCase() !== estadoNorm.toUpperCase();
    const needsActivo = activoRaw === "";
    const needsVisible = visibleRaw === "";
    if (!needsEstadoUpdate && !needsActivo && !needsVisible) continue;
    const newEstado = needsEstadoUpdate ? estadoNorm : estadoRaw;
    const newActivo = needsActivo ? "TRUE" : (activoRaw === "TRUE" ? "TRUE" : "FALSE");
    const newVisible = needsVisible ? "TRUE" : (visibleRaw === "TRUE" ? "TRUE" : "FALSE");
    batchUpdates.push({ range: `OTs!D${rowNumber}:F${rowNumber}`, values: [[newEstado, newActivo, newVisible]] });
    updated++;
  }
  if (batchUpdates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: getSheetId(),
      requestBody: { valueInputOption: "USER_ENTERED", data: batchUpdates.map(u => ({ range: u.range, values: u.values })) },
    });
  }
  return { ok: true, updated };
}

export async function autoCreateMissingSedes(ots: OT[], sedesActuales: Sede[]): Promise<Sede[]> {
  const sedesExistentes = new Set(sedesActuales.map(s => s.nombre.toUpperCase()));
  const sedesNuevas: Sede[] = [];
  const sedesNuevasNombres = new Set<string>();
  for (const ot of ots) {
    const sedeNombre = (ot.sede || "").trim();
    if (!sedeNombre) continue;
    if (sedesExistentes.has(sedeNombre.toUpperCase())) continue;
    if (sedesNuevasNombres.has(sedeNombre.toUpperCase())) continue;
    sedesNuevasNombres.add(sedeNombre.toUpperCase());
    sedesNuevas.push({ nombre: sedeNombre, lat: 0, lng: 0, region: "", ciudad: "", datoCurioso: "", foto_ciudad: "", visible: true });
  }
  if (sedesNuevas.length === 0) return sedesActuales;
  const sheets = getClient();
  const values = sedesNuevas.map(s => [s.nombre, s.lat, s.lng, s.region, s.ciudad, s.datoCurioso, s.foto_ciudad, s.visible ? "TRUE" : "FALSE"]);
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(), range: "Sedes!A:H",
    valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values },
  });
  return [...sedesActuales, ...sedesNuevas];
}

// ============================================================
// ACTIVIDADES
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
// CRONOGRAMA - LECTURA DESDE Cronograma_Backup (matriz)
// ============================================================
function formatCellContent(e: { actividad: string; ots_asignadas: string; detalle: string; notas: string }): string {
  let content = `ASIGNACIÓN: ${e.actividad}`;
  if (e.ots_asignadas && e.ots_asignadas !== "—") {
    const codigos = e.ots_asignadas.split(",").map(s => s.trim()).filter(Boolean);
    const detalleLineas = (e.detalle || "").split("\n");
    for (const cod of codigos) {
      content += `\nOT: ${cod}`;
      let det = "";
      for (let i = 0; i < detalleLineas.length; i++) {
        if (detalleLineas[i].trim() === `${cod}:` && i + 1 < detalleLineas.length) {
          det = detalleLineas[i + 1];
          break;
        }
      }
      if (det && det !== "—") content += `\nDETALLE: ${det}`;
    }
  } else if (e.detalle && e.detalle !== "—") {
    content += `\nDETALLE: ${e.detalle}`;
  }
  if (e.notas) content += `\nNOTAS: ${e.notas}`;
  return content;
}

function parseCellContent(text: string): { actividad: string; ots_asignadas: string; detalle: string; notas: string } | null {
  if (!text || !text.trim()) return null;
  const lines = text.split("\n").map(l => l.trim());
  let actividad = "";
  let notas = "";
  const otBloques: { cod: string; detalle: string }[] = [];
  for (const line of lines) {
    if (line.toUpperCase().startsWith("ASIGNACIÓN:")) {
      actividad = line.substring("ASIGNACIÓN:".length).trim();
    } else if (line.toUpperCase().startsWith("OT:")) {
      const cod = line.substring(3).trim();
      if (cod) otBloques.push({ cod, detalle: "" });
    } else if (line.toUpperCase().startsWith("DETALLE:")) {
      const det = line.substring(8).trim();
      if (otBloques.length > 0) otBloques[otBloques.length - 1].detalle = det;
    } else if (line.toUpperCase().startsWith("NOTAS:")) {
      notas = line.substring(6).trim();
    }
  }
  if (!actividad) return null;
  const ots_asignadas = otBloques.length > 0 ? otBloques.map(b => b.cod).join(", ") : "—";
  const detalle = otBloques.length > 0
    ? otBloques.map(b => `${b.cod}:\n${b.detalle || "—"}`).join("\n")
    : "—";
  return { actividad, ots_asignadas, detalle, notas };
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

function getColumnForDate(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  let dayOfYear = 0;
  for (let mes = 1; mes < m; mes++) {
    dayOfYear += new Date(y, mes, 0).getDate();
  }
  dayOfYear += d;
  return 3 + dayOfYear;
}

async function getRowForTecnico(tecnicoId: string): Promise<number> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: "Cronograma_Backup!A2:A",
  });
  const rows = (res.data.values ?? []) as string[][];
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i][0] ?? "").trim() === tecnicoId) {
      return i + 2;
    }
  }
  return -1;
}

export async function getCronograma(): Promise<EntradaCronograma[]> {
  try {
    const sheets = getClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: getSheetId(),
      range: "Cronograma_Backup!A2:ZZ",
    });
    const rows = (res.data.values ?? []) as string[][];
    const entries: EntradaCronograma[] = [];
    const year = new Date().getFullYear();
    
    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      const tecnico_id = (row[0] ?? "").trim();
      if (!tecnico_id || tecnico_id === "ID") continue;
      
      for (let colIdx = 3; colIdx < row.length; colIdx++) {
        const cellText = row[colIdx] ?? "";
        const parsed = parseCellContent(cellText);
        if (!parsed) continue;
        
        const dayOfYear = colIdx - 3 + 1;
        const date = new Date(year, 0, dayOfYear);
        const fecha = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        
        entries.push({
          id: `${tecnico_id}_${fecha}`,
          tecnico_id,
          fecha,
          actividad: parsed.actividad,
          ots_asignadas: parsed.ots_asignadas,
          detalle: parsed.detalle,
          notas: parsed.notas,
          modificado_por: "",
          fecha_modif: "",
        });
      }
    }
    return entries;
  } catch (err) {
    console.error("[getCronograma] error:", err);
    return [];
  }
}

export async function getCronogramaMap(): Promise<Record<string, EntradaCronograma>> {
  const entries = await getCronograma();
  const map: Record<string, EntradaCronograma> = {};
  for (const e of entries) {
    map[`${e.tecnico_id}|${e.fecha}`] = e;
  }
  return map;
}

async function ensureCronogramaBackupInitialized(year: number): Promise<void> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: "Cronograma_Backup!A1:C2",
  });
  const rows = (res.data.values ?? []) as string[][];
  
  const hasHeaders = rows.length >= 2 && rows[0][0] === "MES" && rows[1][0] === "ID";
  if (hasHeaders) return;
  
  // Si no hay headers, generar todo el backup (usando memoria vacía si es la primera vez)
  await generarCronogramaBackup(year, []);
}

export async function upsertEntradaCronograma(
  params: { tecnico_id: string; fecha: string; actividad: string; ots_asignadas: string; detalle: string; notas: string; modificado_por: string; }
): Promise<{ ok: true; id: string }> {
  const sheets = getClient();
  const year = new Date(params.fecha + "T00:00:00").getFullYear();
  await ensureCronogramaBackupInitialized(year);
  
  const colNum = getColumnForDate(params.fecha);
  const colLetter = colToLetter(colNum);
  let rowNum = await getRowForTecnico(params.tecnico_id);
  
  if (rowNum < 0) {
    const tecnicos = await getTecnicos();
    const tec = tecnicos.find(t => t.id === params.tecnico_id);
    if (!tec) throw new Error(`Técnico ${params.tecnico_id} no encontrado`);
    
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: getSheetId(), range: "Cronograma_Backup!A:A" });
    const allRows = (res.data.values ?? []) as string[][];
    const lastRow = allRows.length + 1;
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: getSheetId(),
      range: `Cronograma_Backup!A${lastRow}:C${lastRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[tec.id, tec.nombre, tec.cargo]] },
    });
    rowNum = lastRow;
  }
  
  const cellContent = formatCellContent({
    actividad: params.actividad,
    ots_asignadas: params.ots_asignadas || "—",
    detalle: params.detalle || "—",
    notas: params.notas || "",
  });
  
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: `Cronograma_Backup!${colLetter}${rowNum}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[cellContent]] },
  });
  
  return { ok: true, id: `${params.tecnico_id}_${params.fecha}` };
}

export async function deleteEntradaCronograma(tecnico_id: string, fecha: string): Promise<{ ok: true }> {
  const sheets = getClient();
  const year = new Date(fecha + "T00:00:00").getFullYear();
  await ensureCronogramaBackupInitialized(year);
  
  const colNum = getColumnForDate(fecha);
  const colLetter = colToLetter(colNum);
  const rowNum = await getRowForTecnico(tecnico_id);
  if (rowNum < 0) return { ok: true };
  
  await sheets.spreadsheets.values.clear({
    spreadsheetId: getSheetId(),
    range: `Cronograma_Backup!${colLetter}${rowNum}`,
  });
  return { ok: true };
}

export async function deleteEntradasRango(tecnico_id: string, fechas: string[]): Promise<{ ok: true; deleted: number }> {
  const sheets = getClient();
  if (fechas.length > 100) {
    throw new Error(`Se intentó borrar ${fechas.length} entradas. Máximo: 100.`);
  }
  if (fechas.length > 0) {
    const year = new Date(fechas[0] + "T00:00:00").getFullYear();
    await ensureCronogramaBackupInitialized(year);
  }
  const rowNum = await getRowForTecnico(tecnico_id);
  if (rowNum < 0) return { ok: true, deleted: 0 };
  
  const ranges = fechas.map(f => {
    const colLetter = colToLetter(getColumnForDate(f));
    return `Cronograma_Backup!${colLetter}${rowNum}`;
  });
  
  await sheets.spreadsheets.values.batchClear({
    spreadsheetId: getSheetId(),
    requestBody: { ranges },
  });
  return { ok: true, deleted: fechas.length };
}

// FIX: Ahora acepta entradas de memoria para escribirlas en el Excel
export async function generarCronogramaBackup(year: number, entradas: EntradaCronograma[]): Promise<{ ok: true; filas: number; columnas: number }> {
  const sheets = getClient();
  const tecnicos = await getTecnicos();
  const ots = await getOTs();
  const otMap: Record<string, OT> = {};
  for (const o of ots) otMap[o.codigo] = o;
  
  // Crear mapa a partir de las entradas enviadas (memoria)
  const entriesMap: Record<string, EntradaCronograma> = {};
  for (const e of entradas) {
    entriesMap[`${e.tecnico_id}|${e.fecha}`] = e;
  }
  
  const MESES_ES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const DOW_COMPLETO = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  
  const filaMes: string[] = ["MES", "Nombre", "Cargo"];
  const filaDias: string[] = ["ID", "Nombre", "Cargo"];
  
  for (let mes = 1; mes <= 12; mes++) {
    const last = new Date(year, mes, 0).getDate();
    for (let d = 1; d <= last; d++) {
      if (d === 1) filaMes.push(`${MESES_ES[mes - 1].toUpperCase()} ${year}`);
      else filaMes.push("");
      const date = new Date(year, mes - 1, d);
      filaDias.push(`${String(d).padStart(2, "0")}/${mes} - ${DOW_COMPLETO[date.getDay()]}`);
    }
  }
  
  const rows: string[][] = [filaMes, filaDias];
  
  for (const t of tecnicos) {
    const row: string[] = [t.id, t.nombre, t.cargo];
    for (let mes = 1; mes <= 12; mes++) {
      const last = new Date(year, mes, 0).getDate();
      for (let d = 1; d <= last; d++) {
        const iso = `${year}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const e = entriesMap[`${t.id}|${iso}`];
        if (e) {
          row.push(formatCellContent({
            actividad: e.actividad,
            ots_asignadas: e.ots_asignadas,
            detalle: e.detalle,
            notas: e.notas,
          }));
        } else {
          row.push("");
        }
      }
    }
    rows.push(row);
  }
  
  const totalColumnas = 3 + 365;
  
  await sheets.spreadsheets.values.clear({
    spreadsheetId: getSheetId(),
    range: "Cronograma_Backup!A1:ZZZ",
  });
  
  const lastCol = colToLetter(totalColumnas);
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: `Cronograma_Backup!A1:${lastCol}${rows.length}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });
  
  return { ok: true, filas: rows.length, columnas: totalColumnas };
}

// FIX: Ahora acepta entradas de memoria para escribirlas en Visual
export async function regenerarCronogramaVisual(year: number, month?: number, entradas?: EntradaCronograma[]): Promise<{ ok: true; filas: number; columnas: number }> {
  const sheets = getClient();
  const tecnicos = (await getTecnicos()).filter((t) => t.activo);
  const ots = await getOTs();
  const otMap: Record<string, OT> = {};
  for (const o of ots) otMap[o.codigo] = o;
  
  // Usar entradas de memoria si se proporcionan, sino leer del Excel
  let entries: EntradaCronograma[];
  if (entradas && entradas.length > 0) {
    entries = entradas;
  } else {
    entries = await getCronograma();
  }
  
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
      if (d === 1) filaMes.push(`${MESES_ES[mes - 1].toUpperCase()} ${year}`);
      else filaMes.push("");
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
        if (!e) { row.push(""); continue; }
        let cellText = e.actividad;
        if (e.ots_asignadas && e.ots_asignadas !== "—") {
          const codigos = e.ots_asignadas.split(",").map((s) => s.trim()).filter(Boolean);
          for (const cod of codigos) {
            const ot = otMap[cod];
            let detalleOt = "";
            if (e.detalle && e.detalle !== "—") {
              const lineas = e.detalle.split("\n");
              for (let li = 0; li < lineas.length; li++) {
                const match = lineas[li].match(/^(\S+):$/);
                if (match && match[1] === cod) {
                  if (li + 1 < lineas.length) detalleOt = lineas[li + 1];
                  break;
                }
              }
            }
            if (detalleOt) cellText += `\n${cod}:\n${detalleOt}`;
            else if (ot) {
              const desc = `${ot.cliente}${ot.sede ? " " + ot.sede : ""}`.trim();
              cellText += `\n${cod}:\n${desc}`;
            } else cellText += `\n${cod}:`;
          }
        } else if (e.detalle && e.detalle !== "—") cellText += `\n${e.detalle}`;
        row.push(cellText);
      }
    }
    rows.push(row);
  }
  const totalColumnas = 3 + mesesAGenerar.reduce((sum, mes) => sum + new Date(year, mes, 0).getDate(), 0);
  await sheets.spreadsheets.values.clear({ spreadsheetId: getSheetId(), range: "Cronograma_Visual!A1:ZZZ" });
  const lastCol = colToLetter(totalColumnas);
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(), range: `Cronograma_Visual!A1:${lastCol}${rows.length}`,
    valueInputOption: "USER_ENTERED", requestBody: { values: rows },
  });
  return { ok: true, filas: rows.length, columnas: totalColumnas };
}
// ============================================================
// TÉCNICOS - ESCRITURA
// ============================================================
export async function toggleTecnicoActivo(tecnicoId: string, nuevoEstado: boolean): Promise<{ ok: true }> {
  const sheets = getClient();
  const all = await getTecnicos();
  const idx = all.findIndex((t) => t.id === tecnicoId);
  if (idx < 0) throw new Error(`Técnico ${tecnicoId} no encontrado`);
  const rowNumber = idx + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(), range: `Tecnicos!F${rowNumber}:G${rowNumber}`,
    valueInputOption: "USER_ENTERED", requestBody: { values: [[nuevoEstado ? "Activo" : "Inactivo", nuevoEstado ? "TRUE" : "FALSE"]] },
  });
  return { ok: true };
}

export async function addTecnico(tecnico: { id: string; cargo: string; nombre: string; correo: string; codigo_sap: string; foto_url?: string; }): Promise<{ ok: true }> {
  const sheets = getClient();
  const all = await getTecnicos();
  if (all.some((t) => t.id === tecnico.id)) throw new Error(`Ya existe un técnico con ID ${tecnico.id}`);
  const values = [[tecnico.id, tecnico.cargo, tecnico.nombre, tecnico.correo, tecnico.codigo_sap, "Activo", "TRUE", tecnico.foto_url || ""]];
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(), range: "Tecnicos!A:H",
    valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values },
  });
  return { ok: true };
}

export async function updateTecnico(tecnicoId: string, newData: { cargo: string; nombre: string; correo: string; codigo_sap: string; foto_url?: string }): Promise<{ ok: true }> {
  const sheets = getClient();
  const all = await getTecnicos();
  const idx = all.findIndex((t) => t.id === tecnicoId);
  if (idx < 0) throw new Error(`Técnico ${tecnicoId} no encontrado`);
  const rowNumber = idx + 2;
  const existing = all[idx];
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(), range: `Tecnicos!A${rowNumber}:H${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[existing.id, newData.cargo, newData.nombre, newData.correo, newData.codigo_sap, existing.estado, existing.activo ? "TRUE" : "FALSE", newData.foto_url || ""]] },
  });
  return { ok: true };
}

export async function deleteTecnicoLogico(tecnicoId: string): Promise<{ ok: true }> {
  const sheets = getClient();
  const all = await getTecnicos();
  const idx = all.findIndex((t) => t.id === tecnicoId);
  if (idx < 0) throw new Error(`Técnico ${tecnicoId} no encontrado`);
  const rowNumber = idx + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(), range: `Tecnicos!F${rowNumber}:G${rowNumber}`,
    valueInputOption: "USER_ENTERED", requestBody: { values: [["Inactivo", "FALSE"]] },
  });
  return { ok: true };
}

// ============================================================
// OTs - ESCRITURA
// ============================================================
export async function updateOtEstado(codigo: string, nuevoEstado: string): Promise<{ ok: true }> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: getSheetId(), range: "OTs!A2:F" });
  const rows = (res.data.values ?? []) as string[][];
  let rowNumber = -1;
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i][0] ?? "").trim().toUpperCase() === codigo.toUpperCase()) { rowNumber = i + 2; break; }
  }
  if (rowNumber < 0) throw new Error(`OT ${codigo} no encontrada`);
  const estadoNorm = normalizeEstado(nuevoEstado);
  const activo = (estadoNorm === "EN PROCESO" || estadoNorm === "PENDIENTE") ? "TRUE" : "FALSE";
  const visibleActual = (rows[rowNumber - 2][5] ?? "TRUE").toUpperCase() === "TRUE" ? "TRUE" : "FALSE";
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(), range: `OTs!D${rowNumber}:F${rowNumber}`,
    valueInputOption: "USER_ENTERED", requestBody: { values: [[estadoNorm, activo, visibleActual]] },
  });
  return { ok: true };
}

export async function addOt(codigo: string, cliente: string, sede: string, estado: string): Promise<{ ok: true }> {
  const sheets = getClient();
  const estadoNorm = normalizeEstado(estado);
  const activo = (estadoNorm === "EN PROCESO" || estadoNorm === "PENDIENTE") ? "TRUE" : "FALSE";
  const all = await getOTs();
  if (all.some((o) => o.codigo.toUpperCase() === codigo.toUpperCase())) throw new Error(`Ya existe una OT con código ${codigo}`);
  const values = [[codigo, cliente, sede, estadoNorm, activo, "TRUE"]];
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(), range: "OTs!A:F",
    valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values },
  });
  return { ok: true };
}

export async function updateOt(codigoOriginal: string, nuevoCodigo: string, cliente: string, sede: string, estado: string): Promise<{ ok: true }> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: getSheetId(), range: "OTs!A2:F" });
  const rows = (res.data.values ?? []) as string[][];
  let rowNumber = -1;
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i][0] ?? "").trim().toUpperCase() === codigoOriginal.toUpperCase()) { rowNumber = i + 2; break; }
  }
  if (rowNumber < 0) throw new Error(`OT ${codigoOriginal} no encontrada`);
  if (nuevoCodigo !== codigoOriginal && rows.some(r => (r[0] ?? "").trim().toUpperCase() === nuevoCodigo.toUpperCase())) throw new Error(`Ya existe una OT con código ${nuevoCodigo}`);
  const estadoNorm = normalizeEstado(estado);
  const activo = (estadoNorm === "EN PROCESO" || estadoNorm === "PENDIENTE") ? "TRUE" : "FALSE";
  const visibleActual = (rows[rowNumber - 2][5] ?? "TRUE").toUpperCase() === "TRUE" ? "TRUE" : "FALSE";
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(), range: `OTs!A${rowNumber}:F${rowNumber}`,
    valueInputOption: "USER_ENTERED", requestBody: { values: [[nuevoCodigo, cliente, sede, estadoNorm, activo, visibleActual]] },
  });
  return { ok: true };
}

export async function deleteOt(codigo: string): Promise<{ ok: true }> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: getSheetId(), range: "OTs!A2:F" });
  const rows = (res.data.values ?? []) as string[][];
  let rowNumber = -1;
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i][0] ?? "").trim().toUpperCase() === codigo.toUpperCase()) { rowNumber = i + 2; break; }
  }
  if (rowNumber < 0) throw new Error(`OT ${codigo} no encontrada`);
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(), range: `OTs!D${rowNumber}:E${rowNumber}`,
    valueInputOption: "USER_ENTERED", requestBody: { values: [["PERDIDO", "FALSE"]] },
  });
  return { ok: true };
}

export async function updateOtVisible(codigo: string, visible: boolean): Promise<{ ok: true }> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: getSheetId(), range: "OTs!A2:F" });
  const rows = (res.data.values ?? []) as string[][];
  let rowNumber = -1;
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i][0] ?? "").trim().toUpperCase() === codigo.toUpperCase()) { rowNumber = i + 2; break; }
  }
  if (rowNumber < 0) throw new Error(`OT ${codigo} no encontrada`);
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(), range: `OTs!F${rowNumber}`,
    valueInputOption: "USER_ENTERED", requestBody: { values: [[visible ? "TRUE" : "FALSE"]] },
  });
  return { ok: true };
}

// ============================================================
// SEDES
// ============================================================
export async function getSedes(): Promise<Sede[]> {
  try {
    const sheets = getClient();
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: getSheetId(), range: "Sedes!A2:H" });
    const rows = (res.data.values ?? []) as string[][];
    return rows
      .filter((r) => r.length > 0 && r.some((c) => c && c.trim() !== ""))
      .map((r) => ({
        nombre: r[0] ?? "", lat: parseFloat(r[1]) || 0, lng: parseFloat(r[2]) || 0,
        region: r[3] ?? "", ciudad: r[4] ?? "", datoCurioso: r[5] ?? "",
        foto_ciudad: r[6] ?? "", visible: (r[7] ?? "TRUE").toUpperCase() === "TRUE",
      }));
  } catch { return []; }
}

export async function addSede(sede: { nombre: string; lat: number; lng: number; region: string; ciudad: string; datoCurioso: string; foto_ciudad: string; }): Promise<{ ok: true }> {
  const sheets = getClient();
  const all = await getSedes();
  if (all.some((s) => s.nombre.toUpperCase() === sede.nombre.toUpperCase())) throw new Error(`Ya existe una sede con nombre ${sede.nombre}`);
  const values = [[sede.nombre, sede.lat, sede.lng, sede.region, sede.ciudad, sede.datoCurioso, sede.foto_ciudad, "TRUE"]];
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(), range: "Sedes!A:H",
    valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values },
  });
  return { ok: true };
}

export async function updateSede(nombreOriginal: string, newData: { nombre: string; lat: number; lng: number; region: string; ciudad: string; datoCurioso: string; foto_ciudad: string; }): Promise<{ ok: true }> {
  const sheets = getClient();
  const all = await getSedes();
  const idx = all.findIndex((s) => s.nombre.toUpperCase() === nombreOriginal.toUpperCase());
  if (idx < 0) throw new Error(`Sede ${nombreOriginal} no encontrada`);
  const rowNumber = idx + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(), range: `Sedes!A${rowNumber}:G${rowNumber}`,
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
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(), range: `Sedes!H${rowNumber}`,
    valueInputOption: "USER_ENTERED", requestBody: { values: [[visible ? "TRUE" : "FALSE"]] },
  });
  return { ok: true };
}

export async function deleteSede(nombre: string): Promise<{ ok: true }> {
  const sheets = getClient();
  const all = await getSedes();
  const filtered = all.filter((s) => s.nombre.toUpperCase() !== nombre.toUpperCase());
  const header = [["nombre", "lat", "lng", "region", "ciudad", "datoCurioso", "foto_ciudad", "visible"]];
  const rows = filtered.map((s) => [s.nombre, s.lat, s.lng, s.region, s.ciudad, s.datoCurioso, s.foto_ciudad, s.visible ? "TRUE" : "FALSE"]);
  await sheets.spreadsheets.values.clear({ spreadsheetId: getSheetId(), range: "Sedes!A1:Z" });
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(), range: "Sedes!A1",
    valueInputOption: "USER_ENTERED", requestBody: { values: [...header, ...rows] },
  });
  return { ok: true };
}

export async function replaceAllSedes(sedes: Sede[]): Promise<{ ok: true }> {
  const sheets = getClient();
  const header = [["nombre", "lat", "lng", "region", "ciudad", "datoCurioso", "foto_ciudad", "visible"]];
  const rows = sedes.map((s) => [s.nombre, s.lat, s.lng, s.region, s.ciudad, s.datoCurioso, s.foto_ciudad, s.visible ? "TRUE" : "FALSE"]);
  await sheets.spreadsheets.values.clear({ spreadsheetId: getSheetId(), range: "Sedes!A1:Z" });
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(), range: "Sedes!A1",
    valueInputOption: "USER_ENTERED", requestBody: { values: [...header, ...rows] },
  });
  return { ok: true };
}

// ============================================================
// HABILITACIONES - CRUD
// ============================================================
async function getTecnicoNombre(tecnicoId: string): Promise<string> {
  try {
    const all = await getTecnicos();
    const t = all.find(x => x.id === tecnicoId);
    return t?.nombre || "";
  } catch { return ""; }
}

export async function getHabilitaciones(): Promise<Habilitacion[]> {
  try {
    const sheets = getClient();
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: getSheetId(), range: "Habilitaciones!A2:L" });
    const rows = (res.data.values ?? []) as string[][];
    const validRows = rows.filter((r) => r.length > 0 && r.some((c) => c && c.trim() !== ""));
    const padres: Habilitacion[] = [];
    const subDocs: Array<SubDocumento & { _parent_id: string }> = [];
    for (const r of validRows) {
      const id = r[0] ?? "";
      const esSubdoc = (r[10] ?? "FALSE").toUpperCase() === "TRUE";
      if (esSubdoc) {
        const sub: SubDocumento & { _parent_id: string } = {
          id, nombre: r[5] ?? "", fecha_vencimiento: r[6] ?? "",
          enlace_url: r[7] || undefined, notas: r[8] || undefined,
          contabilizar: (r[11] ?? "TRUE").toUpperCase() === "TRUE",
          _parent_id: r[9] ?? "",
        };
        subDocs.push(sub);
      } else {
        padres.push({
          id, tecnico_id: r[1] ?? "", tecnico_nombre: r[2] ?? "",
          ot_codigo: r[3] || undefined, sede_nombre: r[4] ?? "",
          documento_nombre: r[5] ?? "", fecha_vencimiento: r[6] || undefined,
          enlace_url: r[7] || undefined, notas: r[8] || undefined,
          contabilizar: (r[11] ?? "TRUE").toUpperCase() === "TRUE",
          sub_documentos: [],
        });
      }
    }
    for (const sub of subDocs) {
      const padre = padres.find((p) => p.id === sub._parent_id);
      if (padre) {
        const { _parent_id, ...subClean } = sub;
        if (!padre.sub_documentos) padre.sub_documentos = [];
        padre.sub_documentos.push(subClean);
      }
    }
    return padres;
  } catch { return []; }
}

async function getNextHabilitacionId(): Promise<string> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: getSheetId(), range: "Habilitaciones!A2:A" });
  const rows = (res.data.values ?? []) as string[][];
  let maxH = 0;
  let maxSD = 0;
  for (const r of rows) {
    const id = r[0] ?? "";
    const mH = id.match(/^H(\d+)$/);
    if (mH) maxH = Math.max(maxH, parseInt(mH[1], 10));
    const mSD = id.match(/^SD(\d+)$/);
    if (mSD) maxSD = Math.max(maxSD, parseInt(mSD[1], 10));
  }
  return `H${String(maxH + 1).padStart(4, "0")}`;
}

async function getNextSubDocId(): Promise<string> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: getSheetId(), range: "Habilitaciones!A2:A" });
  const rows = (res.data.values ?? []) as string[][];
  let maxSD = 0;
  for (const r of rows) {
    const id = r[0] ?? "";
    const mSD = id.match(/^SD(\d+)$/);
    if (mSD) maxSD = Math.max(maxSD, parseInt(mSD[1], 10));
  }
  return `SD${String(maxSD + 1).padStart(4, "0")}`;
}

export async function addHabilitacion(h: Omit<Habilitacion, "id">): Promise<{ ok: true; id: string }> {
  const sheets = getClient();
  const newId = await getNextHabilitacionId();
  const tecnicoNombre = h.tecnico_nombre || await getTecnicoNombre(h.tecnico_id);
  const contabilizarStr = h.contabilizar === false ? "FALSE" : "TRUE";
  const values = [[newId, h.tecnico_id, tecnicoNombre, h.ot_codigo || "", h.sede_nombre, h.documento_nombre, h.fecha_vencimiento || "", h.enlace_url || "", h.notas || "", "", "FALSE", contabilizarStr]];
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(), range: "Habilitaciones!A:L",
    valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values },
  });
  if (h.sub_documentos && h.sub_documentos.length > 0) {
    const subValues: string[][] = [];
    for (const sub of h.sub_documentos) {
      const subId = await getNextSubDocId();
      const subContab = sub.contabilizar === false ? "FALSE" : "TRUE";
      subValues.push([subId, h.tecnico_id, tecnicoNombre, h.ot_codigo || "", h.sede_nombre, sub.nombre, sub.fecha_vencimiento, sub.enlace_url || "", sub.notas || "", newId, "TRUE", subContab]);
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId: getSheetId(), range: "Habilitaciones!A:L",
      valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: subValues },
    });
  }
  return { ok: true, id: newId };
}

export async function updateHabilitacion(habilitacionId: string, newData: Partial<Habilitacion>): Promise<{ ok: true }> {
  const sheets = getClient();
  const all = await getHabilitaciones();
  const idx = all.findIndex((h) => h.id === habilitacionId);
  if (idx < 0) throw new Error(`Habilitación ${habilitacionId} no encontrada`);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: getSheetId(), range: "Habilitaciones!A2:A" });
  const rows = (res.data.values ?? []) as string[][];
  let rowNumber = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === habilitacionId) { rowNumber = i + 2; break; }
  }
  if (rowNumber < 0) throw new Error(`Fila no encontrada para ${habilitacionId}`);
  const existing = all[idx];
  const updated: Habilitacion = { ...existing, ...newData, id: habilitacionId };
  const tecnicoNombre = updated.tecnico_nombre || await getTecnicoNombre(updated.tecnico_id);
  const contabilizarStr = updated.contabilizar === false ? "FALSE" : "TRUE";
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(), range: `Habilitaciones!A${rowNumber}:L${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[habilitacionId, updated.tecnico_id, tecnicoNombre, updated.ot_codigo || "", updated.sede_nombre, updated.documento_nombre, updated.fecha_vencimiento || "", updated.enlace_url || "", updated.notas || "", "", "FALSE", contabilizarStr]] },
  });
  return { ok: true };
}

export async function deleteHabilitacion(habilitacionId: string): Promise<{ ok: true }> {
  const sheets = getClient();
  const all = await getHabilitaciones();
  const filtered = all.filter((h) => h.id !== habilitacionId);
  const header = [["id", "tecnico_id", "tecnico_nombre", "ot_codigo", "sede_nombre", "documento_nombre", "fecha_vencimiento", "enlace_url", "notas", "parent_id", "es_subdoc", "contabilizar"]];
  const rows: string[][] = [];
  for (const h of filtered) {
    rows.push([h.id, h.tecnico_id, h.tecnico_nombre || "", h.ot_codigo || "", h.sede_nombre, h.documento_nombre, h.fecha_vencimiento || "", h.enlace_url || "", h.notas || "", "", "FALSE", h.contabilizar === false ? "FALSE" : "TRUE"]);
    if (h.sub_documentos) {
      for (const sub of h.sub_documentos) {
        rows.push([sub.id, h.tecnico_id, h.tecnico_nombre || "", h.ot_codigo || "", h.sede_nombre, sub.nombre, sub.fecha_vencimiento, sub.enlace_url || "", sub.notas || "", h.id, "TRUE", sub.contabilizar === false ? "FALSE" : "TRUE"]);
      }
    }
  }
  await sheets.spreadsheets.values.clear({ spreadsheetId: getSheetId(), range: "Habilitaciones!A1:Z" });
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(), range: "Habilitaciones!A1",
    valueInputOption: "USER_ENTERED", requestBody: { values: [...header, ...rows] },
  });
  return { ok: true };
}

export async function addSubDocumento(habilitacionId: string, sub: Omit<SubDocumento, "id">): Promise<{ ok: true; id: string }> {
  const sheets = getClient();
  const all = await getHabilitaciones();
  const padre = all.find((h) => h.id === habilitacionId);
  if (!padre) throw new Error(`Habilitación ${habilitacionId} no encontrada`);
  const newId = await getNextSubDocId();
  const tecnicoNombre = padre.tecnico_nombre || await getTecnicoNombre(padre.tecnico_id);
  const subContab = sub.contabilizar === false ? "FALSE" : "TRUE";
  const values = [[newId, padre.tecnico_id, tecnicoNombre, padre.ot_codigo || "", padre.sede_nombre, sub.nombre, sub.fecha_vencimiento, sub.enlace_url || "", sub.notas || "", habilitacionId, "TRUE", subContab]];
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(), range: "Habilitaciones!A:L",
    valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values },
  });
  return { ok: true, id: newId };
}

export async function updateSubDocumento(subDocId: string, newData: Partial<SubDocumento>): Promise<{ ok: true }> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: getSheetId(), range: "Habilitaciones!A2:A" });
  const rows = (res.data.values ?? []) as string[][];
  let rowNumber = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === subDocId) { rowNumber = i + 2; break; }
  }
  if (rowNumber < 0) throw new Error(`Fila no encontrada para sub-doc ${subDocId}`);
  const rowRes = await sheets.spreadsheets.values.get({ spreadsheetId: getSheetId(), range: `Habilitaciones!A${rowNumber}:L${rowNumber}` });
  const currentRow = (rowRes.data.values ?? [[]])[0] as string[];
  const current = currentRow.length >= 12 ? currentRow : [...currentRow, ...Array(12 - currentRow.length).fill("")];
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(), range: `Habilitaciones!F${rowNumber}:I${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[newData.nombre ?? current[5], newData.fecha_vencimiento ?? current[6], newData.enlace_url ?? current[7], newData.notas ?? current[8]]] },
  });
  if (newData.contabilizar !== undefined) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: getSheetId(), range: `Habilitaciones!L${rowNumber}`,
      valueInputOption: "USER_ENTERED", requestBody: { values: [[newData.contabilizar ? "TRUE" : "FALSE"]] },
    });
  }
  return { ok: true };
}

export async function deleteSubDocumento(subDocId: string): Promise<{ ok: true }> {
  const sheets = getClient();
  const all = await getHabilitaciones();
  const header = [["id", "tecnico_id", "tecnico_nombre", "ot_codigo", "sede_nombre", "documento_nombre", "fecha_vencimiento", "enlace_url", "notas", "parent_id", "es_subdoc", "contabilizar"]];
  const rows: string[][] = [];
  for (const h of all) {
    rows.push([h.id, h.tecnico_id, h.tecnico_nombre || "", h.ot_codigo || "", h.sede_nombre, h.documento_nombre, h.fecha_vencimiento || "", h.enlace_url || "", h.notas || "", "", "FALSE", h.contabilizar === false ? "FALSE" : "TRUE"]);
    if (h.sub_documentos) {
      for (const sub of h.sub_documentos) {
        if (sub.id === subDocId) continue;
        rows.push([sub.id, h.tecnico_id, h.tecnico_nombre || "", h.ot_codigo || "", h.sede_nombre, sub.nombre, sub.fecha_vencimiento, sub.enlace_url || "", sub.notas || "", h.id, "TRUE", sub.contabilizar === false ? "FALSE" : "TRUE"]);
      }
    }
  }
  await sheets.spreadsheets.values.clear({ spreadsheetId: getSheetId(), range: "Habilitaciones!A1:Z" });
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(), range: "Habilitaciones!A1",
    valueInputOption: "USER_ENTERED", requestBody: { values: [...header, ...rows] },
  });
  return { ok: true };
}

export async function replaceAllHabilitaciones(habilitaciones: Habilitacion[]): Promise<{ ok: true }> {
  const sheets = getClient();
  const header = [["id", "tecnico_id", "tecnico_nombre", "ot_codigo", "sede_nombre", "documento_nombre", "fecha_vencimiento", "enlace_url", "notas", "parent_id", "es_subdoc", "contabilizar"]];
  const rows: string[][] = [];
  const tecnicos = await getTecnicos();
  const tecMap: Record<string, string> = {};
  tecnicos.forEach(t => { tecMap[t.id] = t.nombre; });
  for (const h of habilitaciones) {
    const tecnicoNombre = h.tecnico_nombre || tecMap[h.tecnico_id] || "";
    rows.push([h.id, h.tecnico_id, tecnicoNombre, h.ot_codigo || "", h.sede_nombre, h.documento_nombre, h.fecha_vencimiento || "", h.enlace_url || "", h.notas || "", "", "FALSE", h.contabilizar === false ? "FALSE" : "TRUE"]);
    if (h.sub_documentos) {
      for (const sub of h.sub_documentos) {
        rows.push([sub.id, h.tecnico_id, tecnicoNombre, h.ot_codigo || "", h.sede_nombre, sub.nombre, sub.fecha_vencimiento, sub.enlace_url || "", sub.notas || "", h.id, "TRUE", sub.contabilizar === false ? "FALSE" : "TRUE"]);
      }
    }
  }
  await sheets.spreadsheets.values.clear({ spreadsheetId: getSheetId(), range: "Habilitaciones!A1:Z" });
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(), range: "Habilitaciones!A1",
    valueInputOption: "USER_ENTERED", requestBody: { values: [...header, ...rows] },
  });
  return { ok: true };
}

// ============================================================
// PRESETS DE SEDES - CRUD
// ============================================================
export async function getPresetsSedes(): Promise<PresetSede[]> {
  try {
    const sheets = getClient();
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: getSheetId(), range: "Presets_Sedes!A2:I" });
    const rows = (res.data.values ?? []) as string[][];
    const validRows = rows.filter((r) => r.length > 0 && r.some((c) => c && c.trim() !== ""));
    const presetsSede: PresetSede[] = [];
    const docsByParent: Record<string, PresetDocumento[]> = {};
    const subDocsByParent: Record<string, SubDocumento[]> = {};
    for (const r of validRows) {
      const id = r[0] ?? "";
      const tipo = (r[1] ?? "").toUpperCase();
      const sede_nombre = r[2] ?? "";
      const parent_id = r[3] ?? "";
      const nombre = r[4] ?? "";
      const fecha = r[5] ?? "";
      const enlace = r[6] ?? "";
      const notas = r[7] ?? "";
      const contab = (r[8] ?? "TRUE").toUpperCase() === "TRUE";
      if (tipo === "SEDE") {
        presetsSede.push({ id, sede_nombre, documentos: [] });
      } else if (tipo === "DOC") {
        const doc: PresetDocumento = { id, nombre, fecha_vencimiento: fecha || undefined, enlace_url: enlace || undefined, notas: notas || undefined, sub_documentos: [] };
        if (!docsByParent[parent_id]) docsByParent[parent_id] = [];
        docsByParent[parent_id].push(doc);
      } else if (tipo === "SUBDOC") {
        const sub: SubDocumento = { id, nombre, fecha_vencimiento: fecha, enlace_url: enlace || undefined, notas: notas || undefined, contabilizar: contab };
        if (!subDocsByParent[parent_id]) subDocsByParent[parent_id] = [];
        subDocsByParent[parent_id].push(sub);
      }
    }
    for (const preset of presetsSede) {
      const docs = docsByParent[preset.id] || [];
      for (const doc of docs) {
        doc.sub_documentos = subDocsByParent[doc.id] || [];
      }
      preset.documentos = docs;
    }
    return presetsSede;
  } catch { return []; }
}

async function getNextPresetId(prefix: "PS" | "PD" | "PDS"): Promise<string> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: getSheetId(), range: "Presets_Sedes!A2:A" });
  const rows = (res.data.values ?? []) as string[][];
  let max = 0;
  for (const r of rows) {
    const id = r[0] ?? "";
    const m = id.match(new RegExp(`^${prefix}(\\d+)$`));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

export async function addPresetSede(sede_nombre: string): Promise<{ ok: true; id: string }> {
  const sheets = getClient();
  const newId = await getNextPresetId("PS");
  const values = [[newId, "SEDE", sede_nombre, "", "", "", "", "", "TRUE"]];
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(), range: "Presets_Sedes!A:I",
    valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values },
  });
  return { ok: true, id: newId };
}

export async function deletePresetSede(presetSedeId: string): Promise<{ ok: true }> {
  const sheets = getClient();
  const all = await getPresetsSedes();
  const filtered = all.filter((p) => p.id !== presetSedeId);
  const header = [["id", "tipo", "sede_nombre", "parent_id", "nombre", "fecha_vencimiento", "enlace_url", "notas", "contabilizar"]];
  const rows: string[][] = [];
  for (const p of filtered) {
    rows.push([p.id, "SEDE", p.sede_nombre, "", "", "", "", "", "TRUE"]);
    for (const doc of p.documentos) {
      rows.push([doc.id, "DOC", p.sede_nombre, p.id, doc.nombre, doc.fecha_vencimiento || "", doc.enlace_url || "", doc.notas || "", "TRUE"]);
      if (doc.sub_documentos) {
        for (const sub of doc.sub_documentos) {
          rows.push([sub.id, "SUBDOC", p.sede_nombre, doc.id, sub.nombre, sub.fecha_vencimiento, sub.enlace_url || "", sub.notas || "", sub.contabilizar === false ? "FALSE" : "TRUE"]);
        }
      }
    }
  }
  await sheets.spreadsheets.values.clear({ spreadsheetId: getSheetId(), range: "Presets_Sedes!A1:Z" });
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(), range: "Presets_Sedes!A1",
    valueInputOption: "USER_ENTERED", requestBody: { values: [...header, ...rows] },
  });
  return { ok: true };
}

export async function addPresetDocumento(presetSedeId: string, doc: Omit<PresetDocumento, "id">): Promise<{ ok: true; id: string }> {
  const sheets = getClient();
  const all = await getPresetsSedes();
  const preset = all.find(p => p.id === presetSedeId);
  if (!preset) throw new Error(`Preset ${presetSedeId} no encontrado`);
  const newId = await getNextPresetId("PD");
  const values = [[newId, "DOC", preset.sede_nombre, presetSedeId, doc.nombre, doc.fecha_vencimiento || "", doc.enlace_url || "", doc.notas || "", "TRUE"]];
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(), range: "Presets_Sedes!A:I",
    valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values },
  });
  if (doc.sub_documentos && doc.sub_documentos.length > 0) {
    const subValues: string[][] = [];
    for (const sub of doc.sub_documentos) {
      const subId = await getNextPresetId("PDS");
      subValues.push([subId, "SUBDOC", preset.sede_nombre, newId, sub.nombre, sub.fecha_vencimiento, sub.enlace_url || "", sub.notas || "", sub.contabilizar === false ? "FALSE" : "TRUE"]);
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId: getSheetId(), range: "Presets_Sedes!A:I",
      valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: subValues },
    });
  }
  return { ok: true, id: newId };
}

export async function deletePresetDocumento(presetDocId: string): Promise<{ ok: true }> {
  const sheets = getClient();
  const all = await getPresetsSedes();
  const header = [["id", "tipo", "sede_nombre", "parent_id", "nombre", "fecha_vencimiento", "enlace_url", "notas", "contabilizar"]];
  const rows: string[][] = [];
  for (const p of all) {
    rows.push([p.id, "SEDE", p.sede_nombre, "", "", "", "", "", "TRUE"]);
    for (const doc of p.documentos) {
      if (doc.id === presetDocId) continue;
      rows.push([doc.id, "DOC", p.sede_nombre, p.id, doc.nombre, doc.fecha_vencimiento || "", doc.enlace_url || "", doc.notas || "", "TRUE"]);
      if (doc.sub_documentos) {
        for (const sub of doc.sub_documentos) {
          rows.push([sub.id, "SUBDOC", p.sede_nombre, doc.id, sub.nombre, sub.fecha_vencimiento, sub.enlace_url || "", sub.notas || "", sub.contabilizar === false ? "FALSE" : "TRUE"]);
        }
      }
    }
  }
  await sheets.spreadsheets.values.clear({ spreadsheetId: getSheetId(), range: "Presets_Sedes!A1:Z" });
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(), range: "Presets_Sedes!A1",
    valueInputOption: "USER_ENTERED", requestBody: { values: [...header, ...rows] },
  });
  return { ok: true };
}

export async function addPresetSubDoc(presetDocId: string, sub: Omit<SubDocumento, "id">): Promise<{ ok: true; id: string }> {
  const sheets = getClient();
  const all = await getPresetsSedes();
  let presetSedeNombre = "";
  for (const p of all) {
    const doc = p.documentos.find(d => d.id === presetDocId);
    if (doc) { presetSedeNombre = p.sede_nombre; break; }
  }
  if (!presetSedeNombre) throw new Error(`Documento ${presetDocId} no encontrado en presets`);
  const newId = await getNextPresetId("PDS");
  const values = [[newId, "SUBDOC", presetSedeNombre, presetDocId, sub.nombre, sub.fecha_vencimiento, sub.enlace_url || "", sub.notas || "", sub.contabilizar === false ? "FALSE" : "TRUE"]];
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(), range: "Presets_Sedes!A:I",
    valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values },
  });
  return { ok: true, id: newId };
}

export async function deletePresetSubDoc(presetSubDocId: string): Promise<{ ok: true }> {
  const sheets = getClient();
  const all = await getPresetsSedes();
  const header = [["id", "tipo", "sede_nombre", "parent_id", "nombre", "fecha_vencimiento", "enlace_url", "notas", "contabilizar"]];
  const rows: string[][] = [];
  for (const p of all) {
    rows.push([p.id, "SEDE", p.sede_nombre, "", "", "", "", "", "TRUE"]);
    for (const doc of p.documentos) {
      rows.push([doc.id, "DOC", p.sede_nombre, p.id, doc.nombre, doc.fecha_vencimiento || "", doc.enlace_url || "", doc.notas || "", "TRUE"]);
      if (doc.sub_documentos) {
        for (const sub of doc.sub_documentos) {
          if (sub.id === presetSubDocId) continue;
          rows.push([sub.id, "SUBDOC", p.sede_nombre, doc.id, sub.nombre, sub.fecha_vencimiento, sub.enlace_url || "", sub.notas || "", sub.contabilizar === false ? "FALSE" : "TRUE"]);
        }
      }
    }
  }
  await sheets.spreadsheets.values.clear({ spreadsheetId: getSheetId(), range: "Presets_Sedes!A1:Z" });
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(), range: "Presets_Sedes!A1",
    valueInputOption: "USER_ENTERED", requestBody: { values: [...header, ...rows] },
  });
  return { ok: true };
}

export async function replaceAllPresetsSedes(presets: PresetSede[]): Promise<{ ok: true }> {
  const sheets = getClient();
  const header = [["id", "tipo", "sede_nombre", "parent_id", "nombre", "fecha_vencimiento", "enlace_url", "notas", "contabilizar"]];
  const rows: string[][] = [];
  for (const p of presets) {
    rows.push([p.id, "SEDE", p.sede_nombre, "", "", "", "", "", "TRUE"]);
    for (const doc of p.documentos) {
      rows.push([doc.id, "DOC", p.sede_nombre, p.id, doc.nombre, doc.fecha_vencimiento || "", doc.enlace_url || "", doc.notas || "", "TRUE"]);
      if (doc.sub_documentos) {
        for (const sub of doc.sub_documentos) {
          rows.push([sub.id, "SUBDOC", p.sede_nombre, doc.id, sub.nombre, sub.fecha_vencimiento, sub.enlace_url || "", sub.notas || "", sub.contabilizar === false ? "FALSE" : "TRUE"]);
        }
      }
    }
  }
  await sheets.spreadsheets.values.clear({ spreadsheetId: getSheetId(), range: "Presets_Sedes!A1:Z" });
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(), range: "Presets_Sedes!A1",
    valueInputOption: "USER_ENTERED", requestBody: { values: [...header, ...rows] },
  });
  return { ok: true };
}

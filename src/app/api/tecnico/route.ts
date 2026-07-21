/**
 * POST /api/tecnico
 * Maneja acciones CRUD para técnicos:
 *   - { accion: "agregar", tecnico: { id, cargo, nombre, correo, codigo_sap, foto_url? } }
 *   - { accion: "actualizar", id, newData: { cargo, nombre, correo, codigo_sap, foto_url? } }
 *   - { accion: "eliminar", id }                          ← eliminación lógica (activo=FALSE)
 *   - { accion: "sincronizar", tecnicos: Tecnico[] }      ← reemplaza toda la hoja (web → Excel)
 *
 * El toggle de activo/inactivo sigue en /api/tecnico/toggle (no se modifica).
 */
import { NextRequest, NextResponse } from "next/server";
import {
  addTecnico,
  updateTecnico,
  deleteTecnicoLogico,
  getTecnicos,
} from "@/lib/sheets";
import { isEditor } from "@/lib/auth";
import { google } from "googleapis";
import type { Tecnico } from "@/lib/types";

export const dynamic = "force-dynamic";

function getClient() {
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY ?? "";
  if (!sheetId || !clientEmail || !privateKeyRaw) {
    throw new Error("Faltan variables de entorno de Google Sheets");
  }
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
  const jwt = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth: jwt });
}

function getSheetId(): string {
  const id = process.env.GOOGLE_SHEETS_ID;
  if (!id) throw new Error("Falta GOOGLE_SHEETS_ID");
  return id;
}

export async function POST(req: NextRequest) {
  if (!(await isEditor())) {
    return NextResponse.json(
      { ok: false, error: "No autorizado. Se requiere modo editor." },
      { status: 403 }
    );
  }
  try {
    const body = await req.json();
    const { accion } = body;

    // ---------- AGREGAR TÉCNICO ----------
    if (accion === "agregar") {
      const t = body.tecnico;
      if (!t || !t.id || !t.nombre || !t.cargo) {
        return NextResponse.json(
          { ok: false, error: "Faltan campos: id, nombre, cargo" },
          { status: 400 }
        );
      }
      await addTecnico({
        id: t.id,
        cargo: t.cargo,
        nombre: t.nombre,
        correo: t.correo || "",
        codigo_sap: t.codigo_sap || "",
        foto_url: t.foto_url || "",
      });
      return NextResponse.json({ ok: true });
    }

    // ---------- ACTUALIZAR TÉCNICO ----------
    if (accion === "actualizar") {
      const { id, newData } = body;
      if (!id || !newData) {
        return NextResponse.json(
          { ok: false, error: "Faltan campos: id, newData" },
          { status: 400 }
        );
      }
      await updateTecnico(id, newData);
      return NextResponse.json({ ok: true });
    }

    // ---------- ELIMINAR TÉCNICO (lógico) ----------
    if (accion === "eliminar") {
      const { id } = body;
      if (!id) {
        return NextResponse.json(
          { ok: false, error: "Falta campo: id" },
          { status: 400 }
        );
      }
      await deleteTecnicoLogico(id);
      return NextResponse.json({ ok: true });
    }

    // ---------- SINCRONIZAR TODO (web → Excel) ----------
    if (accion === "sincronizar") {
      const { tecnicos } = body;
      if (!Array.isArray(tecnicos)) {
        return NextResponse.json(
          { ok: false, error: "Formato inválido: se esperaba array de técnicos" },
          { status: 400 }
        );
      }
      const sheets = getClient();
      const header = [["id", "cargo", "nombre", "correo", "codigo_sap", "estado", "activo", "foto_url"]];
      const rows = (tecnicos as Tecnico[]).map((t) => [
        t.id,
        t.cargo,
        t.nombre,
        t.correo,
        t.codigo_sap,
        t.estado,
        t.activo ? "TRUE" : "FALSE",
        t.foto_url || "",
      ]);

      await sheets.spreadsheets.values.clear({
        spreadsheetId: getSheetId(),
        range: "Tecnicos!A1:Z",
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: getSheetId(),
        range: "Tecnicos!A1",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [...header, ...rows] },
      });
      return NextResponse.json({ ok: true, data: { count: tecnicos.length } });
    }

    return NextResponse.json(
      { ok: false, error: "Acción no reconocida. Usa: agregar, actualizar, eliminar, sincronizar" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[/api/tecnico POST] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/** GET /api/tecnico — Devuelve todos los técnicos (útil para debugging) */
export async function GET() {
  try {
    const tecnicos = await getTecnicos();
    return NextResponse.json({ ok: true, data: tecnicos });
  } catch (err) {
    console.error("[/api/tecnico GET] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

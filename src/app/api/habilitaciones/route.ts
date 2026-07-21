/**
 * GET /api/habilitaciones
 *   Devuelve todas las habilitaciones con sus sub-documentos.
 *
 * POST /api/habilitaciones
 *   Acciones:
 *     - { accion: "agregar", habilitacion }
 *     - { accion: "actualizar", id, newData }
 *     - { accion: "eliminar", id }
 *     - { accion: "agregar_subdoc", habilitacionId, sub }
 *     - { accion: "actualizar_subdoc", id, newData }
 *     - { accion: "eliminar_subdoc", id }
 *     - { accion: "sincronizar", habilitaciones }  ← reemplaza todo (web → Excel)
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getHabilitaciones,
  addHabilitacion,
  updateHabilitacion,
  deleteHabilitacion,
  addSubDocumento,
  updateSubDocumento,
  deleteSubDocumento,
  replaceAllHabilitaciones,
} from "@/lib/sheets";
import { isEditor } from "@/lib/auth";
import type { Habilitacion, SubDocumento } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const habilitaciones = await getHabilitaciones();
    return NextResponse.json({ ok: true, data: habilitaciones });
  } catch (err) {
    console.error("[/api/habilitaciones GET] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // Todas las acciones requieren modo editor
  if (!(await isEditor())) {
    return NextResponse.json(
      { ok: false, error: "No autorizado. Se requiere modo editor." },
      { status: 403 }
    );
  }
  try {
    const body = await req.json();
    const { accion } = body;

    // ---------- AGREGAR HABILITACIÓN ----------
    if (accion === "agregar") {
      const h = body.habilitacion as Omit<Habilitacion, "id">;
      if (!h || !h.tecnico_id || !h.ot_codigo || !h.documento_nombre) {
        return NextResponse.json(
          { ok: false, error: "Faltan campos: tecnico_id, ot_codigo, documento_nombre" },
          { status: 400 }
        );
      }
      const result = await addHabilitacion(h);
      return NextResponse.json({ ok: true, data: { id: result.id } });
    }

    // ---------- ACTUALIZAR HABILITACIÓN ----------
    if (accion === "actualizar") {
      const { id, newData } = body;
      if (!id || !newData) {
        return NextResponse.json(
          { ok: false, error: "Faltan campos: id, newData" },
          { status: 400 }
        );
      }
      await updateHabilitacion(id, newData as Partial<Habilitacion>);
      return NextResponse.json({ ok: true });
    }

    // ---------- ELIMINAR HABILITACIÓN ----------
    if (accion === "eliminar") {
      const { id } = body;
      if (!id) {
        return NextResponse.json(
          { ok: false, error: "Falta campo: id" },
          { status: 400 }
        );
      }
      await deleteHabilitacion(id);
      return NextResponse.json({ ok: true });
    }

    // ---------- AGREGAR SUB-DOCUMENTO ----------
    if (accion === "agregar_subdoc") {
      const { habilitacionId, sub } = body;
      if (!habilitacionId || !sub) {
        return NextResponse.json(
          { ok: false, error: "Faltan campos: habilitacionId, sub" },
          { status: 400 }
        );
      }
      const result = await addSubDocumento(habilitacionId, sub as Omit<SubDocumento, "id">);
      return NextResponse.json({ ok: true, data: { id: result.id } });
    }

    // ---------- ACTUALIZAR SUB-DOCUMENTO ----------
    if (accion === "actualizar_subdoc") {
      const { id, newData } = body;
      if (!id || !newData) {
        return NextResponse.json(
          { ok: false, error: "Faltan campos: id, newData" },
          { status: 400 }
        );
      }
      await updateSubDocumento(id, newData as Partial<SubDocumento>);
      return NextResponse.json({ ok: true });
    }

    // ---------- ELIMINAR SUB-DOCUMENTO ----------
    if (accion === "eliminar_subdoc") {
      const { id } = body;
      if (!id) {
        return NextResponse.json(
          { ok: false, error: "Falta campo: id" },
          { status: 400 }
        );
      }
      await deleteSubDocumento(id);
      return NextResponse.json({ ok: true });
    }

    // ---------- SINCRONIZAR TODO (web → Excel) ----------
    if (accion === "sincronizar") {
      const { habilitaciones } = body;
      if (!Array.isArray(habilitaciones)) {
        return NextResponse.json(
          { ok: false, error: "Formato inválido: se esperaba array de habilitaciones" },
          { status: 400 }
        );
      }
      await replaceAllHabilitaciones(habilitaciones as Habilitacion[]);
      return NextResponse.json({ ok: true, data: { count: habilitaciones.length } });
    }

    return NextResponse.json(
      { ok: false, error: "Acción no reconocida. Usa: agregar, actualizar, eliminar, agregar_subdoc, actualizar_subdoc, eliminar_subdoc, sincronizar" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[/api/habilitaciones POST] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

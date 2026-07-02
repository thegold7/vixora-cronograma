/**
 * POST /api/tecnico/toggle
 * Activa o desactiva un técnico (cambia la columna "activo" en la hoja Tecnicos).
 * Solo accesible en modo editor.
 *
 * Body: { tecnico_id, activo: boolean }
 */
import { NextRequest, NextResponse } from "next/server";
import { toggleTecnicoActivo } from "@/lib/sheets";
import { isEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await isEditor())) {
    return NextResponse.json(
      { ok: false, error: "No autorizado. Se requiere modo editor." },
      { status: 403 }
    );
  }
  try {
    const body = await req.json();
    const { tecnico_id, activo } = body;
    if (!tecnico_id || typeof activo !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "Faltan campos: tecnico_id, activo" },
        { status: 400 }
      );
    }
    await toggleTecnicoActivo(tecnico_id, activo);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/tecnico/toggle] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

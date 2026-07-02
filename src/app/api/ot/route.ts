/**
 * POST /api/ot
 * Maneja 2 acciones:
 *   - { accion: "cambiar_estado", codigo, nuevoEstado }
 *   - { accion: "agregar", codigo, cliente, sede, estado }
 *
 * Solo accesible en modo editor.
 */
import { NextRequest, NextResponse } from "next/server";
import { updateOtEstado, addOt } from "@/lib/sheets";
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
    const { accion } = body;

    if (accion === "cambiar_estado") {
      const { codigo, nuevoEstado } = body;
      if (!codigo || !nuevoEstado) {
        return NextResponse.json(
          { ok: false, error: "Faltan campos: codigo, nuevoEstado" },
          { status: 400 }
        );
      }
      await updateOtEstado(codigo, nuevoEstado);
      return NextResponse.json({ ok: true });
    }

    if (accion === "agregar") {
      const { codigo, cliente, sede, estado } = body;
      if (!codigo || !cliente || !estado) {
        return NextResponse.json(
          { ok: false, error: "Faltan campos: codigo, cliente, estado" },
          { status: 400 }
        );
      }
      await addOt(codigo, cliente, sede || "", estado);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { ok: false, error: "Acción no reconocida. Usa: cambiar_estado o agregar" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[/api/ot] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

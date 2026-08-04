/**
 * POST /api/cronograma/visual
 * Regenera Cronograma_Visual. FIX: ahora usa las entradas enviadas desde la memoria.
 */
import { NextRequest, NextResponse } from "next/server";
import { regenerarCronogramaVisual } from "@/lib/sheets";
import { isEditor } from "@/lib/auth";
import type { EntradaCronograma } from "@/lib/types";

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
    const { year, month, entradas } = body;
    
    const y = parseInt(year, 10);
    const m = month ? parseInt(month, 10) : undefined;
    const entradasArray = (entradas || []) as EntradaCronograma[];

    const result = await regenerarCronogramaVisual(y, m, entradasArray);
    
    return NextResponse.json({
      ok: true,
      data: {
        filas: result.filas,
        columnas: result.columnas,
        mensaje: `Visual actualizado: ${result.filas} filas × ${result.columnas} columnas`,
      },
    });
  } catch (err) {
    console.error("[/api/cronograma/visual POST] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

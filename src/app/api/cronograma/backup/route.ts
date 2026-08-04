/**
 * POST /api/cronograma/backup
 * FIX: Ahora usa las entradas enviadas desde la página (memoria) en vez de leer del Excel.
 */
import { NextRequest, NextResponse } from "next/server";
import { generarCronogramaBackup, regenerarCronogramaVisual } from "@/lib/sheets";
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
    const { accion, entradas } = body;
    const year = body.year ? parseInt(body.year, 10) : new Date().getFullYear();

    if (accion === "generar") {
      // FIX: Pasar las entradas de memoria a generarCronogramaBackup
      const entradasArray = (entradas || []) as EntradaCronograma[];
      const result = await generarCronogramaBackup(year, entradasArray);
      return NextResponse.json({
        ok: true,
        data: {
          filas: result.filas,
          columnas: result.columnas,
          mensaje: `Backup generado: ${result.filas} filas × ${result.columnas} columnas`,
        },
      });
    }

    if (accion === "restaurar") {
      const result = await regenerarCronogramaVisual(year);
      return NextResponse.json({
        ok: true,
        data: {
          filas: result.filas,
          columnas: result.columnas,
          mensaje: `Cronograma restaurado. Visual regenerado: ${result.filas} filas × ${result.columnas} columnas`,
        },
      });
    }

    return NextResponse.json(
      { ok: false, error: "Acción no reconocida. Usa: generar, restaurar" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[/api/cronograma/backup POST] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

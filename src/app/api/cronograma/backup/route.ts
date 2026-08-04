/**
 * POST /api/cronograma/backup
 * Acciones:
 *   - { accion: "generar", year } → sobreescribe Cronograma_Backup con el año completo
 *   - { accion: "restaurar", year } → lee Cronograma_Backup y regenera Cronograma_Visual (los datos ya viven en Backup)
 *
 * Nota: Como Cronograma_Backup es ahora la fuente de verdad, "restaurar" simplemente
 * fuerza una recarga de datos desde Backup (que getCronograma ya hace automáticamente).
 * Este endpoint existe principalmente para forzar la regeneración de Visual y limpiar
 * estado inconsistente.
 */
import { NextRequest, NextResponse } from "next/server";
import { generarCronogramaBackup, regenerarCronogramaVisual } from "@/lib/sheets";
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
    const year = body.year ? parseInt(body.year, 10) : new Date().getFullYear();

    if (accion === "generar") {
      const result = await generarCronogramaBackup(year);
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
      // Como Backup ya es la fuente de verdad, "restaurar" regenera Visual
      // para asegurar consistencia. La data del cronograma se lee de Backup automáticamente.
      const result = await regenerarCronogramaVisual(year);
      return NextResponse.json({
        ok: true,
        data: {
          filas: result.filas,
          columnas: result.columnas,
          mensaje: `Cronograma restaurado desde Backup. Visual regenerado: ${result.filas} filas × ${result.columnas} columnas`,
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

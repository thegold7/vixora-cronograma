/**
 * GET /api/data
 * Devuelve TODOS los datos necesarios para renderizar la app.
 * FIX: ahora también auto-llena activo/visible_mapa vacíos del IMPORTRANGE.
 */
import { NextResponse } from "next/server";
import {
  getTecnicos,
  getOTs,
  getActividades,
  getCronogramaMap,
  getSedes,
  autoCreateMissingSedes,
  fillEmptyOtFields,
} from "@/lib/sheets";
import { getModoAcceso } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const allOts = await getOTs();

    // FIX: Auto-llenar activo/visible_mapa vacíos (de IMPORTRANGE) en el Excel
    // y normalizar COMPLETADO→FINALIZADO. Fire-and-forget (no bloquea el load).
    fillEmptyOtFields().catch(err => console.error("[fillEmptyOtFields]", err));

    const sedesActuales = await getSedes();
    const sedesFinales = await autoCreateMissingSedes(allOts, sedesActuales);

    const [tecnicos, actividades, cronograma, modoAcceso] = await Promise.all([
      getTecnicos(),
      getActividades(),
      getCronogramaMap(),
      getModoAcceso(),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        tecnicos,
        ots: allOts,
        actividades,
        cronograma,
        sedes: sedesFinales,
        modoAcceso,
      },
    });
  } catch (err) {
    console.error("[/api/data] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

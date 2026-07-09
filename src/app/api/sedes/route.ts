/**
 * POST /api/sedes
 * Maneja acciones:
 *   - { accion: "agregar", ... }
 *   - { accion: "eliminar", nombre }
 *   - { accion: "eliminar_ot", codigo }
 *   - { accion: "toggle_visible", codigo, visible } -> OTs
 *   - { accion: "toggle_visible_sede", nombre, visible } -> Sedes
 *   - { accion: "actualizar_sede", nombreOriginal, newData }
 *   - { accion: "sincronizar", sedes }
 */
import { NextRequest, NextResponse } from "next/server";
import { getSedes, addSede, deleteSede, deleteOt, updateOtVisible, updateSede, replaceAllSedes, toggleSedeVisible } from "@/lib/sheets";
import { isEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sedes = await getSedes();
    return NextResponse.json({ ok: true, data: sedes });
  } catch (err) {
    console.error("[/api/sedes GET] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
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

    if (accion === "agregar") {
      const { nombre, lat, lng, region, ciudad, datoCurioso, foto_ciudad } = body;
      if (!nombre || lat === undefined || lng === undefined) {
        return NextResponse.json({ ok: false, error: "Faltan campos" }, { status: 400 });
      }
      await addSede({ nombre, lat: parseFloat(lat), lng: parseFloat(lng), region: region || "", ciudad: ciudad || "", datoCurioso: datoCurioso || "", foto_ciudad: foto_ciudad || "" });
      return NextResponse.json({ ok: true });
    }

    if (accion === "actualizar_sede") {
      const { nombreOriginal, newData } = body;
      if (!nombreOriginal || !newData) {
        return NextResponse.json({ ok: false, error: "Faltan campos" }, { status: 400 });
      }
      await updateSede(nombreOriginal, {
        nombre: newData.nombre,
        lat: parseFloat(newData.lat),
        lng: parseFloat(newData.lng),
        region: newData.region || "",
        ciudad: newData.ciudad || "",
        datoCurioso: newData.datoCurioso || "",
        foto_ciudad: newData.foto_ciudad || ""
      });
      return NextResponse.json({ ok: true });
    }

    if (accion === "eliminar") {
      const { nombre } = body;
      if (!nombre) return NextResponse.json({ ok: false, error: "Falta nombre" }, { status: 400 });
      await deleteSede(nombre);
      return NextResponse.json({ ok: true });
    }

    if (accion === "eliminar_ot") {
      const { codigo } = body;
      if (!codigo) return NextResponse.json({ ok: false, error: "Falta codigo" }, { status: 400 });
      await deleteOt(codigo);
      return NextResponse.json({ ok: true });
    }

    if (accion === "toggle_visible") {
      const { codigo, visible } = body;
      if (!codigo || typeof visible !== "boolean") return NextResponse.json({ ok: false, error: "Faltan campos" }, { status: 400 });
      await updateOtVisible(codigo, visible);
      return NextResponse.json({ ok: true });
    }

    if (accion === "toggle_visible_sede") {
      const { nombre, visible } = body;
      if (!nombre || typeof visible !== "boolean") return NextResponse.json({ ok: false, error: "Faltan campos" }, { status: 400 });
      await toggleSedeVisible(nombre, visible);
      return NextResponse.json({ ok: true });
    }

    if (accion === "sincronizar") {
      const { sedes } = body;
      if (!Array.isArray(sedes)) return NextResponse.json({ ok: false, error: "Formato inválido" }, { status: 400 });
      await replaceAllSedes(sedes);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Acción no reconocida" }, { status: 400 });
  } catch (err) {
    console.error("[/api/sedes POST] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

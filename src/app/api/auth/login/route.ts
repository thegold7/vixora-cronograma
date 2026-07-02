/**
 * POST /api/auth/login
 * Body: { password: string }
 * Si la contraseña coincide con VIXORA_EDITOR_PASSWORD, setea cookie de editor.
 */
import { NextRequest, NextResponse } from "next/server";
import { isValidEditorPassword, AUTH_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body;
    if (!password || !isValidEditorPassword(password)) {
      return NextResponse.json(
        { ok: false, error: "Contraseña incorrecta" },
        { status: 401 }
      );
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(AUTH_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 días
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("[/api/auth/login] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

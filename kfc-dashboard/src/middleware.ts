import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, leerSesion } from "@/lib/sesion";
import { apiPermitida, paginaPermitida, INICIO } from "@/lib/permisos";

// Guardia de toda la app: sin sesión válida no se entra, y cada rol solo llega
// a lo que le toca (tanto a las pantallas como a los datos de la API).
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const esApi = pathname.startsWith("/api/");

  // Rutas públicas: la pantalla de entrada y el inicio/cierre de sesión.
  if (pathname === "/login" || pathname === "/api/auth/login" || pathname === "/api/auth/salir") {
    return NextResponse.next();
  }

  let sesion = null;
  try {
    sesion = await leerSesion(req.cookies.get(COOKIE)?.value);
  } catch {
    sesion = null;
  }

  if (!sesion) {
    if (esApi) return NextResponse.json({ error: "Tu sesión terminó. Vuelve a iniciar sesión." }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/" && pathname !== INICIO) url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (esApi) {
    if (!apiPermitida(sesion.rol, pathname, req.method)) {
      return NextResponse.json({ error: "No tienes permiso para esta acción." }, { status: 403 });
    }
    return NextResponse.next();
  }

  if (pathname === "/") return NextResponse.redirect(new URL(INICIO, req.url));
  if (!paginaPermitida(sesion.rol, pathname)) {
    return NextResponse.redirect(new URL(INICIO, req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Todo menos archivos internos de Next y estáticos.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|map|woff2?)$).*)"],
};

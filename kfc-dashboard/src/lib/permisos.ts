// Quién puede ver y hacer qué. Funciona igual en el navegador, el servidor y el
// middleware (no usa nada que solo exista en un lado).
//
//  admin    → todo, incluida la administración de usuarios.
//  editor   → todo lo del admin, menos administrar usuarios.
//  consulta → solo lo que ve KFC: panel principal, devoluciones (sin reporte
//             semanal ni "Por repartidor"), tiempos, flotilla, reembolsos,
//             materiales y avisos. Sin descargas de Excel y sin editar nada.

export type Rol = "admin" | "editor" | "consulta";

export const ROLES: Rol[] = ["admin", "editor", "consulta"];

export const ETIQUETA_ROL: Record<Rol, string> = {
  admin: "Administrador",
  editor: "Editor",
  consulta: "Consulta (KFC)",
};

export function esRol(v: unknown): v is Rol {
  return v === "admin" || v === "editor" || v === "consulta";
}

// Páginas que ve "consulta" (la ruta exacta o cualquiera que cuelgue de ella).
const PAGINAS_CONSULTA = ["/dashboard", "/devoluciones", "/tiempos", "/flotilla", "/reembolsos", "/materiales", "/avisos"];

// Rutas de datos que "consulta" puede LEER (solo GET).
const APIS_CONSULTA_GET = [
  "/api/kpis",
  "/api/filters",
  "/api/devoluciones/filtros",
  "/api/devoluciones/panorama",
  "/api/devoluciones/incidencias",
  "/api/devoluciones/clima",
  "/api/tiempos/panorama",
  "/api/tiempos/zonas-rojas",
  "/api/flotilla/panorama",
  "/api/reembolsos/filtros",
  "/api/reembolsos/panorama",
  "/api/reembolsos/detalle",
];

function empieza(ruta: string, base: string) {
  return ruta === base || ruta.startsWith(base + "/");
}

/** ¿Puede este rol abrir esta página? */
export function paginaPermitida(rol: Rol, ruta: string): boolean {
  if (rol === "admin") return true;
  if (empieza(ruta, "/usuarios")) return false;
  if (rol === "editor") return true;
  return PAGINAS_CONSULTA.some((p) => empieza(ruta, p));
}

/** ¿Puede este rol llamar a esta ruta de datos con este método? */
export function apiPermitida(rol: Rol, ruta: string, metodo: string): boolean {
  if (empieza(ruta, "/api/auth")) return true;
  if (empieza(ruta, "/api/usuarios")) return rol === "admin";
  if (rol === "admin" || rol === "editor") return true;
  if (metodo !== "GET" && metodo !== "HEAD") return false;
  return APIS_CONSULTA_GET.some((p) => empieza(ruta, p));
}

/** Página a la que mandar a cada rol al entrar. */
export const INICIO = "/dashboard";

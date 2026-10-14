// Lee los filtros de la dirección (?desde=&hasta=&proveedor=&motivo=&estatus=&tienda=) y los
// convierte a los parámetros de las funciones de Supabase.
const lista = (sp: URLSearchParams, k: string) => {
  const v = sp.getAll(k).filter(Boolean);
  return v.length ? v : null;
};

export function filtrosDe(req: Request) {
  const sp = new URL(req.url).searchParams;
  return {
    p_desde: sp.get("desde") || null,
    p_hasta: sp.get("hasta") || null,
    p_proveedor: lista(sp, "proveedor"),
    p_motivo: lista(sp, "motivo"),
    p_estatus: lista(sp, "estatus"),
    p_tiendas: lista(sp, "tienda"),
  };
}

export function buscarDe(req: Request): string | null {
  return (new URL(req.url).searchParams.get("buscar") ?? "").trim().slice(0, 80) || null;
}

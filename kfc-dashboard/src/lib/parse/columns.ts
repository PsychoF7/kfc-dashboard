// Normaliza un encabezado: quita acentos, espacios extra, mayúsculas.
// Así "Creada en", "creada en", "Creada  en", "CREADA EN" son iguales,
// y toleramos variantes con/sin acento como en tu Apps Script original.
export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/\uFEFF/g, "") // carácter invisible que traen algunos CSV al inicio
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export type ColumnType = "text" | "number" | "boolean" | "datetime";

export interface ColumnDef {
  key: string; // nombre de columna en Supabase
  aliases: string[]; // variantes de encabezado aceptadas (se normalizan solas)
  type: ColumnType;
}

// -----------------------------------------------------------------------
// Data de OPERACIONES (ops) — columnas que usamos como campos propios.
// -----------------------------------------------------------------------
export const OPS_COLUMNS: ColumnDef[] = [
  { key: "order_id", aliases: ["orderId", "ID de orden", "order_id"], type: "text" },
  { key: "comensal", aliases: ["Comensal"], type: "text" },
  { key: "pais", aliases: ["Pais", "País"], type: "text" },
  { key: "ciudad", aliases: ["Ciudad"], type: "text" },
  { key: "zona", aliases: ["Zona"], type: "text" },
  { key: "creada_en", aliases: ["Creada en"], type: "datetime" },
  { key: "orden_manual", aliases: ["Orden manual"], type: "boolean" },
  { key: "orden_planeada", aliases: ["Orden planeada"], type: "boolean" },
  { key: "hora_estimada_pickup", aliases: ["Hora estimada pickup"], type: "text" },
  { key: "cooking_time", aliases: ["Cooking Time"], type: "number" },
  { key: "canal", aliases: ["Canal"], type: "text" },
  { key: "estatus_orden", aliases: ["Estatus de orden"], type: "text" },
  { key: "razon_rechazo", aliases: ["Razon de rechazo", "Razón de rechazo"], type: "text" },
  { key: "subtotal", aliases: ["subtotal"], type: "number" },
  { key: "promo_code", aliases: ["promoCode"], type: "text" },
  { key: "total", aliases: ["total"], type: "number" },
  { key: "costo_de_envio", aliases: ["Costo de envio", "Costo de envío"], type: "number" },
  { key: "metodo_pago", aliases: ["Metodo de pago", "Método de pago"], type: "text" },
  { key: "aceptada_en", aliases: ["Aceptada en"], type: "datetime" },
  { key: "cancelada_en", aliases: ["Cancelada en"], type: "datetime" },
  { key: "completada_en", aliases: ["Completada en"], type: "datetime" },
  { key: "restaurant_id", aliases: ["restaurantId"], type: "text" },
  { key: "restaurant", aliases: ["Restaurant", "Restaurante"], type: "text" },
  { key: "repartido_por", aliases: ["Repartido por"], type: "text" },
  { key: "estatus_envio", aliases: ["Estatus de envio", "Estatus de envío"], type: "text" },
  {
    key: "distancia_cliente_restaurante",
    aliases: ["Distancia entre cliente y restaurante"],
    type: "number",
  },
  {
    key: "tiempo_total_orden",
    aliases: [
      "Tiempo estimado total entre creacion y completado",
      "Tiempo estimado total entre creación y completado",
    ],
    type: "number",
  },
  { key: "tiempo_aceptacion_restaurante", aliases: ["Tiempo de aceptacion de restaurante", "Tiempo de aceptación de restaurante"], type: "number" },
  { key: "tiempo_aceptacion_repartidor", aliases: ["Tiempo de aceptacion de repartidor", "Tiempo de aceptación de repartidor"], type: "number" },
  { key: "tiempo_llegar_tienda", aliases: ["Tiempo para llegar a tienda"], type: "number" },
  { key: "tiempo_recoger", aliases: ["Tiempo para recoger"], type: "number" },
  { key: "tiempo_entregar", aliases: ["Tiempo para entregar"], type: "number" },
  { key: "tiempo_completar", aliases: ["Tiempo para completar"], type: "number" },
  { key: "tiempo_manejo", aliases: ["Tiempo de manejo"], type: "number" },
  { key: "tiempo_total_envio", aliases: ["Tiempo total de envio", "Tiempo total de envío"], type: "number" },
];

// -----------------------------------------------------------------------
// Data de VENTAS
// -----------------------------------------------------------------------
export const VENTAS_COLUMNS: ColumnDef[] = [
  { key: "order_id", aliases: ["orderId", "ID de orden", "order_id"], type: "text" },
  { key: "comensal", aliases: ["Comensal"], type: "text" },
  { key: "pais", aliases: ["Pais", "País"], type: "text" },
  { key: "ciudad", aliases: ["Ciudad"], type: "text" },
  { key: "creada_en", aliases: ["Creada en"], type: "datetime" },
  { key: "orden_planeada", aliases: ["Orden planeada"], type: "boolean" },
  { key: "hora_estimada_pickup", aliases: ["Hora estimada pickup"], type: "text" },
  { key: "cooking_time", aliases: ["Cooking Time"], type: "number" },
  { key: "telefono_comensal", aliases: ["Telefono Comensal", "Teléfono Comensal"], type: "text" },
  { key: "canal", aliases: ["Canal"], type: "text" },
  { key: "estatus_orden", aliases: ["Estatus de orden"], type: "text" },
  { key: "razon_rechazo", aliases: ["Razon de rechazo", "Razón de rechazo"], type: "text" },
  { key: "subtotal", aliases: ["subtotal"], type: "number" },
  { key: "promo_code", aliases: ["promoCode"], type: "text" },
  { key: "total", aliases: ["total"], type: "number" },
  {
    key: "a_depositar_aproximado",
    aliases: ["A depositar (aproximado)", "A depositar"],
    type: "number",
  },
  { key: "costo_envio_fijo", aliases: ["Costo de envio fijo", "Costo de envío fijo"], type: "number" },
  {
    key: "costo_envio_distancia_extra",
    aliases: ["Costo de envio por distancia extra", "Costo de envío por distancia extra"],
    type: "number",
  },
  {
    key: "costo_envio_facturado",
    aliases: ["Costo de envio facturado", "Costo de envío facturado"],
    type: "number",
  },
  { key: "metodo_pago", aliases: ["Metodo de pago", "Método de pago"], type: "text" },
  { key: "estatus_pago", aliases: ["Estatus de pago"], type: "text" },
  { key: "aceptada_en", aliases: ["Aceptada en"], type: "datetime" },
  { key: "cancelada_en", aliases: ["Cancelada en"], type: "datetime" },
  { key: "completada_en", aliases: ["Completada en"], type: "datetime" },
  { key: "restaurant_id", aliases: ["restaurantId"], type: "text" },
  { key: "restaurant", aliases: ["Restaurant", "Restaurante"], type: "text" },
  { key: "repartido_por", aliases: ["Repartido por"], type: "text" },
  { key: "estatus_envio", aliases: ["Estatus de envio", "Estatus de envío"], type: "text" },
];

// -----------------------------------------------------------------------
// Data de TIEMPOS (kfcDeliveryTimesFrom_...csv) — base de la sección de
// Devoluciones y cancelaciones (y después de Análisis de tiempos).
// Calle/colonia/CP y los problemas de dirección los calcula Supabase
// solo al guardar (ver supabase/devoluciones.sql).
// -----------------------------------------------------------------------
export const TIEMPOS_COLUMNS: ColumnDef[] = [
  { key: "order_id", aliases: ["ID de la orden", "orderId", "order_id"], type: "text" },
  { key: "creada_en", aliases: ["Fecha de creacion", "Fecha de creación", "Creada en"], type: "datetime" },
  { key: "direccion", aliases: ["Direccion", "Dirección"], type: "text" },
  { key: "estatus_orden", aliases: ["Estatus", "Estatus de orden"], type: "text" },
  { key: "motivo_cancelacion", aliases: ["Motivo de cancelacion", "Motivo de cancelación"], type: "text" },
  { key: "restaurant_id", aliases: ["ID del restaurante", "restaurantId"], type: "text" },
  { key: "restaurant", aliases: ["Nombre del restaurante", "Restaurant"], type: "text" },
  { key: "cliente", aliases: ["Nombre del cliente"], type: "text" },
  { key: "telefono_raw", aliases: ["Numero del cliente", "Número del cliente"], type: "text" },
  { key: "total", aliases: ["Total"], type: "number" },
  { key: "repartido_por", aliases: ["Repartido por"], type: "text" },
  { key: "metodo_pago", aliases: ["Metodo de pago", "Método de pago"], type: "text" },
  { key: "latitud", aliases: ["Latitud de cliente"], type: "number" },
  { key: "longitud", aliases: ["Longitud de cliente"], type: "number" },
  { key: "tiempo_aceptacion_restaurante", aliases: ["Tiempo de aceptacion de restaurante"], type: "number" },
  { key: "tiempo_aceptacion_repartidor", aliases: ["Tiempo de aceptacion de repartidor"], type: "number" },
  { key: "tiempo_llegar_tienda", aliases: ["Tiempo para llegar a tienda"], type: "number" },
  { key: "tiempo_recoger", aliases: ["Tiempo para recoger"], type: "number" },
  { key: "tiempo_entregar", aliases: ["Tiempo para entregar"], type: "number" },
  { key: "tiempo_completar", aliases: ["Tiempo para completar"], type: "number" },
  { key: "sla_45", aliases: ["Tiempo total sin cooking time <45"], type: "boolean" },
  { key: "sla_60", aliases: ["Tiempo total sin cooking time <60"], type: "boolean" },
];

// Una tienda es "Mi Flotilla" si su nombre termina en " MF"
// (ej. "775 KFC EJERCITO MEXICANO MF"); si no, es Delivery.
export function isFlotilla(restaurant: string | null | undefined): boolean {
  if (!restaurant) return false;
  return /\sMF$/i.test(restaurant.trim());
}

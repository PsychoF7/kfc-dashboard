"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, LayerGroup } from "leaflet";

export interface TiendaMapa {
  tienda: string;
  lat: number | null;
  lon: number | null;
  ordenes: number;
  devueltas: number;
  canceladas: number;
  monto_devuelto: number;
  pct_dev: number;
  pct_canc: number;
  pct_problema: number;
}

export type MetricaMapa = "dev" | "canc";

/** Color según el % (verde = dentro de la meta del 2%, rojo = muy alto). */
export function colorPct(p: number) {
  if (p <= 0.02) return "#1F8A54";
  if (p <= 0.05) return "#E0B000";
  if (p <= 0.08) return "#F07C1B";
  return "#D63A3A";
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const money = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export default function MapaDevoluciones({
  tiendas,
  metrica,
  minOrdenes,
}: {
  tiendas: TiendaMapa[];
  metrica: MetricaMapa;
  minOrdenes: number;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<LeafletMap | null>(null);
  const capa = useRef<LayerGroup | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);

  // Crear el mapa una sola vez (Leaflet solo funciona en el navegador)
  useEffect(() => {
    let cancelado = false;
    import("leaflet").then((mod) => {
      if (cancelado || !contenedor.current || mapa.current) return;
      L.current = mod;
      const m = mod
        .map(contenedor.current, { preferCanvas: true, scrollWheelZoom: false })
        .setView([21.5, -101.5], 5);
      mod
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
          className: "mapa-base-gris",
        })
        .addTo(m);
      mapa.current = m;
      capa.current = mod.layerGroup().addTo(m);
      dibujar();
    });
    return () => {
      cancelado = true;
      mapa.current?.remove();
      mapa.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    dibujar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiendas, metrica, minOrdenes]);

  function dibujar() {
    const mod = L.current;
    const m = mapa.current;
    const g = capa.current;
    if (!mod || !m || !g) return;
    g.clearLayers();
    const limites: [number, number][] = [];

    const conCoords = tiendas.filter((t) => t.lat != null && t.lon != null && t.ordenes >= minOrdenes);
    const valor = (t: TiendaMapa) => (metrica === "dev" ? t.devueltas : t.canceladas);
    const porcentaje = (t: TiendaMapa) => (metrica === "dev" ? t.pct_dev : t.pct_canc);
    const maxV = Math.max(1, ...conCoords.map(valor));

    // las más grandes primero, para que las chicas queden encima y se puedan tocar
    [...conCoords]
      .sort((a, b) => valor(b) - valor(a))
      .forEach((t) => {
        const radio = 5 + 22 * Math.sqrt(valor(t) / maxV);
        mod
          .circleMarker([t.lat!, t.lon!], {
            radius: radio,
            color: "#fff",
            weight: 1,
            fillColor: colorPct(porcentaje(t)),
            fillOpacity: 0.8,
          })
          .bindPopup(
            `<strong>${esc(t.tienda)}</strong><br/>` +
              `${t.ordenes.toLocaleString("es-MX")} órdenes<br/>` +
              `${t.devueltas.toLocaleString("es-MX")} devueltas (${pct(t.pct_dev)}) · ${money(t.monto_devuelto)}<br/>` +
              `${t.canceladas.toLocaleString("es-MX")} canceladas (${pct(t.pct_canc)})<br/>` +
              `Problema total: ${pct(t.pct_problema)}`
          )
          .bindTooltip(`${esc(t.tienda)}: ${pct(porcentaje(t))}`)
          .addTo(g);
        limites.push([t.lat!, t.lon!]);
      });

    if (limites.length > 0) m.fitBounds(limites, { padding: [24, 24], maxZoom: 12 });
  }

  return (
    <>
      {/* Mapa base en tonos suaves para que resalten los círculos */}
      <style>{`.mapa-base-gris { filter: grayscale(0.85) brightness(1.04) contrast(0.95); }`}</style>
      <div
        ref={contenedor}
        className="h-[420px] w-full overflow-hidden rounded-lg border border-ink-100"
        role="region"
        aria-label="Mapa de devoluciones y cancelaciones por tienda"
      />
    </>
  );
}

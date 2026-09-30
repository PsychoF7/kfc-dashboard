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
  pct_problema: number;
}

// [lat, lon, tienda, fecha, id corto, monto]
export type PuntoMapa = [number, number, string, string, string, number];

export type ModoMapa = "tiendas" | "ordenes";

/** Color según % de devolución (verde = dentro de la meta, rojo = muy alto). */
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
  puntos,
  modo,
  minOrdenes,
}: {
  tiendas: TiendaMapa[];
  puntos: PuntoMapa[];
  modo: ModoMapa;
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
      const m = mod.map(contenedor.current, { preferCanvas: true, scrollWheelZoom: false }).setView([21.5, -101.5], 5);
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
  }, [tiendas, puntos, modo, minOrdenes]);

  function dibujar() {
    const mod = L.current;
    const m = mapa.current;
    const g = capa.current;
    if (!mod || !m || !g) return;
    g.clearLayers();
    const limites: [number, number][] = [];

    if (modo === "tiendas") {
      const conCoords = tiendas.filter((t) => t.lat != null && t.lon != null && t.ordenes >= minOrdenes);
      const maxDev = Math.max(1, ...conCoords.map((t) => t.devueltas));
      // las más chicas arriba para que no queden tapadas
      [...conCoords]
        .sort((a, b) => b.devueltas - a.devueltas)
        .forEach((t) => {
          const radio = 5 + 22 * Math.sqrt(t.devueltas / maxDev);
          mod
            .circleMarker([t.lat!, t.lon!], {
              radius: radio,
              color: "#fff",
              weight: 1,
              fillColor: colorPct(t.pct_dev),
              fillOpacity: 0.8,
            })
            .bindPopup(
              `<strong>${esc(t.tienda)}</strong><br/>` +
                `${t.devueltas.toLocaleString("es-MX")} devueltas de ${t.ordenes.toLocaleString("es-MX")} órdenes (${pct(t.pct_dev)})<br/>` +
                `${t.canceladas.toLocaleString("es-MX")} canceladas · problema total ${pct(t.pct_problema)}<br/>` +
                `Monto devuelto: ${money(t.monto_devuelto)}`
            )
            .bindTooltip(`${esc(t.tienda)}: ${pct(t.pct_dev)}`)
            .addTo(g);
          limites.push([t.lat!, t.lon!]);
        });
    } else {
      puntos.forEach(([lat, lon, tienda, fecha, id, monto]) => {
        mod
          .circleMarker([lat, lon], {
            radius: 4,
            stroke: false,
            fillColor: "#D63A3A",
            fillOpacity: 0.45,
          })
          .bindPopup(`<strong>${esc(tienda)}</strong><br/>${esc(fecha)} · ${esc(id)}<br/>${money(monto)}`)
          .addTo(g);
        limites.push([lat, lon]);
      });
    }

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
      aria-label="Mapa de devoluciones"
    />
    </>
  );
}

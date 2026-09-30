"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import { colorMinutos, minutos, pctTxt, type TiemposTienda } from "@/lib/tiempos";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Mapa de tiendas: color = minutos hasta que el repartidor sale con la
 * orden; tamaño = órdenes; borde rojo punteado = zona roja. */
export default function MapaTiempos({
  tiendas,
  minOrdenes,
  esZonaRoja,
}: {
  tiendas: TiemposTienda[];
  minOrdenes: number;
  esZonaRoja: (t: TiemposTienda) => boolean;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<LeafletMap | null>(null);
  const capa = useRef<LayerGroup | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);

  useEffect(() => {
    let cancelado = false;
    import("leaflet").then((mod) => {
      if (cancelado || !contenedor.current || mapa.current) return;
      L.current = mod;
      const m = mod
        .map(contenedor.current, { preferCanvas: true, scrollWheelZoom: true })
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
  }, [tiendas, minOrdenes, esZonaRoja]);

  function dibujar() {
    const mod = L.current;
    const m = mapa.current;
    const g = capa.current;
    if (!mod || !m || !g) return;
    g.clearLayers();
    const limites: [number, number][] = [];
    const lista = tiendas.filter((t) => t.lat != null && t.lon != null && t.completadas >= minOrdenes);
    const maxO = Math.max(1, ...lista.map((t) => t.completadas));

    [...lista]
      .sort((a, b) => b.completadas - a.completadas)
      .forEach((t) => {
        const roja = esZonaRoja(t);
        const radio = 5 + 18 * Math.sqrt(t.completadas / maxO);
        mod
          .circleMarker([t.lat!, t.lon!], {
            radius: radio,
            color: roja ? "#B42318" : "#fff",
            weight: roja ? 3 : 1,
            dashArray: roja ? "4 3" : undefined,
            fillColor: colorMinutos(t.recol_med),
            fillOpacity: 0.85,
          })
          .bindPopup(
            `<strong>${esc(t.tienda)}</strong>${roja ? " · <span style='color:#B42318'>zona roja</span>" : ""}<br/>` +
              `${esc(t.zona)}<br/>` +
              `Hasta que sale el repartidor: <strong>${minutos(t.recol_med)}</strong>` +
              (t.vs_zona != null ? ` (${t.vs_zona >= 0 ? "+" : ""}${t.vs_zona.toFixed(1)} vs su zona)` : "") +
              `<br/>Tiempo total: ${minutos(t.total_prom)} · ${pctTxt(t.pct_45)} en menos de 45 min<br/>` +
              `${t.completadas.toLocaleString("es-MX")} órdenes completadas · ${pctTxt(t.pct_dev)} devolución`
          )
          .bindTooltip(`${esc(t.tienda)}: ${minutos(t.recol_med)}`)
          .addTo(g);
        limites.push([t.lat!, t.lon!]);
      });

    if (limites.length > 0) m.fitBounds(limites, { padding: [24, 24], maxZoom: 12 });
  }

  return (
    <>
      <style>{`.mapa-base-gris { filter: grayscale(0.85) brightness(1.04) contrast(0.95); }`}</style>
      <div
        ref={contenedor}
        className="h-[440px] w-full overflow-hidden rounded-lg border border-ink-100"
        role="region"
        aria-label="Mapa de tiempos por tienda"
      />
    </>
  );
}

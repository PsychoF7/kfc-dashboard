"use client";

import { useEffect, useMemo, useState } from "react";
import { getWeekRange } from "@/lib/week";

interface DiaComparativa {
  dia: string;
  en_ventas: number;
  en_operaciones: number;
  diferencia: number;
}

interface FilaDesglose {
  categoria: "general" | "delivery" | "flotilla";
  monto_efectivo: number;
  n_efectivo: number;
  n_tarjeta: number;
  envios_efectivo:

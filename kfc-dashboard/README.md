# Panel Operativo KFC — Fase 1

Dashboard operativo construido con **Next.js** (para desplegar en Vercel) y
**Supabase** (Postgres) como base de datos. Esta primera fase incluye:

- Carga de archivos `.xlsx` o `.csv` para la data de **Operaciones** y de
  **Ventas**, cada una en su propia tabla.
- **Panel principal** con filtros (fecha, ciudad, restaurant, zona, estatus
  de orden, repartido por, orden planeada, rango de precio) y los KPIs que
  pediste: órdenes totales, completadas, devueltas, canceladas (con %),
  tiendas activas, órdenes en efectivo/tarjeta, precio promedio y venta
  total.

Todo lo demás (desglose de pagos, facturación, devoluciones/fraude,
tiempos, avisos, bugs, desarrollos, altas/bajas, reembolsos, materiales)
está mapeado en el menú lateral como "Próximamente" — son las siguientes
fases, que se construyen sobre esta misma base de datos.

---

## 1. Crear el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) y crea una cuenta (puedes
   usar tu correo o GitHub).
2. Clic en **New Project**. Elige un nombre (ej. `kfc-dashboard`), una
   contraseña para la base de datos (guárdala, no se puede recuperar
   después) y la región más cercana (ej. `us-east-1`).
3. Espera 1-2 minutos a que se aprovisione el proyecto.
4. En el menú lateral ve a **SQL Editor** → **New query**, pega **todo** el
   contenido del archivo [`supabase/schema.sql`](./supabase/schema.sql) de
   este proyecto, y da clic en **Run**. Esto crea las tablas
   `uploads`, `ops_orders`, `ventas_orders` y las funciones que usa el
   dashboard.
5. Ve a **Project Settings → API**. Ahí vas a encontrar tres valores que
   necesitas para el siguiente paso:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (dice "secret", no la compartas) →
     `SUPABASE_SERVICE_ROLE_KEY`

## 2. Configurar el proyecto localmente (opcional, para probarlo antes de subirlo)

```bash
npm install
cp .env.local.example .env.local
# Edita .env.local y pega los 3 valores de Supabase del paso anterior
npm run dev
```

Abre `http://localhost:3000` — deberías ver el panel. Ve a **Cargar
datos** y sube un archivo de ejemplo para probar.

## 3. Subir el proyecto a GitHub

```bash
git init
git add .
git commit -m "Panel operativo KFC — Fase 1"
```

Crea un repositorio nuevo (vacío) en [github.com/new](https://github.com/new)
y sigue las instrucciones que te da GitHub para conectar tu carpeta local
(`git remote add origin ...` y `git push`).

## 4. Desplegar en Vercel

1. Entra a [vercel.com](https://vercel.com) y crea una cuenta (puedes
   entrar directo con tu cuenta de GitHub).
2. Clic en **Add New → Project**, elige el repositorio que acabas de
   subir.
3. En **Environment Variables**, agrega las mismas 3 variables de
   Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`).
4. Clic en **Deploy**. En 1-2 minutos tendrás una URL pública tipo
   `kfc-dashboard.vercel.app`.

Cada vez que subas cambios a GitHub (`git push`), Vercel vuelve a
desplegar automáticamente.

## 5. Sobre el envío de correos (fases siguientes)

Para la sección de pagos/avisos vamos a usar **Resend**
([resend.com](https://resend.com)) — es el que mejor integra con
Next.js/Vercel: tiene una capa gratuita amplia, API simple y verificación
de dominio sencilla. Cuando lleguemos a esa fase, los pasos serán:

1. Crear cuenta en resend.com.
2. Verificar tu dominio (agregar unos registros DNS que Resend te indica)
   para poder enviar como `pagos@tudominio.com` en vez de una dirección
   genérica.
3. Generar un API key y agregarlo como `RESEND_API_KEY` en Vercel.

No necesitas hacer esto todavía — te aviso cuando construyamos esa parte.

---

## Notas técnicas importantes

- **No se pierde información:** además de las columnas típicas que usa el
  dashboard, cada fila guarda el archivo original completo en una columna
  `raw` (formato JSON). Así, cuando construyamos facturación, tiempos o
  devoluciones, no hay que volver a pedirte que resubas nada — ya está
  la información completa desde la Fase 1.
- **Semanas que se traslapan:** si subes dos reportes que comparten
  algunas órdenes, no se duplican — la orden se actualiza (se identifica
  por `orderId`).
- **Mi Flotilla vs Delivery:** se calcula automáticamente según si el
  nombre del restaurant termina en " MF".
- **Por qué guardar mínimo un mes:** la facturación mensual, el
  comparativo de altas/bajas y las tendencias de devoluciones necesitan
  ver el mes completo (y a veces el mes anterior) en una sola consulta —
  por eso todo upload se acumula en la misma base en vez de reemplazarse.

# Backend — tiendaLujosa (NestJS)

API REST de la tienda. NestJS 10 + TypeScript estricto + Sequelize sobre PostgreSQL.
Ver el SDD en [`../docs/SDD.md`](../docs/SDD.md) y las reglas en [`../AGENTS.md`](../AGENTS.md).

## Requisitos

- Node.js **>= 20.9**
- npm
- Docker (para el PostgreSQL de desarrollo)

## Puesta en marcha

Desde `backend/`:

```powershell
# 1) Dependencias
npm install

# 2) Variables de entorno (Windows / PowerShell)
Copy-Item .env.example .env

# 3) PostgreSQL de desarrollo (desde la raíz del proyecto)
cd ..
docker compose up -d postgres
cd backend

# 4) Arranque en modo desarrollo
npm run start:dev
```

Comprobación del endpoint de salud (verifica la conexión a la base de datos). Toda la API exige
la cabecera `x-app-token` con el valor de `APP_ACCESS_TOKEN`:

```powershell
$headers = @{ "x-app-token" = "el_valor_de_APP_ACCESS_TOKEN" }
Invoke-RestMethod http://localhost:3001/api/v1/health -Headers $headers
```

Respuesta esperada:

```json
{ "status": "ok", "database": "up", "timestamp": "..." }
```

Si la base de datos no responde, el endpoint devuelve `503` con el formato de error único
(SDD §9).

## Scripts

| Script | Comando | Qué hace |
|---|---|---|
| `npm run start:dev` | `nest start --watch` | Arranca con recarga en caliente |
| `npm run start:prod` | `node dist/main` | Arranca el build compilado |
| `npm run build` | `nest build` | Compila a `dist/` |
| `npm run typecheck` | `tsc --noEmit` | Verifica tipos sin emitir archivos |
| `npm run lint` | `eslint … --fix` | Lint (y autofix) |
| `npm run test` | `jest` | Pruebas unitarias |
| `npm run test:e2e` | `jest --config ./test/jest-e2e.json` | Pruebas end-to-end |

## Estructura

```
src/
├── config/                     # validación de variables de entorno (Joi)
├── infrastructure/
│   └── database/               # conexión Sequelize (sin modelos de negocio aún)
├── modules/                    # un directorio por dominio
│   └── health/                 # GET /api/v1/health
├── shared/                     # filtros, pipes, guards, utilidades (se añaden por fase)
├── app.module.ts
└── main.ts
```

La API se sirve bajo el prefijo global `/api/v1`. Los módulos de dominio (`auth`, `products`,
`orders`…) se incorporan en las fases 2 en adelante.

## Variables de entorno

Definidas en `.env.example`. Las obligatorias se validan al arrancar (el proceso falla si falta
alguna). Nunca subir `.env` al repositorio.

- **Base de datos** (mismo patrón que SmartBucks): `DB_DIALECT`, `DB_HOST`, `DB_PORT`, `DB_NAME`
  (`arkimenext`), `DB_USER`, `DB_PASSWORD`, `DB_SSL`.
- **`APP_ACCESS_TOKEN`**: clave compartida con el frontend. Se exige en la cabecera `x-app-token`
  en **todas** las rutas mediante `AppTokenMiddleware`. Debe coincidir con la del `frontend/.env`.

## Seguridad de acceso entre frontend y backend

`AppTokenMiddleware` (`src/shared/middleware/app-token/`) compara la cabecera `x-app-token` con
`APP_ACCESS_TOKEN` (comparación en tiempo constante) y responde `401` con el formato de error
único si no coincide. No identifica usuarios: es un filtro de clientes autorizados, equivalente
al `ensureAccessFromApp` de SmartBucks. La autenticación real de usuarios llega en la Fase 5.

> Como la clave no puede exponerse en el navegador, el frontend debe llamar al backend desde el
> **servidor** de Next.js (Server Components, Route Handlers o Server Actions) con
> `src/shared/api/backend.ts`.

## Migraciones

Se gestionarán con `sequelize-cli` en `migrations/` a partir de la **Fase 2**. `sync()` está
prohibido (ADR-0001).

> **Estado de verificación (Fase 1):** el agente no ejecuta `npm install`, builds, pruebas ni
> servidores (regla 6 de AGENTS.md). Los comandos de esta sección los ejecuta el usuario; el
> agente solo ejecuta `tsc --noEmit`. Anota aquí el resultado real cuando los corras.

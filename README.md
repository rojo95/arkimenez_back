# Backend — tiendaLujosa (NestJS)

API REST de la tienda. NestJS 10 + TypeScript estricto + Sequelize sobre PostgreSQL.
Ver el SDD en [`../plan/SDD.md`](../plan/SDD.md) y las reglas en [`../AGENTS.md`](../AGENTS.md).

## Requisitos

- Node.js **>= 20.9**
- npm
- PostgreSQL local (se usa directamente, sin Docker)

## Puesta en marcha

Desde `backend/`:

```powershell
# 1) Dependencias
npm install

# 2) Variables de entorno
Copy-Item .env.example .env
# Edita .env: credenciales de PostgreSQL, APP_ACCESS_TOKEN, JWT_ACCESS_SECRET
# y el primer OWNER (INITIAL_OWNER_EMAIL / INITIAL_OWNER_PASSWORD).

# 3) Crear la base de datos (si no existe)
psql -U postgres -c "CREATE DATABASE arkimenext;"

# 4) Migraciones y datos iniciales
npm run db:migrate
npm run db:seed

# 5) Arranque en modo desarrollo
npm run start:dev
```

Genera `JWT_ACCESS_SECRET` (mínimo 32 caracteres) con:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
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

La documentación OpenAPI está disponible en `http://localhost:3001/api/v1/docs` (solo fuera de
producción y sin `x-app-token`).

## Scripts

| Script | Comando | Qué hace |
|---|---|---|
| `npm run start:dev` | `nest start --watch` | Arranca con recarga en caliente |
| `npm run start:prod` | `node dist/main` | Arranca el build compilado |
| `npm run build` | `nest build` | Compila a `dist/` |
| `npm run typecheck` | `tsc --noEmit` | Verifica tipos sin emitir archivos |
| `npm run lint` | `eslint … --fix` | Lint (y autofix) |
| `npm run db:migrate` | `sequelize-cli db:migrate` | Aplica las migraciones pendientes |
| `npm run db:migrate:undo` | `sequelize-cli db:migrate:undo` | Revierte la última migración |
| `npm run db:seed` | `ts-node seeders/seed.ts` | Siembra permisos, roles, ajustes y primer OWNER |
| `npm run test` | `jest` | Pruebas unitarias |
| `npm run test:integration` | `jest --config ./test/jest-integration.json` | Integración contra PostgreSQL real |
| `npm run test:e2e` | `jest --config ./test/jest-e2e.json` | Pruebas end-to-end |
| `npm run openapi:export` | `ts-node scripts/export-openapi.ts` | Genera `openapi.json` |

## Estructura

```
config/                        # configuración de sequelize-cli
migrations/                    # esquema versionado (sync() prohibido)
seeders/seed.ts                # entrada del seeder
scripts/export-openapi.ts      # exporta el contrato OpenAPI
src/
├── config/                    # validación de variables de entorno (Joi)
├── infrastructure/
│   ├── database/              # conexión Sequelize (synchronize: false)
│   └── storage/               # StorageProvider local/S3 (ADR-0004)
├── modules/                   # un directorio por dominio
│   ├── audit/                 # registro de auditoría
│   ├── auth/                  # JWT, guards (CSRF, sesión, permisos) y decoradores
│   ├── catalog/               # productos, variantes, categorías, atributos e imágenes
│   ├── health/                # GET /api/v1/health
│   ├── inventory/             # stock, movimientos y ajustes auditados
│   ├── roles-permissions/     # matriz RBAC y resolución de permisos
│   ├── seed/                  # seeder idempotente
│   ├── store-settings/        # configuración clave-valor de la tienda
│   └── users/                 # usuarios y hash argon2id
├── shared/                    # filtro global, pipes Joi, traceId, errores
├── app.module.ts
└── main.ts
```

La API se sirve bajo el prefijo global `/api/v1`.

## Variables de entorno

Definidas en `.env.example`. Las obligatorias se validan al arrancar (el proceso falla si falta
alguna). Nunca subir `.env` al repositorio.

- **Base de datos** (mismo patrón que SmartBucks): `DB_DIALECT`, `DB_HOST`, `DB_PORT`, `DB_NAME`
  (`arkimenext`), `DB_USER`, `DB_PASSWORD`, `DB_SSL`, `TEST_DB_NAME` (debe terminar en `_test`).
- **`APP_ACCESS_TOKEN`**: clave compartida con el frontend. Se exige en la cabecera `x-app-token`
  en **todas** las rutas mediante `AppTokenMiddleware`. Debe coincidir con la del `frontend/.env`.
- **Sesiones**: `JWT_ACCESS_SECRET` (obligatoria, mínimo 32), `ACCESS_TOKEN_TTL`,
  `REFRESH_TOKEN_TTL_DAYS`, `COOKIE_DOMAIN`, `COOKIE_SECURE` (obligatoria `true` en producción).
- **Tienda**: `STORE_NAME`, `DEFAULT_LOCALE`, `ACTIVE_LOCALES`, `STORE_CURRENCY`.
- **Imágenes** (ADR-0004): `STORAGE_DRIVER` (`local`|`s3`), `STORAGE_LOCAL_DIR`,
  `MAX_IMAGE_SIZE_MB` y las `S3_*` (obligatorias solo con `STORAGE_DRIVER=s3`). `local` no está
  permitido con `NODE_ENV=production`.
- **Primer OWNER** (solo lo necesita el seeder): `INITIAL_OWNER_EMAIL`, `INITIAL_OWNER_PASSWORD`.

## Seguridad de acceso entre frontend y backend

`AppTokenMiddleware` (`src/shared/middleware/app-token/`) compara la cabecera `x-app-token` con
`APP_ACCESS_TOKEN` (comparación en tiempo constante) y responde `401` con el formato de error
único si no coincide. No identifica usuarios: es un filtro de clientes autorizados, equivalente
al `ensureAccessFromApp` de SmartBucks.

Las guardas globales de la Fase 2 aplican, en este orden: CSRF por doble envío, sesión JWT
(`access_token` en cookie httpOnly o `Authorization: Bearer`) y permisos (`@RequirePermissions`).
El login/logout llega en la Fase 5.

> Como la clave no puede exponerse en el navegador, el frontend debe llamar al backend desde el
> **servidor** de Next.js (Server Components, Route Handlers o Server Actions) con
> `src/shared/api/backend.ts`.

## Catálogo, imágenes e inventario (Fase 3)

- Endpoints públicos (sin sesión, pero sí con `x-app-token`): `GET /products`,
  `GET /products/:slugOrId`, `GET /categories` y `GET /attributes`. Solo devuelven productos
  `PUBLISHED`; aceptan `locale` o `Accept-Language` con fallback al idioma por defecto.
- Endpoints de administración (`/admin/*`) protegidos por `product:read_admin`, `product:write`,
  `product:publish`, `category:write`, `inventory:read` e `inventory:adjust`.
- Las imágenes se validan por contenido real con `sharp`, se re-codifican a WebP y se generan
  `thumb`/`medium`/`large` con nombres generados por el servidor. Con el driver local se sirven en
  `/media/...` (exento de `x-app-token`); en producción se usa S3.
- El stock se ajusta con `PATCH /admin/inventory/:variantId`, exige un motivo, bloquea la fila con
  `FOR UPDATE`, registra `stock_movements` y deja auditoría. Nunca puede quedar negativo.
- Los archivos locales se guardan en `STORAGE_LOCAL_DIR` (por defecto `.uploads/`, ignorado por git).

## Migraciones y seeder

- El esquema se versiona **solo** con migraciones (`backend/migrations/`); `sequelize.sync()` está
  prohibido (ADR-0001).
- El seeder es idempotente: crea/actualiza permisos, roles y la matriz del MVP; crea los ajustes
  iniciales solo si faltan y el primer `OWNER` solo si no existe ninguno. No sobrescribe cuentas
  ni valores existentes.
- Las pruebas de integración recrean `TEST_DB_NAME` (por eso debe terminar en `_test`) y aplican
  todas las migraciones antes de correr.

> **Estado de verificación:** el agente no ejecuta `npm install`, builds, migraciones, pruebas ni
> servidores (regla 6 de AGENTS.md). Los comandos de esta sección los ejecuta el usuario; el
> agente solo ejecuta `tsc --noEmit`. Anota aquí el resultado real cuando los corras.

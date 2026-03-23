# Sistema de Autenticación — MySQL (Aiven) + Redis

## Arquitectura

```
┌──────────────┐     ┌────────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Frontend   │────▶│  Controlador   │────▶│    Servicio de   │────▶│ Repositorio  │
│  (Cliente)   │     │ auth.controller│     │  Autenticación   │     │    de Datos   │
│              │◀────│                │◀────│  auth.service    │◀────│              │
└──────────────┘     └────────────────┘     └──────────────────┘     └──────┬───────┘
                                                                           │
                                                                    ┌──────┴───────┐
                                                                    │              │
                                                               ┌────▼────┐   ┌────▼──────┐
                                                               │  Redis  │   │  MySQL    │
                                                               │ (Caché) │   │ (Aiven)  │
                                                               └─────────┘   └──────────┘
```

### Capas del sistema

| Capa | Archivo | Responsabilidad |
|------|---------|-----------------|
| **Controlador** | `controllers/auth.controller.js` | Recibe peticiones HTTP, valida inputs, invoca al servicio y retorna respuestas JSON |
| **Servicio** | `services/auth.service.js` | Lógica de negocio: flujo de login/registro, bcrypt, generación de JWT |
| **Repositorio** | `repositories/user.repository.js` | Acceso a datos: consulta Redis primero, luego MySQL, cachea automáticamente |
| **Config** | `config/db.js` y `config/redis.js` | Conexiones a MySQL (Aiven) y Redis con manejo de errores |
| **Middleware** | `middleware/auth.middleware.js` | Verificación de JWT y autorización por roles |

---

## Flujo paso a paso del Login

```
Cliente envía: POST /api/auth/login { email, password }
                          │
                          ▼
              ┌───────────────────────┐
              │  1. Controlador       │  Valida que email y password estén presentes
              │     auth.controller   │
              └──────────┬────────────┘
                         │
                         ▼
              ┌───────────────────────┐
              │  2. Servicio          │  Llama a userRepo.findByEmail(email)
              │     auth.service      │
              └──────────┬────────────┘
                         │
                         ▼
              ┌───────────────────────┐
              │  3. Repositorio       │  Busca en Redis (key = "user:<email>")
              │     user.repository   │
              └──────────┬────────────┘
                         │
                ┌────────┴────────┐
                │                 │
          Cache HIT          Cache MISS
                │                 │
                │                 ▼
                │        ┌─────────────────┐
                │        │ 4. Consultar    │
                │        │    MySQL/Aiven  │
                │        └────────┬────────┘
                │                 │
                │           ┌─────┴─────┐
                │           │           │
                │        Existe      No existe
                │           │           │
                │           ▼           ▼
                │     ┌──────────┐   Error 404:
                │     │ 5. Cachear│  "Usuario no
                │     │ en Redis │   encontrado"
                │     └────┬─────┘
                │          │
                ▼          ▼
         ┌─────────────────────────┐
         │ 6. Validar contraseña   │  bcrypt.compare(password, hash)
         │    con bcrypt           │
         └────────────┬────────────┘
                      │
               ┌──────┴──────┐
               │             │
           Correcta     Incorrecta
               │             │
               ▼             ▼
        ┌────────────┐   Error 401:
        │ 7. Generar │   "Contraseña
        │    JWT     │    incorrecta"
        └─────┬──────┘
              │
              ▼
        ┌────────────────────────────┐
        │ 8. Responder con:         │
        │    { token, usuario }     │
        └────────────────────────────┘
```

---

## Estructura del proyecto

```
auth-redis-postgres/
├── config/
│   ├── db.js                 # Conexión MySQL Aiven (mysql2/promise Pool)
│   └── redis.js              # Conexión Redis (ioredis + TTL)
├── controllers/
│   └── auth.controller.js    # Endpoints: login, registro, logout, perfil
├── database/
│   └── schema.sql            # Referencia DDL tabla usuario (ya existe en Aiven)
├── middleware/
│   └── auth.middleware.js    # verificarToken + requiereRol
├── repositories/
│   └── user.repository.js   # Acceso a datos Redis + MySQL
├── routes/
│   └── auth.routes.js        # Definición de rutas Express
├── services/
│   └── auth.service.js       # Lógica: login, registro, logout
├── .env.example              # Plantilla de variables de entorno
├── package.json
├── server.js                 # Entry point Express
└── README.md                 # Este archivo
```

---

## Instalación y ejecución

### 1. Prerrequisitos
- **Node.js** >= 18
- **MySQL** — Ya corriendo en Aiven (`mysql-2113fd00-elgigate7248-6015.g.aivencloud.com:14428`)
- **Redis** >= 7 — Necesita estar corriendo localmente o en un servicio cloud

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Las credenciales de MySQL ya vienen configuradas para Aiven
# Solo necesitas ajustar Redis si no es localhost
```

### 3. Instalar dependencias y arrancar

```bash
cd auth-redis-postgres
npm install
npm run dev    # Desarrollo con nodemon
# o
npm start      # Produccion
```

El servidor arranca en `http://localhost:4000` y verifica conexion a MySQL y Redis al iniciar.

---

## Endpoints

### `POST /api/auth/registro`

Registra un nuevo usuario.

```json
// Request body
{
  "nombre": "Juan Perez",
  "email": "juan@correo.com",
  "password": "miClave123"
}

// Response 201
{
  "success": true,
  "message": "Usuario registrado exitosamente",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "usuario": {
    "id": 1,
    "nombre": "Juan Perez",
    "email": "juan@correo.com",
    "rol": "CLIENTE",
    "created_at": "2026-03-23T21:00:00.000Z"
  }
}
```

### `POST /api/auth/login`

Inicia sesion. Primero consulta Redis (cache), si no existe consulta MySQL y cachea.

```json
// Request body
{
  "email": "juan@correo.com",
  "password": "miClave123"
}

// Response 200
{
  "success": true,
  "message": "Inicio de sesion exitoso",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "usuario": {
    "id": 1,
    "nombre": "Juan Perez",
    "email": "juan@correo.com",
    "rol": "CLIENTE",
    "created_at": "2026-03-23T21:00:00.000Z"
  }
}
```

### `GET /api/auth/perfil`

Retorna datos del usuario autenticado (requiere header `Authorization: Bearer <token>`).

### `POST /api/auth/logout`

Cierra sesion e invalida la cache Redis del usuario (requiere token).

### `GET /health`

Health check de conexiones a MySQL y Redis.

```json
{
  "status": "OK",
  "mysql": "connected",
  "redis": "connected",
  "uptime": 123.45
}
```

---

## Manejo de errores

| Codigo | Situacion |
|--------|-----------|
| `400` | Campos faltantes o formato invalido |
| `401` | Contrasena incorrecta o token invalido/expirado |
| `403` | Rol no autorizado para el recurso |
| `404` | Usuario no encontrado |
| `409` | Email ya registrado (registro duplicado) |
| `500` | Error de conexion a MySQL o Redis |

---

## Decisiones tecnicas

- **mysql2/promise** con pool de hasta 10 conexiones y SSL para Aiven
- **bcrypt** con `saltRounds=10` para hashing seguro de contrasenas
- **Redis TTL** configurable (default 1 hora) para auto-expirar la cache
- **ioredis** con `retryStrategy` para reconexion automatica a Redis
- Si Redis falla, el sistema sigue funcionando consultando MySQL directamente (resiliencia)
- Las contrasenas hasheadas se guardan en la cache para poder validar login desde Redis sin tocar MySQL
- Usa la tabla `usuario` ya existente en la base de datos Aiven del proyecto

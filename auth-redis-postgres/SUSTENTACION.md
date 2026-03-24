# Sustentacion - Primer Parcial
## Validacion de Autenticacion del Usuario desde FrontEnd combinando BD Relacional y No Relacional (Redis)

---

# DISTRIBUCION DE ROLES PARA EL EQUIPO (3 personas)

## PERSONA 1 — Arquitectura y Base de Datos
**Tema:** Arquitectura general, MySQL (Aiven), esquema de datos, por que se eligio cada tecnologia

## PERSONA 2 — Redis y Flujo de Cache
**Tema:** Redis como cache, flujo de login con cache, TTL, rendimiento, resiliencia

## PERSONA 3 — Codigo y Demo en Vivo
**Tema:** Codigo del backend (capas), JWT, bcrypt, endpoints, demo en vivo

---

# GUION DETALLADO POR PERSONA

---

## PERSONA 1: Arquitectura y Base de Datos (5-7 min)

### 1.1 Introduccion al proyecto
> "Desarrollamos un sistema de autenticacion para una tienda online que combina dos tipos de bases de datos: MySQL como base de datos relacional para almacenamiento permanente, y Redis como base de datos no relacional para cache de alta velocidad."

### 1.2 Diagrama de Arquitectura (dibujar o mostrar)

```
┌──────────────┐     ┌────────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Frontend   │────>│  Controlador   │────>│    Servicio de   │────>│ Repositorio  │
│  (Cliente)   │     │ auth.controller│     │  Autenticacion   │     │   de Datos   │
│              │<────│                │<────│  auth.service    │<────│              │
└──────────────┘     └────────────────┘     └──────────────────┘     └──────┬───────┘
                                                                           │
                                                                    ┌──────┴───────┐
                                                                    │              │
                                                               ┌────▼────┐   ┌────▼──────┐
                                                               │  Redis  │   │  MySQL    │
                                                               │ (Cache) │   │ (Aiven)  │
                                                               └─────────┘   └──────────┘
```

### 1.3 Por que esta arquitectura por capas
- **Controlador:** Recibe las peticiones HTTP, valida que los datos esten completos
- **Servicio:** Logica de negocio (hashear contrasena, generar token)
- **Repositorio:** Acceso a datos (Redis + MySQL)
- **Ventaja:** Cada capa tiene una responsabilidad unica (principio SOLID - Single Responsibility)

### 1.4 Base de datos relacional — MySQL (Aiven)
- **Por que MySQL:** Ya lo usamos en todo el proyecto de la tienda online, esta en la nube con Aiven
- **Tabla principal:** `usuario` con campos: id_usuario, nombre, email, contrasena, fecha_registro
- **La contrasena se guarda hasheada** con bcrypt (nunca texto plano)
- **MySQL es la fuente de verdad:** todos los datos reales estan ahi

### 1.5 Que es Aiven
- Servicio de bases de datos en la nube (DBaaS)
- Conexion segura con SSL
- No necesitamos instalar MySQL localmente

### Posibles preguntas para Persona 1:
- **P: Por que no usaron solo MySQL?** R: "Para mejorar rendimiento. Con Redis reducimos las consultas repetidas a MySQL, que es mas lento por ser disco vs memoria RAM."
- **P: Por que MySQL y no PostgreSQL?** R: "El proyecto ya usaba MySQL con Aiven desde el inicio. Adaptamos el modulo de auth para usar la misma base de datos existente."
- **P: Que pasa si Aiven se cae?** R: "El sistema retorna error 500 al usuario. MySQL es la fuente de verdad, sin ella no se puede autenticar a nadie."
- **P: Que es un Pool de conexiones?** R: "Es un conjunto de conexiones pre-creadas a la BD que se reutilizan, en lugar de abrir y cerrar una conexion por cada consulta. Mejora el rendimiento."

---

## PERSONA 2: Redis y Flujo de Cache (5-7 min)

### 2.1 Que es Redis
> "Redis es una base de datos NoSQL que almacena datos en memoria RAM como pares clave-valor. Es extremadamente rapido porque no escribe en disco. Lo usamos como cache entre el frontend y MySQL."

### 2.2 Caracteristicas clave de Redis
- **In-memory:** Los datos viven en RAM = acceso en microsegundos
- **Clave-valor:** Almacenamos `user:email@test.com` → `{id, nombre, email, contrasena, ...}`
- **TTL (Time To Live):** Cada dato se auto-elimina despues de 1 hora (3600 segundos)
- **NoSQL:** No tiene tablas ni esquema fijo, es flexible

### 2.3 Flujo completo del Login (EXPLICAR PASO A PASO)

```
1. Usuario envia email + contrasena desde el Frontend
                    │
                    ▼
2. El Controlador valida que ambos campos existan
                    │
                    ▼
3. El Servicio llama al Repositorio: "buscar usuario por email"
                    │
                    ▼
4. El Repositorio busca PRIMERO en Redis (cache)
                    │
           ┌────────┴────────┐
           │                 │
     CACHE HIT          CACHE MISS
     (lo encontro)      (no esta)
           │                 │
           │                 ▼
           │        5. Consulta MySQL
           │                 │
           │           ┌─────┴─────┐
           │           │           │
           │        Existe     No existe → Error 404
           │           │
           │           ▼
           │     6. Guarda en Redis (cache) con TTL 1 hora
           │           │
           ▼           ▼
7. Compara contrasena con bcrypt.compare()
           │
    ┌──────┴──────┐
    │             │
 Correcta     Incorrecta → Error 401
    │
    ▼
8. Genera JWT (token) y lo envia al Frontend
```

### 2.4 Que pasa en el segundo login del mismo usuario?
> "Redis ya tiene el usuario cacheado, entonces NO va a MySQL. El login es instantaneo porque Redis responde en microsegundos. Esto se evidencia en los logs del servidor."

### 2.5 Que pasa cuando se hace logout?
> "Se elimina la entrada del usuario de Redis. El proximo login tendra que ir a MySQL de nuevo y re-cachear."

### 2.6 Resiliencia — Que pasa si Redis se cae?
> "El sistema sigue funcionando. Cada llamada a Redis esta dentro de un try/catch. Si Redis falla, retorna null y el sistema va directo a MySQL. El usuario nunca se entera."

Mostrar el codigo:
```javascript
async function findInCache(email) {
  try {
    const data = await redis.get('user:' + email);
    if (!data) return null;
    return JSON.parse(data);
  } catch (err) {
    // Si Redis falla, simplemente retorna null y sigue con MySQL
    console.error('Error Redis, continuando con MySQL:', err.message);
    return null;
  }
}
```

### 2.7 TTL (Time To Live)
- Configurado en 3600 segundos (1 hora)
- Despues de 1 hora, Redis elimina automaticamente el dato
- El proximo login reconsulta MySQL y re-cachea
- **Por que?** Para que si un admin cambia datos del usuario en MySQL, el cache no quede desactualizado indefinidamente

### Posibles preguntas para Persona 2:
- **P: Por que Redis y no Memcached?** R: "Redis soporta mas tipos de datos, tiene persistencia opcional, TTL nativo, y una comunidad mas grande."
- **P: Que pasa si se llena la RAM de Redis?** R: "Redis tiene politicas de eviccion (LRU) que eliminan las claves menos usadas. Ademas, con TTL de 1h los datos se limpian solos."
- **P: Y si cambian la contrasena en MySQL pero Redis tiene la vieja?** R: "El logout elimina el cache. Ademas el TTL de 1 hora garantiza que eventualmente se actualiza. Tambien se podria invalidar el cache al cambiar la contrasena."
- **P: Donde corre Redis?** R: "Localmente en WSL (Windows Subsystem for Linux). En produccion se usaria un servicio cloud como Redis Cloud o AWS ElastiCache."
- **P: Que tipo de base de datos es Redis?** R: "Es una base de datos NoSQL de tipo clave-valor (key-value store), almacena datos en memoria RAM."

---

## PERSONA 3: Codigo y Demo en Vivo (5-7 min)

### 3.1 Stack tecnologico
- **Node.js + Express:** Servidor HTTP
- **mysql2/promise:** Driver MySQL con soporte async/await
- **ioredis:** Cliente Redis para Node.js con reconexion automatica
- **bcrypt:** Hashing de contrasenas (algoritmo computacionalmente costoso)
- **jsonwebtoken (JWT):** Tokens de autenticacion stateless

### 3.2 Estructura del proyecto
```
auth-redis-postgres/
├── config/
│   ├── db.js              ← Conexion MySQL (Pool)
│   └── redis.js           ← Conexion Redis (ioredis)
├── controllers/
│   └── auth.controller.js ← Recibe peticiones HTTP
├── services/
│   └── auth.service.js    ← Logica: bcrypt + JWT
├── repositories/
│   └── user.repository.js ← Redis + MySQL queries
├── middleware/
│   └── auth.middleware.js ← Verificacion JWT + roles
├── routes/
│   └── auth.routes.js     ← Definicion de rutas
└── server.js              ← Entry point
```

### 3.3 Seguridad — bcrypt
```javascript
// Al registrar: hashear la contrasena
const hash = await bcrypt.hash('miClave123', 10);
// Resultado: $2b$10$X7z... (60 caracteres, irreversible)

// Al hacer login: comparar sin descifrar
const esValida = await bcrypt.compare('miClave123', hash);
// Retorna true o false
```
- **Salt rounds = 10:** Cada hash es unico aunque la contrasena sea la misma
- **Irreversible:** No se puede obtener la contrasena original desde el hash
- **Lento a proposito:** Previene ataques de fuerza bruta

### 3.4 Seguridad — JWT (JSON Web Token)
```javascript
// Generar token al login exitoso
const token = jwt.sign(
  { id: 136, email: 'juan@test.com', nombre: 'Juan', rol: 'CLIENTE' },
  'clave_secreta',
  { expiresIn: '24h' }
);
```
- El token se envia al Frontend y se guarda en localStorage
- En cada peticion protegida, el Frontend envia: `Authorization: Bearer <token>`
- El middleware verifica el token antes de dejar pasar la peticion
- **Stateless:** El servidor no guarda sesiones, toda la info esta en el token

### 3.5 Endpoints de la API
| Metodo | Ruta | Descripcion | Protegido |
|--------|------|-------------|-----------|
| POST | /api/auth/registro | Crear usuario nuevo | No |
| POST | /api/auth/login | Iniciar sesion | No |
| POST | /api/auth/logout | Cerrar sesion (limpia cache) | Si (JWT) |
| GET | /api/auth/perfil | Ver datos del usuario | Si (JWT) |
| GET | /health | Estado de conexiones | No |

### 3.6 DEMO EN VIVO (preparar estos comandos)

**Paso 1 — Verificar que todo esta conectado:**
```
GET http://localhost:4000/health
→ { "status": "OK", "mysql": "connected", "redis": "connected" }
```

**Paso 2 — Registrar usuario:**
```json
POST http://localhost:4000/api/auth/registro
Body: { "nombre": "Demo User", "email": "demo@test.com", "password": "demo123" }
→ Retorna token + usuario creado
→ LOG: "Cache SET → demo@test.com (TTL 3600s)"
```

**Paso 3 — Login (usa Redis cache):**
```json
POST http://localhost:4000/api/auth/login
Body: { "email": "demo@test.com", "password": "demo123" }
→ LOG: "Cache HIT → demo@test.com"  ← NO toco MySQL!
```

**Paso 4 — Logout (invalida cache):**
```json
POST http://localhost:4000/api/auth/logout
Header: Authorization: Bearer <token>
→ Se elimina de Redis
```

**Paso 5 — Login de nuevo (va a MySQL):**
```json
POST http://localhost:4000/api/auth/login
→ LOG: "DB HIT → demo@test.com"     ← Fue a MySQL porque el cache se limpio
→ LOG: "Cache SET → demo@test.com"  ← Lo volvio a cachear
```

**Paso 6 — Error: contrasena incorrecta:**
```json
POST http://localhost:4000/api/auth/login
Body: { "email": "demo@test.com", "password": "claveMal" }
→ { "success": false, "error": "Contrasena incorrecta" }
```

### Posibles preguntas para Persona 3:
- **P: Que es bcrypt?** R: "Un algoritmo de hashing disenado para contrasenas. Es lento a proposito para que los ataques de fuerza bruta sean impracticables."
- **P: Que es JWT?** R: "JSON Web Token. Es un token firmado digitalmente que contiene datos del usuario. El servidor lo genera al login y el cliente lo envia en cada peticion."
- **P: Por que no guardar la sesion en el servidor?** R: "Con JWT el sistema es stateless, escala mejor porque cualquier servidor puede verificar el token sin consultar una BD de sesiones."
- **P: Que pasa si alguien roba el token?** R: "Tiene expiracion de 24h. Ademas se puede implementar una lista negra de tokens o refresh tokens."
- **P: Que pasa si la contrasena tiene menos de 6 caracteres?** R: "El servicio valida la longitud minima y retorna error 400 antes de intentar registrar."

---

# PREGUNTAS GENERALES PARA TODO EL EQUIPO

### P: Cual es la diferencia entre BD relacional y no relacional?
> "MySQL es relacional: datos en tablas con filas, columnas, relaciones, SQL. Redis es no relacional (NoSQL): datos en pares clave-valor en memoria RAM, sin esquema fijo, sin SQL."

### P: Por que combinar ambas?
> "MySQL garantiza persistencia y consistencia (los datos no se pierden). Redis da velocidad (microsegundos vs milisegundos). Al combinarlas, tenemos lo mejor de ambos mundos: datos seguros + respuestas rapidas."

### P: Cual es el beneficio real de Redis en autenticacion?
> "En un sistema con miles de usuarios haciendo login constantemente, cada login sin cache es una consulta a MySQL (red + disco). Con Redis, los usuarios frecuentes se autentican desde RAM sin tocar MySQL. Esto reduce la carga de la BD relacional y mejora los tiempos de respuesta."

### P: Es seguro guardar la contrasena en Redis?
> "Se guarda el HASH de la contrasena, no la contrasena en texto plano. El hash es irreversible. Ademas Redis corre localmente o en un servidor privado, no esta expuesto a internet."

### P: Que pasaria en produccion con muchos usuarios?
> "Redis maneja millones de operaciones por segundo. Para una tienda online tipica, un solo nodo de Redis es mas que suficiente. Si escalamos, Redis soporta clustering."

---

# TIPS PARA LA SUSTENTACION

1. **Mostrar los logs del servidor** durante la demo — es la evidencia visual mas clara del flujo Redis vs MySQL
2. **Usar Postman o Thunder Client** para la demo en vivo (mas visual que PowerShell)
3. **Todos deben entender el flujo completo** aunque cada uno explique su parte
4. **Si no saben una respuesta:** "Eso no lo implementamos en esta fase, pero se podria hacer de X manera"
5. **Preparar el entorno antes:** Redis corriendo, servidor arrancado, Postman listo con las peticiones guardadas

---

# COMANDOS PARA PREPARAR ANTES DE LA SUSTENTACION

```powershell
# 1. Iniciar Redis en WSL
wsl -d Ubuntu -- bash -c "redis-server --daemonize yes --bind 0.0.0.0 --protected-mode no"

# 2. Ir a la carpeta del proyecto
cd "C:\Users\camil\OneDrive\Escritorio\Tienda Online\auth-redis-postgres"

# 3. Arrancar el servidor
npm start

# 4. Verificar que todo conecta
# Abrir navegador: http://localhost:4000/health
```

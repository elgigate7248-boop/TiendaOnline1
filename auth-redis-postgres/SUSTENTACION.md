# Sustentacion - Primer Parcial
## Validacion de Autenticacion del Usuario desde FrontEnd combinando BD Relacional y No Relacional (Redis)

---

# TABLA DE LA RUBRICA vs LO QUE TENEMOS

| # | Criterio de la rubrica | Pts | Como se demuestra en nuestro proyecto | Paso de la demo |
|---|------------------------|-----|---------------------------------------|-----------------|
| 1 | Cada integrante participa | 0.3 | 3 personas, roles asignados abajo | Todo el video |
| 2 | Transaccion en BD relacional | 0.5 | POST /api/auth/registro → INSERT INTO usuario | Paso 4 |
| 3 | Activacion del servicio de Redis | 0.5 | Comando WSL + logs "Redis conectado" | Paso 1-2 |
| 4 | Borrado de TODAS las variables clave-valor en Redis | 0.5 | DELETE /api/auth/redis/flush | Paso 9 |
| 5 | Interfaz transaccionalidad BD relacional (o consola) | 0.5 | Postman + consola MySQL Aiven | Paso 4, 11 |
| 6 | Codigo de programacion consulta Redis | 0.5 | Mostrar user.repository.js - findInCache() | Paso 6 |
| 7 | Creacion de variables clave-valor | 0.5 | GET /api/auth/redis/keys muestra las claves | Paso 5 |
| 8 | Creacion de nuevos registros en BD relacional | 0.5 | POST /api/auth/registro → nuevo usuario en MySQL | Paso 4 |
| 9 | Mostrar autenticacion de usuario | 0.5 | POST /api/auth/login completo con logs | Paso 7-8 |
| 10 | Video maximo 20 min | 0.4 | Grabar con OBS o grabador de pantalla | - |
| 11 | Cargar en Classroom | 0.3 | Subir el video | - |
| | **TOTAL** | **5.0** | | |

---

# DISTRIBUCION DE ROLES (3 personas)

## PERSONA 1 — Arquitectura y Base de Datos (minutos 0:00 - 5:00)
- Explica la arquitectura general del proyecto
- Muestra MySQL en Aiven y la tabla usuario
- Explica por que se usan 2 bases de datos

## PERSONA 2 — Redis, Cache y Flujo (minutos 5:00 - 10:00)
- Explica que es Redis y como funciona como cache
- Muestra el flujo de login paso a paso
- Explica TTL, clave-valor, resiliencia
- Muestra el codigo de consulta a Redis

## PERSONA 3 — Demo en Vivo Paso a Paso (minutos 10:00 - 18:00)
- Ejecuta la demo completa en Postman
- Muestra cada endpoint funcionando
- Muestra los logs del servidor en tiempo real
- Muestra el codigo de bcrypt y JWT

---

# =====================================================================
# GUIA PASO A PASO PARA LA DEMO DEL VIDEO (18 minutos max)
# =====================================================================

---

## ANTES DE GRABAR — Preparar el entorno (no se graba)

Abrir 2 terminales de PowerShell:
- **Terminal 1:** Para el servidor (ver logs)
- **Terminal 2:** Para comandos auxiliares

Abrir Postman con las peticiones ya guardadas (ver seccion "Peticiones Postman").

---

## PASO 1: Activacion del servicio de Redis [RUBRICA: item 3] (min 0:30)
**Quien:** Persona 2

Ejecutar en Terminal 1:
```powershell
wsl -d Ubuntu -- bash -c "redis-server --daemonize yes --bind 0.0.0.0 --protected-mode no"
```

**Que decir:**
> "Primero activamos Redis. Redis es una base de datos NoSQL que almacena datos en memoria RAM como pares clave-valor. La iniciamos en WSL Ubuntu con el comando redis-server."

Verificar que Redis responde:
```powershell
wsl -d Ubuntu -- bash -c "redis-cli ping"
```
Debe responder: `PONG`

**Que decir:**
> "Redis responde PONG, lo que confirma que el servicio esta activo y escuchando conexiones."

---

## PASO 2: Arrancar el servidor de autenticacion (min 1:30)
**Quien:** Persona 3

Ejecutar en Terminal 1:
```powershell
cd "C:\Users\camil\OneDrive\Escritorio\Tienda Online\auth-redis-postgres"
npm start
```

**Resultado esperado en los logs:**
```
Verificando conexiones...
Redis conectado
MySQL (Aiven) conectado
Conexion a Redis verificada (PONG)
Servidor de autenticacion corriendo en http://localhost:4000
```

**Que decir:**
> "El servidor verifica la conexion a ambas bases de datos al arrancar. Vemos que MySQL en Aiven y Redis estan conectados correctamente."

---

## PASO 3: Health Check - Verificar conexiones [RUBRICA: items 3, 5] (min 2:30)
**Quien:** Persona 1

En Postman:
```
GET http://localhost:4000/health
```

**Respuesta esperada:**
```json
{
  "status": "OK",
  "mysql": "connected",
  "redis": "connected",
  "uptime": 15.23
}
```

**Que decir:**
> "Este endpoint de health check nos confirma que ambas bases de datos estan operativas. MySQL es nuestra base de datos relacional en Aiven y Redis es la no relacional usada como cache."

---

## PASO 4: Registrar un usuario nuevo [RUBRICA: items 2, 5, 8] (min 3:30)
**Quien:** Persona 1

En Postman:
```
POST http://localhost:4000/api/auth/registro
Content-Type: application/json

{
  "nombre": "Carlos Demo",
  "email": "carlos@demo.com",
  "password": "demo123456"
}
```

**Respuesta esperada (201):**
```json
{
  "success": true,
  "message": "Usuario registrado exitosamente",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "usuario": {
    "id": 138,
    "nombre": "Carlos Demo",
    "email": "carlos@demo.com",
    "rol": "CLIENTE",
    "created_at": "2026-03-24..."
  }
}
```

**Logs del servidor (mostrar la Terminal 1):**
```
Cache SET → carlos@demo.com  (TTL 3600s)
```

**Que decir:**
> "Al registrar un usuario, el sistema hace dos cosas: primero inserta el registro en MySQL con la contrasena hasheada usando bcrypt, y luego guarda una copia en Redis como cache con un TTL de 1 hora. Esto es lo que vemos en el log: 'Cache SET'."
>
> "La contrasena nunca se guarda en texto plano. Se usa bcrypt con 10 salt rounds para generar un hash irreversible."

**MOSTRAR EN CODIGO (abrir auth.service.js linea 91):**
```javascript
// 2. Hash de contrasena
const hashedPassword = await bcrypt.hash(datos.password, SALT_ROUNDS);

// 3. Insertar en MySQL
const nuevoUsuario = await userRepo.createInDatabase({...});

// 4. Cachear en Redis
await userRepo.saveToCache({...});
```

---

## PASO 5: Ver las variables clave-valor en Redis [RUBRICA: item 7] (min 5:30)
**Quien:** Persona 2

En Postman:
```
GET http://localhost:4000/api/auth/redis/keys
```

**Respuesta esperada:**
```json
{
  "success": true,
  "total_claves": 1,
  "claves": {
    "user:carlos@demo.com": {
      "valor": {
        "id": 138,
        "nombre": "Carlos Demo",
        "email": "carlos@demo.com",
        "rol": "CLIENTE",
        "password": "$2b$10$...(hash)...",
        "created_at": "2026-03-24..."
      },
      "ttl_segundos": 3542
    }
  }
}
```

**Que decir:**
> "Aqui vemos la variable clave-valor almacenada en Redis. La clave es 'user:carlos@demo.com' y el valor es un JSON con todos los datos del usuario, incluyendo el hash de la contrasena. El TTL muestra que quedan 3542 segundos antes de que se elimine automaticamente."
>
> "Redis almacena los datos como strings. Nosotros serializamos el objeto a JSON con JSON.stringify() al guardar, y lo parseamos con JSON.parse() al leer."

---

## PASO 6: Mostrar el codigo de consulta a Redis [RUBRICA: item 6] (min 7:00)
**Quien:** Persona 2

**Abrir el archivo `repositories/user.repository.js` y mostrar:**

```javascript
// Funcion que busca en Redis
async function findInCache(email) {
  try {
    const data = await redis.get('user:' + email);  // Consulta Redis
    if (!data) return null;                          // No esta en cache
    console.log('Cache HIT');
    return JSON.parse(data);                         // Retorna el usuario
  } catch (err) {
    // Si Redis falla, retorna null y sigue con MySQL
    return null;
  }
}

// Funcion que guarda en Redis con TTL
async function saveToCache(user) {
  const key = 'user:' + user.email;
  await redis.set(key, JSON.stringify(user), 'EX', 3600);  // TTL 1 hora
}

// Flujo completo: Redis primero, luego MySQL
async function findByEmail(email) {
  const cached = await findInCache(email);     // 1. Buscar en Redis
  if (cached) return cached;                   // Si esta, retornar

  const dbUser = await findInDatabase(email);  // 2. Si no, ir a MySQL
  if (!dbUser) return null;

  await saveToCache(dbUser);                   // 3. Cachear para la proxima
  return dbUser;
}
```

**Que decir:**
> "Este es el corazon del sistema de cache. La funcion findByEmail primero consulta Redis. Si el usuario esta en cache (Cache HIT), lo retorna sin tocar MySQL. Si no esta (Cache MISS), consulta MySQL, y si lo encuentra, lo guarda en Redis para las proximas consultas."
>
> "Cada operacion de Redis esta dentro de un try-catch. Si Redis se cae, el sistema sigue funcionando consultando MySQL directamente. Esto es lo que llamamos resiliencia."

---

## PASO 7: Login - Primera vez desde cache [RUBRICA: item 9] (min 9:00)
**Quien:** Persona 3

En Postman:
```
POST http://localhost:4000/api/auth/login
Content-Type: application/json

{
  "email": "carlos@demo.com",
  "password": "demo123456"
}
```

**Respuesta esperada (200):**
```json
{
  "success": true,
  "message": "Inicio de sesion exitoso",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "usuario": {
    "id": 138,
    "nombre": "Carlos Demo",
    "email": "carlos@demo.com",
    "rol": "CLIENTE"
  }
}
```

**Logs del servidor:**
```
Cache HIT → carlos@demo.com
```

**Que decir:**
> "El login fue exitoso y en los logs vemos 'Cache HIT'. Esto significa que el usuario se encontro directamente en Redis, sin necesidad de consultar MySQL. La autenticacion fue casi instantanea porque Redis responde en microsegundos."

**GUARDAR EL TOKEN** (copiarlo, lo necesitan para el paso 8 y 10).

---

## PASO 8: Ver perfil con JWT [RUBRICA: item 9] (min 10:30)
**Quien:** Persona 3

En Postman:
```
GET http://localhost:4000/api/auth/perfil
Headers:
  Authorization: Bearer <pegar_el_token_del_paso_7>
```

**Respuesta esperada:**
```json
{
  "success": true,
  "usuario": {
    "id": 138,
    "email": "carlos@demo.com",
    "nombre": "Carlos Demo",
    "rol": "CLIENTE"
  }
}
```

**Que decir:**
> "El endpoint de perfil esta protegido por JWT. El middleware verifica que el token sea valido y no haya expirado. Si no se envia el token, retorna error 401."

---

## PASO 9: Borrar TODAS las variables de Redis [RUBRICA: item 4] (min 11:30)
**Quien:** Persona 2

Primero mostrar que hay claves:
```
GET http://localhost:4000/api/auth/redis/keys
→ total_claves: 1
```

Ahora borrar todas:
```
DELETE http://localhost:4000/api/auth/redis/flush
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Se eliminaron todas las variables clave-valor de Redis",
  "eliminadas": 1,
  "claves_borradas": ["user:carlos@demo.com"]
}
```

Verificar que quedo vacio:
```
GET http://localhost:4000/api/auth/redis/keys
→ total_claves: 0
```

**Que decir:**
> "Ejecutamos el flush que elimina TODAS las variables clave-valor de Redis. Podemos ver que se elimino 1 clave y al consultar de nuevo vemos que Redis quedo vacio, con 0 claves."

---

## PASO 10: Login despues del flush - Va a MySQL [RUBRICA: items 2, 9] (min 13:00)
**Quien:** Persona 3

En Postman (mismo login):
```
POST http://localhost:4000/api/auth/login
Content-Type: application/json

{
  "email": "carlos@demo.com",
  "password": "demo123456"
}
```

**Logs del servidor (MOSTRAR TERMINAL 1):**
```
DB HIT → carlos@demo.com
Cache SET → carlos@demo.com  (TTL 3600s)
```

**Que decir:**
> "ESTE ES EL PUNTO CLAVE. Ahora que borramos Redis, el login tuvo que ir a MySQL. En los logs vemos 'DB HIT' en lugar de 'Cache HIT'. Y automaticamente volvio a cachear el usuario en Redis con 'Cache SET'. Si hacemos login otra vez, sera Cache HIT de nuevo."

Hacer login una vez mas para demostrar:
```
POST http://localhost:4000/api/auth/login (mismo body)
→ LOG: Cache HIT → carlos@demo.com
```

**Que decir:**
> "Efectivamente, el segundo login ya es Cache HIT. El sistema se auto-recupera: cuando Redis esta vacio, va a MySQL, obtiene los datos, los cachea, y las siguientes consultas son rapidas desde Redis."

---

## PASO 11: Mostrar registro en MySQL (consola BD) [RUBRICA: item 5] (min 15:00)
**Quien:** Persona 1

Abrir la consola de Aiven MySQL (desde el panel web de Aiven o desde terminal):
```sql
SELECT id_usuario, nombre, email, contrasena, fecha_registro
FROM usuario
WHERE email = 'carlos@demo.com';
```

**Resultado esperado:**
```
id_usuario | nombre      | email             | contrasena                       | fecha_registro
138        | Carlos Demo | carlos@demo.com   | $2b$10$TUmIxT2mU6R1Eh/BHwm...   | 2026-03-24 ...
```

**Que decir:**
> "Aqui vemos el registro directamente en MySQL. La contrasena esta almacenada como hash bcrypt — es imposible obtener la contrasena original desde este hash. Este es el registro permanente en la base de datos relacional."

*Alternativa si no quieren abrir Aiven: usar el endpoint de registro y mostrar que el id se auto-incrementa, demostrando que MySQL lo creo.*

---

## PASO 12: Manejo de errores [RUBRICA: item 9] (min 16:00)
**Quien:** Persona 3

**Error 1 - Contrasena incorrecta:**
```
POST http://localhost:4000/api/auth/login
Body: { "email": "carlos@demo.com", "password": "claveMAL" }
→ 401: { "success": false, "error": "Contrasena incorrecta" }
```

**Error 2 - Usuario no existe:**
```
POST http://localhost:4000/api/auth/login
Body: { "email": "noexiste@x.com", "password": "abc123" }
→ 404: { "success": false, "error": "Usuario no encontrado" }
```

**Error 3 - Campos vacios:**
```
POST http://localhost:4000/api/auth/login
Body: { "email": "carlos@demo.com" }
→ 400: { "success": false, "error": "Email y contrasena son obligatorios" }
```

**Que decir:**
> "El sistema maneja distintos tipos de errores con codigos HTTP apropiados: 400 para datos faltantes, 401 para contrasena incorrecta, 404 para usuario no encontrado. Nunca se expone informacion sensible en los mensajes de error."

---

## PASO 13: Logout e invalidacion de cache [RUBRICA: item 4] (min 17:00)
**Quien:** Persona 2

```
POST http://localhost:4000/api/auth/logout
Headers:
  Authorization: Bearer <token_del_paso_7_o_10>
```

**Respuesta:**
```json
{ "success": true, "message": "Sesion cerrada correctamente" }
```

Verificar que se elimino de Redis:
```
GET http://localhost:4000/api/auth/redis/keys
→ total_claves: 0
```

**Que decir:**
> "El logout invalida la cache del usuario en Redis. Esto es importante por seguridad: si el usuario cierra sesion, sus datos se eliminan de la cache inmediatamente."

---

## CIERRE (min 17:30)
**Quien:** Persona 1

> "En resumen, implementamos un sistema de autenticacion que combina MySQL como base de datos relacional para almacenamiento permanente y Redis como base de datos no relacional para cache de alta velocidad. El flujo es: el usuario se autentica, el sistema busca primero en Redis (rapido), si no esta va a MySQL (seguro), y cachea el resultado. Esto mejora el rendimiento sin sacrificar la seguridad ni la persistencia de los datos."

---

# =====================================================================
# PETICIONES PARA POSTMAN (crear antes de grabar)
# =====================================================================

Crear una coleccion en Postman llamada "Auth Redis - Parcial" con estas peticiones:

| # | Metodo | URL | Body | Headers |
|---|--------|-----|------|---------|
| 1 | GET | http://localhost:4000/health | - | - |
| 2 | POST | http://localhost:4000/api/auth/registro | `{"nombre":"Carlos Demo","email":"carlos@demo.com","password":"demo123456"}` | Content-Type: application/json |
| 3 | GET | http://localhost:4000/api/auth/redis/keys | - | - |
| 4 | POST | http://localhost:4000/api/auth/login | `{"email":"carlos@demo.com","password":"demo123456"}` | Content-Type: application/json |
| 5 | GET | http://localhost:4000/api/auth/perfil | - | Authorization: Bearer {token} |
| 6 | DELETE | http://localhost:4000/api/auth/redis/flush | - | - |
| 7 | POST | http://localhost:4000/api/auth/logout | - | Authorization: Bearer {token} |
| 8 | POST | http://localhost:4000/api/auth/login | `{"email":"carlos@demo.com","password":"claveMAL"}` | Content-Type: application/json |
| 9 | POST | http://localhost:4000/api/auth/login | `{"email":"noexiste@x.com","password":"abc123"}` | Content-Type: application/json |

---

# =====================================================================
# GUION DETALLADO POR PERSONA (que decir en cada momento)
# =====================================================================

## PERSONA 1: Arquitectura y Base de Datos

### Introduccion (decir al inicio)
> "Buenas, somos el equipo X. Desarrollamos un sistema de autenticacion de usuarios que combina dos tipos de bases de datos: MySQL como base de datos relacional para almacenamiento permanente, y Redis como base de datos no relacional para cache de alta velocidad."

### Arquitectura (mostrar diagrama)
```
  Frontend (Postman)
       │
       ▼
  Controlador ── Valida datos de entrada
       │
       ▼
  Servicio ── Logica: bcrypt (hash), JWT (token)
       │
       ▼
  Repositorio ── Accede a los datos
       │
  ┌────┴────┐
  │         │
Redis     MySQL
(cache)   (Aiven)
```

> "Usamos arquitectura por capas. El controlador recibe la peticion HTTP y valida los datos. El servicio contiene la logica de negocio como el hashing de contrasenas y la generacion de tokens. El repositorio accede a los datos consultando primero Redis y luego MySQL."

### MySQL / Aiven
> "MySQL es nuestra base de datos relacional, alojada en Aiven que es un servicio de base de datos en la nube. La conexion usa SSL para seguridad. La tabla principal es 'usuario' con campos: id_usuario, nombre, email, contrasena y fecha_registro."

> "La contrasena se almacena como hash bcrypt, nunca en texto plano. MySQL es la fuente de verdad: todos los datos reales y permanentes estan ahi."

### Pool de conexiones
> "Usamos un pool de hasta 10 conexiones simultaneas a MySQL. Esto significa que no abrimos y cerramos una conexion por cada consulta, sino que reutilizamos conexiones existentes, lo que mejora el rendimiento."

---

## PERSONA 2: Redis y Flujo de Cache

### Que es Redis
> "Redis es una base de datos NoSQL de tipo clave-valor que almacena datos en memoria RAM. Es extremadamente rapido, con tiempos de respuesta en microsegundos, mientras que MySQL responde en milisegundos porque lee de disco."

### Como almacena los datos
> "Redis guarda pares clave-valor. En nuestro caso:
> - La clave es: user:email@ejemplo.com
> - El valor es: un JSON con todos los datos del usuario
> Cada entrada tiene un TTL de 3600 segundos (1 hora), despues de ese tiempo Redis la elimina automaticamente."

### Flujo de login
> "Cuando un usuario hace login, el sistema sigue este flujo:
> 1. Busca primero en Redis (cache). Si lo encuentra, es un Cache HIT y responde inmediatamente.
> 2. Si no esta en Redis (Cache MISS), consulta MySQL.
> 3. Si lo encuentra en MySQL, lo cachea en Redis para las proximas consultas.
> 4. Valida la contrasena con bcrypt.compare().
> 5. Si es correcta, genera un JWT y lo retorna al frontend."

### Resiliencia
> "Si Redis se cae o no esta disponible, el sistema sigue funcionando. Cada llamada a Redis esta dentro de un try-catch que atrapa el error y continua consultando MySQL directamente. El usuario nunca nota la diferencia, solo hay un poco mas de latencia."

---

## PERSONA 3: Codigo y Demo

### Stack tecnologico (mencionar rapido)
> "Usamos Node.js con Express para el servidor, mysql2 para conectar a MySQL, ioredis para Redis, bcrypt para hashing de contrasenas y jsonwebtoken para los tokens JWT."

### Seguridad - bcrypt
> "bcrypt genera un hash irreversible de la contrasena con 10 salt rounds. Esto significa que incluso si dos usuarios tienen la misma contrasena, sus hashes seran diferentes. Es computacionalmente costoso a proposito para prevenir ataques de fuerza bruta."

### Seguridad - JWT
> "JWT es un token firmado digitalmente que contiene los datos del usuario. Se genera al hacer login y el frontend lo envia en cada peticion protegida en el header Authorization. El token expira en 24 horas."

### Demo
(Seguir los pasos 1-13 de arriba)

---

# =====================================================================
# PREGUNTAS FRECUENTES DEL DOCENTE
# =====================================================================

### P: Cual es la diferencia entre una BD relacional y una no relacional?
> "MySQL es relacional: organiza datos en tablas con filas y columnas, usa SQL, tiene esquema fijo y relaciones entre tablas. Redis es no relacional (NoSQL): almacena datos como pares clave-valor en memoria RAM, no tiene esquema fijo, no usa SQL, y es mucho mas rapido pero no garantiza persistencia por defecto."

### P: Por que combinar MySQL y Redis?
> "MySQL garantiza que los datos no se pierdan (persistencia) y mantiene la integridad (relaciones). Redis aporta velocidad extrema al servir datos desde RAM. Al combinarlos, tenemos datos seguros Y respuestas rapidas. Es un patron muy usado en produccion llamado 'cache-aside'."

### P: Que es el patron cache-aside?
> "Es el patron que implementamos: primero se consulta la cache (Redis). Si el dato esta, se retorna directamente. Si no, se consulta la base de datos principal (MySQL), se cachea el resultado, y se retorna. Asi las siguientes consultas son rapidas."

### P: Por que no usaron solo MySQL?
> "Porque cada login seria una consulta de red a Aiven (base de datos remota en la nube). Con Redis localmente, las consultas repetidas se resuelven en microsegundos desde RAM sin salir de la maquina. Esto reduce la carga sobre MySQL y mejora los tiempos de respuesta."

### P: Que pasa si Redis se cae?
> "El sistema sigue funcionando. Todas las operaciones de Redis estan envueltas en try-catch. Si Redis falla, retorna null y el sistema consulta MySQL directamente. Es transparente para el usuario."

### P: Es seguro guardar la contrasena en Redis?
> "Se guarda el HASH bcrypt, no la contrasena en texto plano. El hash es irreversible: no se puede obtener la contrasena original. Ademas Redis corre localmente, no esta expuesto a internet."

### P: Que es JWT?
> "JSON Web Token. Es un token firmado digitalmente que contiene datos del usuario (id, email, rol). El servidor lo genera al hacer login exitoso. El frontend lo envia en cada peticion protegida. El servidor puede verificar que es autentico sin consultar ninguna base de datos, lo que lo hace stateless."

### P: Que es bcrypt?
> "Es un algoritmo de hashing disenado especificamente para contrasenas. Usa salt rounds (10 en nuestro caso) para que cada hash sea unico. Es lento a proposito: tarda ~100ms en generar un hash, lo que hace impracticable un ataque de fuerza bruta."

### P: Que es un TTL?
> "Time To Live. Es el tiempo de vida de una clave en Redis. Configuramos 3600 segundos (1 hora). Despues de ese tiempo, Redis elimina automaticamente la clave. Esto evita que la cache tenga datos desactualizados indefinidamente."

### P: Que pasa si cambian datos en MySQL pero Redis tiene la version vieja?
> "Tres mecanismos: 1) El logout elimina la cache del usuario. 2) El TTL de 1 hora garantiza que la cache se renueva periodicamente. 3) Se podria implementar invalidacion activa al modificar datos."

### P: Donde corre Redis en produccion?
> "En produccion se usaria un servicio gestionado como Redis Cloud, AWS ElastiCache o Azure Cache for Redis. En desarrollo lo corremos localmente en WSL (Windows Subsystem for Linux)."

### P: Que tipo de base de datos es Redis?
> "Es una base de datos NoSQL de tipo clave-valor (key-value store). Los datos se almacenan en memoria RAM, lo que la hace extremadamente rapida. Soporta strings, hashes, listas, sets y sorted sets."

### P: Que es un Pool de conexiones?
> "Es un conjunto de conexiones pre-creadas a la base de datos que se reutilizan entre consultas. En lugar de abrir y cerrar una conexion por cada query, el pool mantiene varias abiertas y las asigna segun se necesiten. Nuestro pool tiene maximo 10 conexiones simultaneas."

### P: Por que arquitectura por capas?
> "Cada capa tiene una unica responsabilidad (principio SOLID). El controlador solo maneja HTTP, el servicio solo contiene logica de negocio, el repositorio solo accede a datos. Esto hace el codigo mas mantenible, testeable y facil de entender."

---

# =====================================================================
# COMANDOS RAPIDOS DE EMERGENCIA
# =====================================================================

Si algo falla durante la demo:

```powershell
# Redis no conecta? Reiniciar:
wsl -d Ubuntu -- bash -c "redis-cli shutdown 2>/dev/null; redis-server --daemonize yes --bind 0.0.0.0 --protected-mode no"

# Verificar IP de WSL (si cambio):
wsl -d Ubuntu -- bash -c "hostname -I"
# Actualizar REDIS_HOST en el archivo .env con la nueva IP

# Puerto 4000 ocupado? Matar proceso:
Stop-Process -Id (Get-NetTCPConnection -LocalPort 4000).OwningProcess -Force
# Luego arrancar de nuevo:
npm start

# El usuario de demo ya existe? Usar otro email:
# Cambiar "carlos@demo.com" por "carlos2@demo.com" en las peticiones

# MySQL no conecta? Verificar .env tiene las credenciales correctas de Aiven
```

---

# =====================================================================
# CHECKLIST FINAL ANTES DE GRABAR
# =====================================================================

- [ ] Redis instalado en WSL y funcionando (redis-cli ping → PONG)
- [ ] IP de WSL correcta en .env (REDIS_HOST)
- [ ] npm install ejecutado en auth-redis-postgres/
- [ ] Servidor arranca sin errores (npm start)
- [ ] Health check retorna OK (http://localhost:4000/health)
- [ ] Peticiones guardadas en Postman (9 peticiones)
- [ ] Borrar usuario de demo anterior si existe (o usar email nuevo)
- [ ] Grabador de pantalla listo (OBS, grabador de Windows, etc.)
- [ ] Terminal visible junto a Postman para mostrar los logs
- [ ] Los 3 integrantes saben su parte y las preguntas frecuentes

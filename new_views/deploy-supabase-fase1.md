# Paso a producción: nuevas vistas + Supabase fase 1 (un solo deploy)

`feature/nuevas-vistas` trae las vistas nuevas, la seguridad de usuarios (sección 22) y la migración de los retiros a Supabase. Todo sale junto: el código, las reglas de Firestore y la copia de datos se coordinan en el corte.

**Regla de oro:** `firestore.rules` se publica DESPUÉS del merge. Bloquea escribir retiros en Firestore y solo deja al servidor crear usuarios; la app que hoy está en producción hace las dos cosas desde el navegador.

## Antes del corte (cualquier día)
1. **Variables en Vercel** (Settings → Environment Variables), para **Production y Preview**:
   - `DATABASE_URL`: transaction pooler, puerto 6543, la misma de `.env.local`.
   - `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`: Admin SDK; ahora todas las rutas `/api/*` validan la sesión con ellas.
   - `DIRECT_URL` no va en Vercel: solo la usan los scripts desde tu PC.
2. **Subir la rama y probar el Preview completo:** inicio de sesión, dashboard, monitor, reportes (incluida una carga por Excel), auditoría, evaluación, cierre, expediente y gestión de usuarios. Lo que hagas en el Preview escribe en Supabase de verdad; se reemplaza en el corte, así que no cuentes con esos datos.
3. **Preparar las reglas sin publicarlas** (Firebase Console → Firestore → Reglas):
   - Guardar una copia de las reglas actuales en un archivo (por ejemplo `firestore.rules.anterior`): es el respaldo para volver atrás.
   - Revisar la colección `usuarios`: cada admin con `rol` exactamente `admin`, nadie que deba entrar con `activo: false`, y el id de cada documento igual a su UID.
   - Probar `firestore.rules` en Rules Playground (ver el checklist del artifact).
4. `vercel.json` fija las funciones en Oregón (`pdx1`), junto a Supabase. Toma efecto con el merge.

## El corte (fuera de horario, ~20 minutos)
1. Avisar que nadie cargue reportes, exonere ni cree usuarios durante el corte.
2. `npm run db:copiar -- --confirmo-vaciar` → copia fresca de Firestore (vacía las tablas y copia todo; ~2 minutos). Sin la bandera, el script se niega a correr.
3. `npm run db:verificar` → debe terminar con "Todo coincide."
4. Hacer merge a `main` y esperar a que Vercel termine el deploy de producción.
5. Publicar `firestore.rules` de la rama en Firebase Console y esperar ~1 minuto.
6. Pedir a todos que **recarguen la app** (F5) para tomar la versión nueva.
7. Probar en producción: cargar un día por API, exonerar un retiro, guardar la nota del día, abrir dashboard y monitor, abrir Gestión de usuarios.

## Si algo sale mal
- Vercel → Deployments → el deploy anterior → **Instant Rollback**, y volver a publicar las reglas guardadas en el paso 3 de "Antes". La app vuelve a leer y escribir Firestore, que quedó intacto.
- Lo que se haya cargado o exonerado en Postgres después del corte no estará en Firestore: anotarlo y repetirlo a mano.

## Después
- **No volver a correr `db:copiar`.** Desde el corte, Postgres es la fuente de verdad: vaciarlo borraría todo lo cargado y exonerado desde entonces.
- Política de contraseñas en Authentication y prueba completa con un usuario de prueba (pasos 2 y 3 del checklist).
- Firestore conserva las tres colecciones de retiros como respaldo de solo lectura. No se borran en esta fase.
- Fase 2: evaluaciones, cierres, configuración y enlaces.

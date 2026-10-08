# Paso a producción: Supabase fase 1 (retiros)

Requisito: `feature/nuevas-vistas` ya está en `main` y en producción, con sus reglas de Firestore publicadas (paso 1 del checklist de la sección 22).

## Antes (cualquier día)
1. Vercel → Settings → Environment Variables: agregar `DATABASE_URL` (transaction pooler, puerto 6543, la misma de `.env.local`) para **Production y Preview**. `DIRECT_URL` no hace falta en Vercel: solo la usan los scripts desde tu PC.
2. Abrir un PR de `feature/supabase` a `main` y probar el Preview completo: dashboard, monitor, reportes (incluida una carga por Excel), auditoría, evaluación y expediente.
3. Este PR trae `vercel.json` con `"regions": ["pdx1"]`: desde el merge, las funciones corren en Oregón, junto a Supabase.

## El corte (fuera de horario, ~15 minutos)
1. Avisar que nadie cargue reportes ni exonere durante el corte.
2. **Bloquear escrituras en Firestore:** Firebase Console → Firestore → Reglas. Guardar una copia de las reglas actuales (para volver atrás), pegar `firestore.rules` de esta rama y Publicar. Desde aquí `operaciones_retiros`, `historial_reportes` y `observaciones_diarias` son de solo lectura: una pestaña con la versión vieja de la app falla en vez de guardar donde ya nadie lee.
3. `npm run db:copiar -- --confirmo-vaciar` → copia fresca de Firestore (vacía las tablas y copia todo; ~2 minutos). Sin la bandera, el script se niega a correr.
4. `npm run db:verificar` → debe terminar con "Todo coincide."
5. Hacer merge del PR. Vercel despliega.
6. Pedir a todos que **recarguen la app** (F5) para tomar la versión nueva.
7. Probar en producción: cargar un día por API, exonerar un retiro, abrir dashboard y monitor.

## Si algo sale mal
- Vercel → Deployments → el deploy anterior → **Instant Rollback**, y volver a publicar las reglas guardadas en el paso 2. La app vuelve a leer y escribir Firestore, que quedó intacto.
- Lo que se haya cargado o exonerado en Postgres después del corte no estará en Firestore: anotarlo y repetirlo a mano.

## Después
- **No volver a correr `db:copiar`.** Desde el corte, Postgres es la fuente de verdad: vaciarlo borraría todo lo cargado y exonerado desde entonces.
- Firestore conserva las tres colecciones como respaldo de solo lectura. No se borran en esta fase.
- Fase 2: evaluaciones, cierres, configuración y enlaces.

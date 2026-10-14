# Horarios de turnos de retiros internacionales — diseño

Fecha: 2026-10-14 · Rama: `feature/horarios`

## Objetivo

Reemplazar el Excel `Horario 2026.xlsx` con el que se arma a mano, mes a mes, el horario de los 6 colaboradores que procesan retiros internacionales. El sistema genera el mes a partir de la regla de rotación y de las ausencias cargadas, permite ajustar casillas a mano y publica el horario en un enlace anual de solo lectura.

## Lo que pidió el usuario

- 6 colaboradores (los mismos operadores de la evaluación): Rafael Benitez, Angel Aleman, Juan Salcedo, Shirley Pérez, Angel Gomez, Gabriel Amariscua.
- 2 turnos diarios: **mañana 08:00–15:00** y **tarde 15:00–22:00**. Siempre 2 personas por turno: una en **PEN/USD/MXN** y otra en **CLP**.
- Se trabaja igual todos los días (fines de semana y feriados incluidos).
- Rotación con 6 personas: mañana A(PEN)·B(CLP), tarde C·D, día 2 mañana E·F, tarde A·B, día 3 mañana C·D, tarde E·F; desde el día 4 se invierten los puestos (B en PEN, A en CLP) para que todos pasen por todas las monedas.
- Rotación con 5 (alguien ausente): A·B mañana, C·D tarde, día 2 E·A mañana, B·C tarde, día 3 D·E mañana… y se repite.
- Ausencias: vacaciones, médicas u otras; se pueden cargar, editar y eliminar. El horario se genera en base a ellas.
- Ausencias de personas fuera de la rotación (p. ej. Franklin Sánchez) se anotan solo como información.
- Si se cruzan 2 ausencias (quedan 4 personas): hoy no ocurre. El sistema no genera esos días y avisa; la regla se definirá a futuro.
- Las transiciones (alguien sale o vuelve) las arma el sistema y el administrador puede editar cualquier casilla.
- Entrega: **un enlace por año**, en el que se cambia de mes. Solo se ven los meses desde el inicio (octubre 2026) hasta el mes en curso; nunca meses futuros. Hoy: solo octubre; desde el 1/11: octubre y noviembre.

## Lo verificado en el Excel (ago–nov 2026)

- La regla de 6 equivale a parejas fijas (sep: Gabriel/Rafael, Angel A./Angel G., Juan/Shirley) que entran cada 3 turnos; los puestos se invierten cada 3 días.
- La regla de 5 equivale a un orden circular de 5 personas tomadas de a dos; cada persona hace el mismo turno dos días seguidos, primero PEN y luego CLP.
- Nadie trabaja dos turnos seguidos (tarde y mañana siguiente, ni mañana y tarde del mismo día).
- La fecha de "Retorno" es el primer día que la persona vuelve a trabajar (Juan: 14/09–09/10, aparece el 09/10).
- Cada mes continúa la rotación del anterior; no se reinicia.

## Enfoque elegido

Generar y **guardar** el horario día por día en Postgres (Supabase). Descartados: calcularlo al vuelo (se perderían las ediciones manuales y los meses pasados cambiarían al editar una ausencia) y un motor de reglas configurable (YAGNI; una regla nueva se agrega en código).

## Datos (Postgres, migración `db/migraciones/002_horarios.sql`)

- `ausencias`: `id`, `colaborador` (usuario, p. ej. `rafael.benitez`), `tipo` (`vacaciones` | `medica` | `otra`), `inicio` (date), `retorno` (date, primer día de vuelta, exclusivo), `nota`, `creado_el`, `creado_por`. Restricción `retorno > inicio`.
- `horario_turnos`: PK (`fecha`, `turno` [`manana`|`tarde`], `puesto` [`pen_usd_mxn`|`clp`]), `colaborador`, `editado_manual` (bool).
- `horario_meses`: `mes` (`YYYY-MM`, PK), `generado_el`, `generado_por`. Marca qué meses existen.
- `horario_enlaces`: `id` (aleatorio, 6–64 caracteres `[A-Za-z0-9_-]`), `anio`, `activo`, `creado_el`, `creado_por`. Un enlace activo por año.

Los colaboradores de la rotación y sus nombres cortos ("Rafael B.") viven en una constante en `lib/horario.ts`; una ausencia de alguien fuera de esa lista es informativa y no afecta la rotación.

El navegador no habla con Postgres: todo pasa por `/api/horarios/*` con `requireUser` y rol administrador, igual que la fase 1.

## Generador (`lib/horario.ts`, función pura)

Entrada: los últimos días ya guardados (estado de la rotación), las ausencias y el rango a generar. Salida: las filas de `horario_turnos`.

- Los colaboradores disponibles forman un **orden circular**; cada turno (mañana, tarde, mañana del día siguiente…) toma a los **2 siguientes**: el primero en PEN/USD/MXN y el segundo en CLP.
- Con 6 (par), eso produce las parejas fijas; los puestos se invierten cada 2 vueltas (cada 3 días). Con 5 (impar), los puestos se alternan solos.
- El estado (orden, posición y fase de inversión) se reconstruye a partir de los últimos días guardados, de modo que cada mes continúa al anterior.
- Al **salir** alguien, se quita del orden y se continúa desde la posición actual.
- Al **volver**, se inserta en la posición del orden en la que nadie quede con dos turnos consecutivos; entre las válidas, la que mejor reparte la carga.
- Si un día quedan menos de 5 disponibles, no se generan esos días y se devuelve un aviso con las fechas.

## Regenerar por cambios en ausencias

Si se crea, edita o elimina una ausencia que toca un mes ya generado, se regenera desde la primera fecha afectada (nunca antes de hoy) hasta el último día generado. Antes se muestra cuántas casillas editadas a mano hay en ese tramo y se pide confirmación, porque se perderán.

## Pantallas

### Administración `/horarios` (en el menú lateral, solo admin)

- **Horario**: calendario mensual con el formato del Excel (semanas lunes–domingo; cada día con Mañana PEN/USD/MXN, Mañana CLP, Tarde PEN/USD/MXN, Tarde CLP). Selector de mes. Botón **Generar mes**, habilitado si el mes anterior existe y el mes aún no. Clic en una casilla para cambiar al colaborador; las casillas editadas quedan marcadas. Si el cambio deja a alguien con dos turnos seguidos o en un día ausente, se muestra un aviso (no se bloquea). Al pie: horario de cada turno y ausencias del mes.
- **Ausencias**: tabla con alta, edición y baja (colaborador, tipo, inicio, retorno, nota), con la confirmación de regeneración descrita arriba.
- **Enlace**: **Copiar enlace 2026** (se crea la primera vez y luego es siempre el mismo) y **Reemplazar enlace** (desactiva el anterior).

### Enlace público `/horario/[id]` (sin login, solo lectura)

- API `/api/horario-publico/[id]?mes=YYYY-MM`. Valida el id y que el enlace esté activo.
- Meses visibles: desde `2026-10` (y desde enero para años siguientes) hasta el mes en curso, dentro del año del enlace. El servidor rechaza cualquier mes fuera de ese rango; la página solo ofrece esos meses en el selector.
- El mes en curso se calcula con la zona horaria `America/Santiago` (constante única en `lib/horario.ts`).
- Muestra el calendario, el horario de cada turno y las ausencias del mes. Nada de evaluaciones ni retiros.
- Enlace inválido o reemplazado: "Enlace no válido".

## Punto de partida

Script `scripts/importar-horario-excel.mts` (una sola vez): importa octubre 2026 de `Horario 2026.xlsx` a `horario_turnos` y marca `2026-10` en `horario_meses`; importa la hoja "Vacaciones" a `ausencias` (incluye la de Gabriel 13/10–02/11 y las futuras de Rafael y Shirley, y la de Franklin como informativa). Noviembre se genera desde el sistema.

## Pruebas (vitest)

- Generador con 6: reproduce los primeros días de septiembre 2026 del Excel partiendo del estado del 31/08.
- Generador con 5: reproduce el tramo de agosto (Shirley ausente) y el del 14/09 (sale Juan).
- Ninguna salida tiene a alguien en dos turnos consecutivos ni en un día ausente.
- Con 4 disponibles, devuelve aviso y no genera esos días.
- Visibilidad del enlace: hoy (14/10) solo octubre; el 01/11 octubre y noviembre; un mes futuro se rechaza.

## Fuera de alcance

- Regla para 4 personas.
- Exportar a imagen, PDF o Excel.
- Que los agentes vean el horario dentro de la app con sesión.
- Gestionar la lista de colaboradores desde la UI.

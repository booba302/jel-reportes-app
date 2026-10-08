# Deploy §22: Gestión de usuarios y seguridad

Pasos manuales para el deploy de la sección 22. Hazlos **en este orden** y marca cada casilla al terminarla.

> **Por qué importa el orden:** las reglas nuevas solo dejan crear o cambiar usuarios desde el servidor. Si se publican antes que el código, la gestión de usuarios de producción deja de funcionar.

---

## Paso 0: desplegar el código

- [ ] Desplegar la rama `feature/nuevas-vistas` (incluye las rutas `/api/usuarios/*`, `AuthContext` nuevo y el token en todas las llamadas a `/api/*`).
- [ ] Comprobar que la app de producción carga y que se puede iniciar sesión.
- [ ] Confirmar que en producción están las variables del Admin SDK: `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` y `NEXT_PUBLIC_FIREBASE_PROJECT_ID`. Ya las usaban las rutas anteriores; ahora además validan el token de sesión, así que sin ellas toda la API falla.

---

## Paso 1: publicar `firestore.rules`

### 1a. Respaldo

- [ ] En [console.firebase.google.com](https://console.firebase.google.com), abrir el proyecto → **Firestore Database → pestaña Reglas**.
- [ ] Copiar las reglas actuales y guardarlas en un archivo (p. ej. `firestore.rules.anterior`).

> **Para volver atrás:** pegar el respaldo en el editor de Reglas y pulsar Publicar.

### 1b. Revisar los perfiles de usuario

En **Firestore Database → Datos → colección `usuarios`**, revisar cada documento. Si tu propio admin no cumple, te quedas fuera:

- [ ] Cada admin tiene `rol` **exactamente** `admin` (no `Administrador` ni `Admin`).
- [ ] Nadie que deba entrar tiene `activo: false`. Si un perfil no tiene el campo, cuenta como activo.
- [ ] El ID de cada documento es el **UID** de esa persona (comparar con **Authentication → Users**).

### 1c. Probar en el simulador (sin publicar)

- [ ] En **Reglas**, reemplazar el contenido por el archivo `firestore.rules` del repositorio. **No publicar todavía.**
- [ ] Abrir **Rules Playground**, activar "Authenticated" con un UID real y hacer estas pruebas:

| ✓ | Prueba | Tipo | Ruta | UID | Esperado |
|---|---|---|---|---|---|
| [ ] | Admin lee usuarios | get | `usuarios/<UID de un agente>` | UID de admin | ✅ Permitido |
| [ ] | Agente lee a otro | get | `usuarios/<UID de otro>` | UID de un agente | ❌ Denegado |
| [ ] | **Agente se hace admin** | update, datos `{"rol":"admin"}` | `usuarios/<su propio UID>` | el mismo UID del agente | ❌ Denegado |
| [ ] | Agente apaga su bandera | update, datos `{"debeCambiarPassword":false,"tempPassExpira":null}` | `usuarios/<su propio UID>` | el mismo UID del agente | ✅ Permitido |
| [ ] | Agente lee retiros | get | `operaciones_retiros/cualquiera` | UID de un agente | ✅ Permitido |
| [ ] | Sin sesión lee retiros | get | `operaciones_retiros/cualquiera` | sin autenticar | ❌ Denegado |
| [ ] | Agente lee la auditoría | get | `auditoria_usuarios/cualquiera` | UID de un agente | ❌ Denegado |

La prueba en negrita es el agujero que se cierra con esta sección.

> Si una prueba no da lo esperado, **no publicar**: guardar el mensaje del simulador para revisarlo.

### 1d. Publicar y probar la app

- [ ] Pulsar **Publicar** y esperar ~1 minuto.

**Como agente:**
- [ ] Reportes: cargar un día (API o Excel) y borrarlo.
- [ ] Auditoría diaria: exonerar un retiro y guardar la nota del día.
- [ ] Evaluación diaria: sincronizar y confirmar una evaluación.
- [ ] Cierre mensual: abrir un mes y copiar el enlace de un expediente.
- [ ] Abrir ese enlace de expediente en una ventana privada (sin sesión).

**Como admin:**
- [ ] Monitor regional carga.
- [ ] Gestión de usuarios carga la lista, el último acceso y la actividad reciente.

Si algo falla con `Missing or insufficient permissions` en la consola del navegador (F12), anotar la colección que aparece en el error. Si bloquea el trabajo, restaurar el respaldo del paso 1a.

---

## Paso 2: política de contraseñas en Firebase Authentication

- [ ] En la consola: **Authentication → Configuración (Settings) → Política de contraseñas (Password policy)**.
  - Si no aparece, el proyecto necesita **Firebase Authentication with Identity Platform**: la consola ofrece la actualización y es gratis hasta un volumen alto de usuarios. Si prefieres no actualizar, sáltate este paso; la página de primer ingreso ya exige los requisitos.
- [ ] Configurar solo:
  - **Largo mínimo: 10**
  - **Exigir número: sí**
  - Mayúsculas, minúsculas y símbolos: **no**, para no exigir más que la página de primer ingreso.
- [ ] **Modo de aplicación:** empezar con el modo que solo avisa y no bloquea, si existe. Los usuarios antiguos tienen contraseñas de 6 a 8 caracteres; leer la descripción de cada modo en la consola antes de elegir. Pasar al modo estricto cuando todos hayan cambiado su contraseña.
- [ ] Guardar.

> Las contraseñas temporales del sistema ya cumplen esta política: 12 caracteres con mayúscula, minúscula y número.

---

## Paso 3: prueba completa con un usuario de prueba

**Como admin, en Gestión de usuarios:**
- [ ] **Nuevo usuario** con un correo de prueba → aparece la contraseña temporal → **Copiar mensaje** funciona.
- [ ] Crear otra vez con el mismo correo → muestra "Ya existe un usuario con este correo."
- [ ] **Editar**: cambiar el nombre y el rol → toast "Cambios guardados" y una fila nueva en Actividad reciente.
- [ ] En tu propia fila: el botón Desactivar está deshabilitado y en Editar el rol aparece bloqueado.

**En una ventana privada, con el usuario de prueba:**
- [ ] Entrar con la contraseña temporal → lleva a "Elige tu contraseña".
- [ ] Probar una contraseña de 10 letras sin números → el botón no se habilita.
- [ ] Usar una contraseña que cumpla los 4 requisitos → entra al inicio.
- [ ] En Actividad reciente aparece "{nombre} cambió su contraseña temporal".

**Restablecer y desactivar** (con el usuario de prueba abierto en la ventana privada):
- [ ] **Restablecer contraseña** → muestra la temporal nueva; la sesión del usuario se cierra.
- [ ] Iniciar sesión con la temporal nueva para que vuelva a entrar.
- [ ] **Desactivar** → la ventana privada lo saca solo, con el mensaje "Tu acceso está desactivado. Habla con un administrador."
- [ ] Dejar al usuario de prueba desactivado (los usuarios no se eliminan).

---

## Si algo sale mal

| Síntoma | Qué hacer |
|---|---|
| Todo `/api/*` responde 401 o 500 aunque haya sesión | Revisar las variables del Admin SDK en producción (paso 0). |
| "Missing or insufficient permissions" en una vista | Anotar la colección del error; restaurar el respaldo de reglas si bloquea el trabajo. |
| Un admin no puede entrar a Gestión de usuarios | Su perfil no tiene `rol: "admin"` exacto o tiene `activo: false` (paso 1b). |
| Todos quedan fuera al iniciar sesión | Restaurar el respaldo de reglas (paso 1a) y revisar el paso 1b. |
| La página de primer ingreso dice que la contraseña no cumple la política | La política del paso 2 pide más que la página: dejar solo largo 10 y número. |

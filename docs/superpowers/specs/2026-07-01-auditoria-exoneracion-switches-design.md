# Auditoría diaria: opciones de exoneración por switches

## Contexto

En `app/(dashboard)/auditoria-diaria/page.tsx`, el modal "Comentario de
Brecha" permite escribir un texto libre en un retiro que está en la brecha
crítica. Cualquier texto no vacío en `comentarioBrecha` exonera ese retiro
del conteo (`isExonerated` en `lib/utils.ts`). El texto libre genera
inconsistencia en los motivos registrados y no permite reportes agregados
por causa.

## Objetivo

Reemplazar el `textarea` del modal por 4 opciones predefinidas,
seleccionables mediante switches, mutuamente excluyentes:

- En Revisión
- Problemas con la plataforma
- Problemas con el método de pago
- Falta de fondos para pagar

Si ninguna opción está seleccionada, el retiro no debe exonerarse (salvo el
caso de preservar comentarios libres antiguos, ver más abajo).

## Diseño

### Constante de opciones

```ts
const EXONERATION_REASONS = [
  "En Revisión",
  "Problemas con la plataforma",
  "Problemas con el método de pago",
  "Falta de fondos para pagar",
] as const;
```

### Estado del modal

Se reemplaza `commentText: string` por:

```ts
const [selectedReason, setSelectedReason] = useState<string | null>(null);
```

Al abrir el modal (`onClick` del botón de comentario, línea ~1163-1167):

```ts
setSelectedOpId(op.id);
const current = op.comentarioBrecha || "";
setSelectedReason(
  EXONERATION_REASONS.includes(current as any) ? current : null,
);
setCommentModalOpen(true);
```

El texto original (`op.comentarioBrecha`) se sigue leyendo directamente de
`rawOps` dentro del modal (buscando por `selectedOpId`) para decidir si
mostrar la nota de comentario antiguo — no hace falta un estado adicional.

### UI del modal

Se reemplaza el bloque del `textarea` (líneas ~509-519) por:

- Texto instructivo actualizado: "Selecciona el motivo de la exoneración de
  este retiro."
- 4 filas, una por opción, reutilizando el patrón de switch ya usado en
  `app/(dashboard)/evaluacion-diaria/page.tsx` (checkbox `sr-only peer` +
  div estilado):

  ```tsx
  {EXONERATION_REASONS.map((reason) => {
    const isChecked = selectedReason === reason;
    const isDisabled = selectedReason !== null && !isChecked;
    return (
      <div key={reason} className="flex items-center justify-between py-2">
        <span className={cn("text-sm text-slate-700", isDisabled && "opacity-50")}>
          {reason}
        </span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={isChecked}
            disabled={isDisabled}
            onChange={(e) => setSelectedReason(e.target.checked ? reason : null)}
          />
          <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed" />
        </label>
      </div>
    );
  })}
  ```

- Cuando el `comentarioBrecha` original del retiro no está vacío y no
  coincide con ninguna de las 4 opciones (comentario libre pre-existente),
  se muestra una nota de solo lectura debajo de los switches:

  ```tsx
  {legacyComment && (
    <p className="mt-3 text-xs text-slate-500 italic bg-slate-50 border border-slate-200 rounded-lg p-2">
      Comentario anterior: "{legacyComment}"
    </p>
  )}
  ```

  donde `legacyComment` se deriva en el render del modal buscando el
  `op` correspondiente a `selectedOpId` en `rawOps`, tomando su
  `comentarioBrecha` solo si no está vacío y no coincide con ninguna razón
  predefinida.

### Guardado (`handleSaveComment`)

Lógica de valor a persistir:

```ts
const originalComment = rawOps.find((op) => op.id === selectedOpId)?.comentarioBrecha || "";
const isLegacy = originalComment !== "" && !EXONERATION_REASONS.includes(originalComment as any);
const valueToSave = selectedReason ?? (isLegacy ? originalComment : "");

await updateDoc(doc(db, "operaciones_retiros", selectedOpId), {
  comentarioBrecha: valueToSave,
});
```

Esto cubre los 3 casos:

1. Usuario selecciona una razón → se guarda esa razón (exonera).
2. Usuario no selecciona ninguna y el retiro tenía un comentario libre
   antiguo → se preserva tal cual (sigue exonerado, sin cambios).
3. Usuario no selecciona ninguna y el retiro no tenía comentario, o tenía
   una razón predefinida que fue apagada → se guarda `""` (no exonera).

El resto de `handleSaveComment` (toasts, `setRawOps`, cierre de modal) no
cambia de comportamiento, solo la fuente del valor guardado.

### Fuera de alcance

- No se migra el dato histórico de comentarios libres a las 4 categorías.
- No se añade una 5ª opción "otro/libre" — si se necesita en el futuro, es
  un cambio aparte.
- No se modifica `isExonerated` en `lib/utils.ts` (sigue funcionando igual,
  ya que solo verifica que el string no esté vacío).

## Testing

- Verificar manualmente en la vista de auditoría diaria:
  - Retiro sin comentario: abrir modal, ninguna opción activa, todas
    clickeables.
  - Seleccionar una opción → las otras 3 se deshabilitan visualmente.
  - Apagar la opción activa → las 4 vuelven a estar disponibles.
  - Guardar sin seleccionar nada en un retiro nuevo → no se exonera.
  - Retiro con comentario libre antiguo (dato de prueba manual en
    Firestore) → se muestra la nota, guardar sin tocar switches preserva el
    comentario y el estado exonerado.
  - Seleccionar una opción en un retiro con comentario libre antiguo →
    reemplaza el comentario por la opción elegida.

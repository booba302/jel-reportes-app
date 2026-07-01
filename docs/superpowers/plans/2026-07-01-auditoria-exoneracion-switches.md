# Auditoría Diaria: Switches de Exoneración Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text comment box in the "Comentario de Brecha" exoneration modal (auditoria-diaria page) with 4 predefined, mutually-exclusive switch options.

**Architecture:** Single-file change to `app/(dashboard)/auditoria-diaria/page.tsx`. A new module-level constant lists the 4 valid reasons. The `commentText` string state is replaced by `selectedReason: string | null`. The modal's JSX swaps the `textarea` for 4 switch rows (reusing the existing `sr-only peer` checkbox pattern already used in `evaluacion-diaria/page.tsx`). Save logic derives the value to persist from `selectedReason`, falling back to preserving any pre-existing free-text comment when nothing is selected.

**Tech Stack:** Next.js (App Router), React (client component, `useState`), Firebase Firestore (`updateDoc`), Tailwind CSS. No test framework is configured in this repo (`package.json` has no jest/vitest/playwright as a dependency) — verification is manual via the dev server, matching how prior features in this codebase (custom date range picker, month picker) were verified.

## Global Constraints

- Exact option labels (verbatim, must match): `En Revisión`, `Problemas con la plataforma`, `Problemas con el método de pago`, `Falta de fondos para pagar`.
- Selection is mutually exclusive: only one switch can be on at a time. While one is on, the other 3 are visually disabled (`disabled` attribute, grayed out) and cannot be toggled until the active one is turned off.
- If no switch is selected, the retiro does not get exonerated — **except** when the retiro already had a free-text comment that doesn't match any of the 4 options, in which case that old comment must be preserved unchanged when the user saves without touching any switch.
- Do not modify `isExonerated` in `lib/utils.ts` — it already works correctly (checks for non-empty string).
- Do not add a 5th "free text" option or migrate historical data — out of scope per the spec.
- Reuse the existing switch visual pattern from `app/(dashboard)/evaluacion-diaria/page.tsx:506-521` (checkbox + `sr-only peer` + styled `div`) rather than introducing a new UI library dependency (no Radix switch package is installed).

---

### Task 1: Replace free-text comment with exoneration-reason switches

**Files:**
- Modify: `app/(dashboard)/auditoria-diaria/page.tsx`

**Interfaces:**
- Consumes: existing `OperacionRow` interface (`comentarioBrecha?: string`), existing `cn` util from `@/lib/utils`, existing `rawOps` state, existing `Button` component.
- Produces: nothing consumed by other tasks — this is the only task in the plan.

- [ ] **Step 1: Add the `EXONERATION_REASONS` constant**

  In `app/(dashboard)/auditoria-diaria/page.tsx`, right after the `OperacionRow` interface (currently lines 76-86, ends with the closing `}` before `function ReporteDiarioContent() {`), add:

  ```ts
  const EXONERATION_REASONS = [
    "En Revisión",
    "Problemas con la plataforma",
    "Problemas con el método de pago",
    "Falta de fondos para pagar",
  ] as const;
  ```

  Result should read:

  ```ts
  interface OperacionRow {
    id: string;
    hora: string;
    alias: string;
    cantidad: number;
    tiempo: number;
    cumple: boolean;
    operador: string;
    nivel: string;
    comentarioBrecha?: string;
  }

  const EXONERATION_REASONS = [
    "En Revisión",
    "Problemas con la plataforma",
    "Problemas con el método de pago",
    "Falta de fondos para pagar",
  ] as const;

  function ReporteDiarioContent() {
  ```

- [ ] **Step 2: Replace `commentText` state with `selectedReason`**

  Find (currently lines 115-119):

  ```ts
    // Estados para el Modal de Comentarios de Brecha
    const [commentModalOpen, setCommentModalOpen] = useState(false);
    const [selectedOpId, setSelectedOpId] = useState("");
    const [commentText, setCommentText] = useState("");
    const [isSavingComment, setIsSavingComment] = useState(false);
  ```

  Replace with:

  ```ts
    // Estados para el Modal de Comentarios de Brecha
    const [commentModalOpen, setCommentModalOpen] = useState(false);
    const [selectedOpId, setSelectedOpId] = useState("");
    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [isSavingComment, setIsSavingComment] = useState(false);
  ```

- [ ] **Step 3: Update `handleSaveComment` to derive the value to persist**

  Find (currently lines 197-221):

  ```ts
    const handleSaveComment = async () => {
      if (!selectedOpId) return;
      setIsSavingComment(true);
      try {
        await updateDoc(doc(db, "operaciones_retiros", selectedOpId), {
          comentarioBrecha: commentText,
        });

        setRawOps((prev) =>
          prev.map((op) =>
            op.id === selectedOpId
              ? { ...op, comentarioBrecha: commentText }
              : op,
          ),
        );

        toast.success("Comentario guardado exitosamente");
        setCommentModalOpen(false);
      } catch (error) {
        console.error("Error al guardar comentario:", error);
        toast.error("Hubo un problema al guardar el comentario");
      } finally {
        setIsSavingComment(false);
      }
    };
  ```

  Replace with:

  ```ts
    const handleSaveComment = async () => {
      if (!selectedOpId) return;
      setIsSavingComment(true);
      try {
        const originalComment =
          rawOps.find((op) => op.id === selectedOpId)?.comentarioBrecha || "";
        const isLegacyComment =
          originalComment !== "" &&
          !EXONERATION_REASONS.includes(
            originalComment as (typeof EXONERATION_REASONS)[number],
          );
        const valueToSave =
          selectedReason ?? (isLegacyComment ? originalComment : "");

        await updateDoc(doc(db, "operaciones_retiros", selectedOpId), {
          comentarioBrecha: valueToSave,
        });

        setRawOps((prev) =>
          prev.map((op) =>
            op.id === selectedOpId
              ? { ...op, comentarioBrecha: valueToSave }
              : op,
          ),
        );

        toast.success("Comentario guardado exitosamente");
        setCommentModalOpen(false);
      } catch (error) {
        console.error("Error al guardar comentario:", error);
        toast.error("Hubo un problema al guardar el comentario");
      } finally {
        setIsSavingComment(false);
      }
    };
  ```

- [ ] **Step 4: Update the modal-open button to initialize `selectedReason`**

  Find (currently lines 1159-1179, the button in the table row that opens the modal):

  ```tsx
                              <td className="px-4 py-2 text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedOpId(op.id);
                                    setCommentText(op.comentarioBrecha || "");
                                    setCommentModalOpen(true);
                                  }}
                                  className={cn(
                                    "h-8 w-8 p-0 rounded-full",
                                    op.comentarioBrecha
                                      ? "text-primary bg-primary/10"
                                      : "text-slate-400 hover:text-primary",
                                  )}
                                  title={
                                    op.comentarioBrecha || "Agregar comentario"
                                  }
                                >
                                  <MessageSquare className="w-4 h-4" />
                                </Button>
  ```

  Replace the `onClick` body only (leave the rest of the `Button` untouched):

  ```tsx
                              <td className="px-4 py-2 text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedOpId(op.id);
                                    const current = op.comentarioBrecha || "";
                                    setSelectedReason(
                                      EXONERATION_REASONS.includes(
                                        current as (typeof EXONERATION_REASONS)[number],
                                      )
                                        ? current
                                        : null,
                                    );
                                    setCommentModalOpen(true);
                                  }}
                                  className={cn(
                                    "h-8 w-8 p-0 rounded-full",
                                    op.comentarioBrecha
                                      ? "text-primary bg-primary/10"
                                      : "text-slate-400 hover:text-primary",
                                  )}
                                  title={
                                    op.comentarioBrecha || "Agregar comentario"
                                  }
                                >
                                  <MessageSquare className="w-4 h-4" />
                                </Button>
  ```

- [ ] **Step 5: Compute `legacyComment` for the modal render**

  Find (currently lines 488-491):

  ```tsx
    const fechaFormateada = selectedDate
      ? format(parseISO(selectedDate), "dd 'de' MMMM, yyyy", { locale: es })
      : "";

    return (
  ```

  Replace with:

  ```tsx
    const fechaFormateada = selectedDate
      ? format(parseISO(selectedDate), "dd 'de' MMMM, yyyy", { locale: es })
      : "";

    const selectedOpForModal = rawOps.find((op) => op.id === selectedOpId);
    const legacyComment =
      selectedOpForModal?.comentarioBrecha &&
      !EXONERATION_REASONS.includes(
        selectedOpForModal.comentarioBrecha as (typeof EXONERATION_REASONS)[number],
      )
        ? selectedOpForModal.comentarioBrecha
        : null;

    return (
  ```

- [ ] **Step 6: Replace the modal body (textarea → switches + legacy note)**

  Find (currently lines 509-519, inside the modal's `<div className="p-6">`):

  ```tsx
              <p className="text-sm text-slate-500 mb-3">
                Explica brevemente por qué este retiro tuvo demora (falla de
                API, validación de cuenta, etc).
              </p>
              <textarea
                className="w-full h-32 p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none text-sm text-slate-700"
                placeholder="Motivo de la demora..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
  ```

  Replace with:

  ```tsx
              <p className="text-sm text-slate-500 mb-3">
                Selecciona el motivo de la exoneración de este retiro.
              </p>
              <div className="divide-y divide-slate-100">
                {EXONERATION_REASONS.map((reason) => {
                  const isChecked = selectedReason === reason;
                  const isDisabled = selectedReason !== null && !isChecked;
                  return (
                    <div
                      key={reason}
                      className="flex items-center justify-between py-2.5"
                    >
                      <span
                        className={cn(
                          "text-sm text-slate-700",
                          isDisabled && "opacity-50",
                        )}
                      >
                        {reason}
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={isChecked}
                          disabled={isDisabled}
                          onChange={(e) =>
                            setSelectedReason(e.target.checked ? reason : null)
                          }
                        />
                        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed" />
                      </label>
                    </div>
                  );
                })}
              </div>
              {legacyComment && (
                <p className="mt-3 text-xs text-slate-500 italic bg-slate-50 border border-slate-200 rounded-lg p-2">
                  Comentario anterior: &quot;{legacyComment}&quot;
                </p>
              )}
  ```

- [ ] **Step 7: Reset `selectedReason` when the modal is dismissed via Cancelar or the X button (optional cleanliness check)**

  The `onClick={() => setCommentModalOpen(false)}` handlers on the `X` button (line ~503) and `Cancelar` button (line ~523) do not need changes — `selectedReason` is always re-initialized in Step 4's `onClick` the next time the modal is opened for any row, so stale state cannot leak into a different row. Confirm this by reading the two `onClick={() => setCommentModalOpen(false)}` call sites and verifying neither needs a `setSelectedReason` reset. No code change in this step — it's a verification-only step.

- [ ] **Step 8: Type-check and lint**

  Run:
  ```bash
  npx tsc --noEmit
  npm run lint
  ```
  Expected: no new errors introduced in `app/(dashboard)/auditoria-diaria/page.tsx`. If `EXONERATION_REASONS.includes(x as (typeof EXONERATION_REASONS)[number])` produces a type error, use `(EXONERATION_REASONS as readonly string[]).includes(x)` instead in all 3 call sites (Steps 3, 4, 5).

- [ ] **Step 9: Manual verification via dev server**

  Run:
  ```bash
  npm run dev
  ```
  Open the app, navigate to Auditoría Diaria for a date with at least one retiro in the critical gap (or create one via Firestore test data if needed — see prior session's approach of using a Playwright script / manual browser interaction). Verify:
  1. Click the comment icon on a retiro with no `comentarioBrecha` → modal opens, all 4 switches off and enabled.
  2. Toggle "En Revisión" on → the other 3 switches become visually disabled and unclickable.
  3. Toggle "En Revisión" off → all 4 switches become enabled again.
  4. Click Guardar with no switch selected → toast success, row does NOT show "Exonerado" badge, `tiempo` value is not struck through.
  5. Reopen the modal, select "Problemas con la plataforma", click Guardar → row now shows "Exonerado" badge and struck-through `tiempo`.
  6. Reopen the modal for that same row → "Problemas con la plataforma" switch is pre-selected (checked), others disabled.
  7. In Firestore console (or via a one-off script), manually set `comentarioBrecha` on a different retiro's document to a free-text value not in the 4 options (e.g. `"Reintento manual por el operador"`). Reload the page, open that retiro's modal → no switch is checked, and the note `Comentario anterior: "Reintento manual por el operador"` appears below the switches.
  8. Click Guardar without touching any switch → toast success, row still shows "Exonerado" badge (comment preserved).
  9. Reopen the same modal, select "Falta de fondos para pagar", click Guardar → the free-text comment is replaced; reopening shows that switch pre-selected and no legacy note.

  Report each of the 9 checks as pass/fail. Do not report the task complete unless all 9 pass.

- [ ] **Step 10: Commit**

  ```bash
  git add "app/(dashboard)/auditoria-diaria/page.tsx"
  git commit -m "$(cat <<'EOF'
feat: replace free-text exoneration comment with reason switches

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
  ```

---

## Self-Review Notes

- **Spec coverage:** 4 fixed options ✓ (Step 1), mutual exclusion with disabling ✓ (Step 6), no exoneration when none selected ✓ (Step 3), legacy free-text preservation ✓ (Steps 3 & 5), legacy note display ✓ (Steps 5 & 6). All spec sections have a corresponding step.
- **Placeholder scan:** no TBD/TODO; all code blocks are complete and copy-pasteable.
- **Type consistency:** `selectedReason` typed `string | null` everywhere it's used (Steps 2, 4, 6); `EXONERATION_REASONS` referenced identically in Steps 1, 3, 4, 5, 6; `legacyComment` computed once in Step 5 and consumed only in Step 6.

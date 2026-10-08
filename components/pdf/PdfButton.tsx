"use client";

import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Botón único de exportación: abre el diálogo de vista previa del PDF. */
export function PdfButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="outline"
      className="h-9 gap-2 rounded-lg bg-card dark:bg-card"
      onClick={onClick}
      disabled={disabled}
    >
      <FileText className="size-4 text-danger-text" />
      PDF
    </Button>
  );
}

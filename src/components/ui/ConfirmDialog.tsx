import { Button } from "@/components/ui/Button";

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title = "Confirm",
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/30 p-4" role="presentation">
      <div className="w-full max-w-sm rounded border border-[#d9c8ae] bg-[#fffaf0] p-4 shadow-lg" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <p id="confirm-dialog-title" className="text-sm font-semibold text-[#111827]">{title}</p>
        <p className="mt-1 text-xs text-[#6b7280]">{message}</p>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

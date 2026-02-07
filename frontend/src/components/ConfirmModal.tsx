import { AlertTriangle } from 'lucide-react';
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
  isDangerous = true,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title}>
      <div className="space-y-4">
        {isDangerous && (
          <div className="flex items-start gap-3 bg-terracotta-100 dark:bg-terracotta-900 border border-terracotta-300 dark:border-terracotta-700 rounded p-3">
            <AlertTriangle size={20} className="text-terracotta-700 dark:text-terracotta-100 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-terracotta-800 dark:text-terracotta-50">
              This action cannot be undone.
            </p>
          </div>
        )}
        <p className="text-sm text-charcoal-700 dark:text-sand-200">
          {message}
        </p>
        <div className="flex gap-2 justify-end pt-4">
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={isDangerous ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Deleting..." : confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

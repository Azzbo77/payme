import { Modal } from "../ui/Modal";

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function InfoModal({ isOpen, onClose, title, children }: InfoModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4 text-charcoal-700 dark:text-charcoal-200">
        {children}
      </div>
    </Modal>
  );
}

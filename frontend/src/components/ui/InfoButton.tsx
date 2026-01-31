import { HelpCircle } from "lucide-react";

interface InfoButtonProps {
  onClick: () => void;
  size?: number;
}

export function InfoButton({ onClick, size = 18 }: InfoButtonProps) {
  return (
    <button
      onClick={onClick}
      className="p-1 hover:bg-sand-200 dark:hover:bg-charcoal-800 transition-colors rounded"
      title="More information"
    >
      <HelpCircle size={size} className="text-charcoal-500 dark:text-charcoal-400" />
    </button>
  );
}

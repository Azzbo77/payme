import { TrendingUp, HelpCircle } from "lucide-react";
import { CollapsibleCard } from "./ui/CollapsibleCard";
import { useCurrency } from "../context/CurrencyContext";

interface ProjectedSavingsCardProps {
  savings: number;
  remaining: number;
  onAnalyzeClick?: () => void;
}

export function ProjectedSavingsCard({ savings, remaining, onAnalyzeClick }: ProjectedSavingsCardProps) {
  const { formatCurrency } = useCurrency();
  const projected = savings + remaining;

  return (
    <CollapsibleCard 
      id="projectedSavingsCard" 
      title="Projected"
      icon={<TrendingUp size={16} className="text-sage-600" />}
      className="!p-3"
      actions={
        onAnalyzeClick && (
          <button
            onClick={onAnalyzeClick}
            className="p-0.5 hover:bg-sand-200 dark:hover:bg-charcoal-700 rounded transition-colors"
            title="Why this amount?"
          >
            <HelpCircle size={14} className="text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-300" />
          </button>
        )
      }
    >
      <span className="text-sm font-semibold text-sage-700 dark:text-sage-400">
        {formatCurrency(projected)}
      </span>
    </CollapsibleCard>
  );
}


import { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useUIPreferences } from "../../context/UIPreferencesContext";
import { Card } from "./Card";

interface CollapsibleCardProps {
  id: string;
  title: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * A card component that can be collapsed/expanded with state persistence
 * 
 * @param id - Unique identifier for collapse state storage
 * @param title - Card title
 * @param icon - Optional icon to display next to title
 * @param actions - Optional action buttons (displayed only when expanded)
 * @param children - Card content
 * @param className - Optional additional CSS classes
 */
export function CollapsibleCard({
  id,
  title,
  icon,
  actions,
  children,
  className = "",
}: CollapsibleCardProps) {
  const { collapsedCards, setCardCollapsed } = useUIPreferences();
  const isCollapsed = collapsedCards[id] ?? false;

  return (
    <Card className={className}>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCardCollapsed(id, !isCollapsed)}
          className="flex items-center gap-2 hover:opacity-70 transition-opacity cursor-pointer flex-1 text-left"
        >
          <ChevronDown
            size={16}
            className={`transition-transform text-charcoal-500 dark:text-charcoal-400 ${
              isCollapsed ? "-rotate-90" : ""
            }`}
          />
          {icon && <div className="flex-shrink-0">{icon}</div>}
          <h3 className="text-sm font-semibold text-charcoal-700 dark:text-sand-200">
            {title}
          </h3>
        </button>
        {!isCollapsed && actions}
      </div>

      {!isCollapsed && <div>{children}</div>}
    </Card>
  );
}

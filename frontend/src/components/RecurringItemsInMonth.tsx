import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Settings } from "lucide-react";
import { Item, RecurringItem, api } from "../api/client";
import { CollapsibleCard } from "./ui/CollapsibleCard";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { ConfirmModal } from "./ConfirmModal";
import { useCurrency } from "../context/CurrencyContext";
import { useToast } from "../hooks";

interface RecurringItemsInMonthProps {
  monthId: number;
  items: Item[];
  isReadOnly?: boolean;
  onUpdate: () => void;
}

export function RecurringItemsInMonth({
  monthId,
  items,
  isReadOnly,
  onUpdate,
}: RecurringItemsInMonthProps) {
  const { formatCurrency } = useCurrency();
  const { error } = useToast();
  const [isManaging, setIsManaging] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<RecurringItem[]>([]);

  // Get recurring items that have been added to this month
  const recurringItems = items.filter((item) => item.recurring_item_id);

  // Load available templates when modal opens
  const loadAvailableTemplates = useCallback(async () => {
    try {
      const templates = await api.recurringItems.list();
      setAvailableTemplates(templates);
    } catch {
      error("Failed to load recurring item templates");
    }
  }, [error]);

  useEffect(() => {
    if (isManaging && availableTemplates.length === 0) {
      loadAvailableTemplates();
    }
  }, [isManaging, availableTemplates.length, loadAvailableTemplates]);

  const handleAddFromTemplate = async (template: RecurringItem) => {
    setAddLoading(true);
    try {
      await api.items.create(monthId, {
        category_id: template.category_id,
        description: template.description,
        amount: template.amount,
        spent_on: new Date().toISOString().split("T")[0],
      });
      await onUpdate();
      setAddLoading(false);
    } catch {
      error("Failed to add recurring item");
      setAddLoading(false);
    }
  };

  const handleDelete = (id: number) => {
    setDeleteConfirmId(id);
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirmId === null) return;
    setDeleteLoading(true);
    try {
      await api.items.delete(monthId, deleteConfirmId);
      setDeleteConfirmId(null);
      await onUpdate();
    } catch {
      error("Failed to delete recurring item");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Don't show card if no recurring items
  if (recurringItems.length === 0 && !isManaging) return null;

  const total = recurringItems.reduce((sum, item) => sum + item.amount, 0);

  return (
    <>
      <CollapsibleCard
        id="recurringItemsInMonth"
        title="Recurring Items"
        actions={
          !isReadOnly && (
            <button
              onClick={() => setIsManaging(true)}
              className="p-1 hover:bg-sand-200 dark:hover:bg-charcoal-800 transition-colors"
            >
              <Settings size={16} />
            </button>
          )
        }
      >
        <div className="space-y-2">
          {recurringItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-2 border-b border-sand-200 dark:border-charcoal-800"
            >
              <div className="flex-1">
                <span className="text-sm text-charcoal-700 dark:text-sand-300">
                  {item.description}
                </span>
                <span className="text-xs text-charcoal-500 dark:text-charcoal-400 ml-2">
                  (Auto-generated)
                </span>
              </div>
              <span className="text-sm text-charcoal-600 dark:text-charcoal-400">
                {formatCurrency(item.amount)}
              </span>
            </div>
          ))}
          {recurringItems.length === 0 && (
            <div className="text-sm text-charcoal-400 dark:text-charcoal-600 py-4 text-center">
              No recurring items in this month
            </div>
          )}
        </div>

        {recurringItems.length > 0 && (
          <div className="mt-4 pt-3 border-t border-sand-300 dark:border-charcoal-700 flex justify-between">
            <span className="text-sm font-medium text-charcoal-600 dark:text-sand-300">
              Total
            </span>
            <span className="text-sm font-semibold text-charcoal-800 dark:text-sand-100">
              {formatCurrency(total)}
            </span>
          </div>
        )}
      </CollapsibleCard>

      <Modal isOpen={isManaging} onClose={() => setIsManaging(false)} title="Manage Recurring Items">
        <div className="space-y-4">
          {/* Available Templates Section */}
          {availableTemplates.length > 0 && (
            <div className="border-b border-sand-200 dark:border-charcoal-800 pb-4">
              <h4 className="text-sm font-semibold text-charcoal-700 dark:text-sand-200 mb-3">
                Add from Templates
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {availableTemplates
                  .filter((t) => !recurringItems.some((i) => i.recurring_item_id === t.id))
                  .map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center justify-between p-2 bg-sand-100 dark:bg-charcoal-800 rounded"
                    >
                      <div>
                        <div className="text-sm font-sans text-charcoal-700 dark:text-sand-300">
                          {template.description}
                        </div>
                        <div className="text-xs font-sans text-charcoal-500 dark:text-charcoal-400">
                          {formatCurrency(template.amount)} • Day {template.day_of_month}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleAddFromTemplate(template)}
                        isLoading={addLoading}
                      >
                        <Plus size={14} />
                      </Button>
                    </div>
                  ))}
                {availableTemplates.filter((t) => !recurringItems.some((i) => i.recurring_item_id === t.id))
                  .length === 0 && (
                  <div className="text-sm text-charcoal-400 dark:text-charcoal-600 py-2">
                    All templates are already added
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Current Items Section */}
          <div>
            <h4 className="text-sm font-semibold text-charcoal-700 dark:text-sand-200 mb-3">
              Items in this Month
            </h4>
            {recurringItems.length > 0 ? (
              <div className="space-y-2">
                {recurringItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 bg-sand-50 dark:bg-charcoal-900 rounded border border-sand-200 dark:border-charcoal-800"
                  >
                    <div className="flex-1">
                      <div className="text-sm text-charcoal-700 dark:text-sand-300">{item.description}</div>
                      <div className="text-xs text-charcoal-500 dark:text-charcoal-400">
                        {formatCurrency(item.amount)}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1 text-terracotta-500 hover:bg-terracotta-100 dark:hover:bg-charcoal-800"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-charcoal-400 dark:text-charcoal-600 py-4 text-center">
                No recurring items in this month
              </div>
            )}
          </div>

          <div className="border-t border-sand-200 dark:border-charcoal-800 pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsManaging(false)}
              className="w-full"
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={deleteConfirmId !== null}
        title="Delete Item"
        message="Are you sure you want to delete this recurring item from this month?"
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </>
  );
}

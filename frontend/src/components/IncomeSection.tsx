import { useState } from "react";
import { Plus, Trash2, Edit2, Check, X, Loader } from "lucide-react";
import { IncomeEntry, api } from "../api/client";
import { CollapsibleCard } from "./ui/CollapsibleCard";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { ConfirmModal } from "./ConfirmModal";
import { useCurrency } from "../context/CurrencyContext";
import { useToast, useFormValidation, validationRules } from "../hooks";

interface IncomeSectionProps {
  monthId: number;
  entries: IncomeEntry[];
  isReadOnly: boolean;
  onUpdate: () => void;
}

export function IncomeSection({ monthId, entries, isReadOnly, onUpdate }: IncomeSectionProps) {
  const { formatCurrency } = useCurrency();
  const { success, error } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { fieldErrors, validateField, validateAll, clearAll } = useFormValidation({
    label: [validationRules.required("Label"), validationRules.minLength("Label", 1)],
    amount: [validationRules.required("Amount"), validationRules.positive("Amount")],
  });

  const handleAdd = async () => {
    if (!validateAll({ label, amount })) return;
    setAddLoading(true);
    try {
      await api.income.create(monthId, { label, amount: parseFloat(amount) });
      success(`Added income: ${label}`);
      setLabel("");
      setAmount("");
      setIsAdding(false);
      clearAll();
      await onUpdate();
    } catch {
      error("Failed to add income");
    } finally {
      setAddLoading(false);
    }
  };

  const handleUpdate = async (id: number) => {
    if (!validateAll({ label, amount })) return;
    setUpdateLoading(true);
    try {
      await api.income.update(monthId, id, { label, amount: parseFloat(amount) });
      success(`Updated income: ${label}`);
      setEditingId(null);
      setLabel("");
      setAmount("");
      clearAll();
      await onUpdate();
    } catch {
      error("Failed to update income");
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleDelete = (id: number) => {
    setDeleteConfirmId(id);
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirmId === null) return;
    setDeleteLoading(true);
    try {
      await api.income.delete(monthId, deleteConfirmId);
      success("Income deleted");
      setDeleteConfirmId(null);
      await onUpdate();
    } catch {
      error("Failed to delete income");
    } finally {
      setDeleteLoading(false);
    }
  };

  const startEdit = (entry: IncomeEntry) => {
    setEditingId(entry.id);
    setLabel(entry.label);
    setAmount(entry.amount.toString());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setLabel("");
    setAmount("");
    setIsAdding(false);
    clearAll();
  };

  return (
    <>
      <CollapsibleCard
        id="incomeSection"
        title="Income"
        actions={
          !isReadOnly && !isAdding ? (
            <button
              onClick={() => setIsAdding(true)}
              className="p-1 hover:bg-sand-200 dark:hover:bg-charcoal-800 transition-colors"
            >
              <Plus size={16} />
            </button>
          ) : null
        }
      >
      <div className="space-y-3">
        {entries.map((entry) => (
          <div key={entry.id}>
            {editingId === entry.id ? (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Label"
                    value={label}
                    onChange={(e) => {
                      setLabel(e.target.value);
                      validateField("label", e.target.value);
                    }}
                    error={fieldErrors.label}
                  />
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      validateField("amount", e.target.value);
                    }}
                    error={fieldErrors.amount}
                  />
                </div>
                <button
                  onClick={() => handleUpdate(entry.id)}
                  disabled={updateLoading}
                  className="p-2 text-sage-600 hover:bg-sage-100 dark:hover:bg-charcoal-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateLoading ? <Loader size={16} className="animate-spin" /> : <Check size={16} />}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={updateLoading}
                  className="p-2 text-charcoal-500 hover:bg-sand-200 dark:hover:bg-charcoal-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between py-2 border-b border-sand-200 dark:border-charcoal-800">
                <span className="text-sm text-charcoal-700 dark:text-sand-300">
                  {entry.label}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-sage-600 dark:text-sage-400">
                    {formatCurrency(entry.amount)}
                  </span>
                  {!isReadOnly && (
                    <>
                      <button
                        onClick={() => startEdit(entry)}
                        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-sand-200 dark:hover:bg-charcoal-800 transition-all"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="p-1 text-terracotta-500 hover:bg-terracotta-100 dark:hover:bg-charcoal-800 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {isAdding && (
          <div className="flex items-end gap-2 pt-2">
            <div className="flex-1">
              <Input
                placeholder="Label"
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value);
                  validateField("label", e.target.value);
                }}
                error={fieldErrors.label}
              />
            </div>
            <div className="w-24">
              <Input
                type="number"
                placeholder="Amount"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  validateField("amount", e.target.value);
                }}
                error={fieldErrors.amount}
              />
            </div>
            <Button size="sm" onClick={handleAdd} isLoading={addLoading} disabled={addLoading || !!fieldErrors.label || !!fieldErrors.amount}>
              <Check size={16} />
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={addLoading}>
              <X size={16} />
            </Button>
          </div>
        )}

        {entries.length === 0 && !isAdding && (
          <div className="text-sm text-charcoal-400 dark:text-charcoal-600 py-4 text-center">
            No income entries
          </div>
        )}
      </div>
      </CollapsibleCard>

    <ConfirmModal
      isOpen={deleteConfirmId !== null}
      title="Delete Income"
      message="Are you sure you want to delete this income entry? This action cannot be undone."
      confirmText="Delete"
      cancelText="Cancel"
      isLoading={deleteLoading}
      onConfirm={handleDeleteConfirm}
      onCancel={() => setDeleteConfirmId(null)}
    />
    </>
  );
}


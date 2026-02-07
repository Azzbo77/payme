import { useState } from "react";
import { Plus, Trash2, Edit2, Check, X, Settings, Loader } from "lucide-react";
import { MonthlyFixedExpense, api } from "../api/client";
import { Card } from "./ui/Card";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { ConfirmModal } from "./ConfirmModal";
import { useCurrency } from "../context/CurrencyContext";
import { useToast, useFormValidation, validationRules } from "../hooks";

interface FixedExpensesProps {
  monthId: number;
  expenses: MonthlyFixedExpense[];
  isReadOnly?: boolean;
  onUpdate: () => void;
}

export function FixedExpenses({ monthId, expenses, isReadOnly, onUpdate }: FixedExpensesProps) {
  const { formatCurrency } = useCurrency();
  const { success, error } = useToast();
  const [isManaging, setIsManaging] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);

  const { fieldErrors, validateField, validateAll, clearAll } = useFormValidation({
    label: [validationRules.required("Label"), validationRules.minLength("Label", 1)],
    amount: [validationRules.required("Amount"), validationRules.positive("Amount")],
  });

  const handleAdd = async () => {
    if (!validateAll({ label, amount })) return;
    setAddLoading(true);
    try {
      await api.monthlyFixedExpenses.create(monthId, { label, amount: parseFloat(amount) });
      success(`Expense added: ${label}`);
      setLabel("");
      setAmount("");
      setIsAdding(false);
      clearAll();
      await onUpdate();
    } catch {
      error("Failed to add expense");
    } finally {
      setAddLoading(false);
    }
  };

  const handleUpdate = async (id: number) => {
    if (!validateAll({ label, amount })) return;
    setUpdateLoading(true);
    try {
      await api.monthlyFixedExpenses.update(monthId, id, { label, amount: parseFloat(amount) });
      success("Expense updated");
      setEditingId(null);
      setLabel("");
      setAmount("");
      clearAll();
      await onUpdate();
    } catch {
      error("Failed to update expense");
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
      await api.monthlyFixedExpenses.delete(monthId, deleteConfirmId);
      setDeleteConfirmId(null);
      await onUpdate();
    } catch {
      // Error handling could be added here
    } finally {
      setDeleteLoading(false);
    }
  };

  const startEdit = (expense: MonthlyFixedExpense) => {
    if (isReadOnly) return;
    setEditingId(expense.id);
    setLabel(expense.label);
    setAmount(expense.amount.toString());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setLabel("");
    setAmount("");
    setIsAdding(false);
    clearAll();
  };

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-charcoal-700 dark:text-sand-200">
            Fixed Expenses
          </h3>
          {!isReadOnly && (
            <button
              onClick={() => setIsManaging(true)}
              className="p-1 hover:bg-sand-200 dark:hover:bg-charcoal-800 transition-colors"
            >
              <Settings size={16} />
            </button>
          )}
        </div>

        <div className="space-y-2">
          {expenses.map((expense) => (
            <div
              key={expense.id}
              className="flex items-center justify-between py-2 border-b border-sand-200 dark:border-charcoal-800"
            >
              <span className="text-sm text-charcoal-700 dark:text-sand-300">
                {expense.label}
              </span>
              <span className="text-sm text-charcoal-600 dark:text-charcoal-400">
                {formatCurrency(expense.amount)}
              </span>
            </div>
          ))}
          {expenses.length === 0 && (
            <div className="text-sm text-charcoal-400 dark:text-charcoal-600 py-4 text-center">
              No fixed expenses
            </div>
          )}
        </div>

        {expenses.length > 0 && (
          <div className="mt-4 pt-3 border-t border-sand-300 dark:border-charcoal-700 flex justify-between">
            <span className="text-sm font-medium text-charcoal-600 dark:text-sand-300">
              Total
            </span>
            <span className="text-sm font-semibold text-charcoal-800 dark:text-sand-100">
              {formatCurrency(total)}
            </span>
          </div>
        )}
      </Card>

      <Modal isOpen={isManaging} onClose={() => setIsManaging(false)} title="Manage Fixed Expenses">
        <div className="space-y-3">
          {expenses.map((expense) => (
            <div key={expense.id}>
              {editingId === expense.id ? (
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
                    onClick={() => handleUpdate(expense.id)}
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
                  <span className="text-sm">{expense.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{formatCurrency(expense.amount)}</span>
                    <button
                      onClick={() => startEdit(expense)}
                      className="p-1 hover:bg-sand-200 dark:hover:bg-charcoal-800"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(expense.id)}
                      className="p-1 text-terracotta-500 hover:bg-terracotta-100 dark:hover:bg-charcoal-800"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {isAdding ? (
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
              <Button size="sm" onClick={handleAdd} isLoading={addLoading} disabled={!!fieldErrors.label || !!fieldErrors.amount}>
                <Check size={16} />
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={addLoading}>
                <X size={16} />
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsAdding(true)}
              className="w-full mt-2"
            >
              <Plus size={16} className="mr-2" />
              Add Expense
            </Button>
          )}
        </div>
      </Modal>

      <ConfirmModal
        isOpen={deleteConfirmId !== null}
        title="Delete Expense"
        message="Are you sure you want to delete this fixed expense? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </>
  );
}


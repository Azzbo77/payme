import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Edit2, Check, X, Settings, Loader, AlertCircle } from "lucide-react";
import { MonthlyFixedExpense, FixedExpense, api } from "../api/client";
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
  const [availableTemplates, setAvailableTemplates] = useState<FixedExpense[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  const { fieldErrors, validateField, validateAll, clearAll } = useFormValidation({
    label: [validationRules.required("Label"), validationRules.minLength("Label", 1)],
    amount: [validationRules.required("Amount"), validationRules.positive("Amount")],
  });

  // Load available templates when modal opens
  const loadAvailableTemplates = useCallback(async () => {
    try {
      const templates = await api.monthlyFixedExpenses.getAvailable(monthId);
      setAvailableTemplates(templates);
    } catch {
      error("Failed to load available templates");
    }
  }, [monthId, error]);

  useEffect(() => {
    if (isManaging && availableTemplates.length === 0) {
      loadAvailableTemplates();
    }
  }, [isManaging, availableTemplates.length, loadAvailableTemplates]);

  const handleAddFromTemplate = async (template: FixedExpense) => {
    setAddLoading(true);
    try {
      await api.monthlyFixedExpenses.create(monthId, {
        label: template.label,
        amount: template.amount,
        fixed_expense_id: template.id,
      });
      success(`Added: ${template.label}`);
      setShowTemplates(false);
      await onUpdate();
    } catch {
      error("Failed to add expense");
    } finally {
      setAddLoading(false);
    }
  };

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

  // Get template for an expense to check if price is overridden
  const getTemplateForExpense = (expense: MonthlyFixedExpense): FixedExpense | undefined => {
    if (!expense.fixed_expense_id) return undefined;
    return availableTemplates.find(t => t.id === expense.fixed_expense_id);
  };

  const isPriceOverridden = (expense: MonthlyFixedExpense): boolean => {
    const template = getTemplateForExpense(expense);
    return template ? template.amount !== expense.amount : false;
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
          {expenses.map((expense) => {
            const isOverridden = isPriceOverridden(expense);
            return (
              <div
                key={expense.id}
                className="flex items-center justify-between py-2 border-b border-sand-200 dark:border-charcoal-800"
              >
                <span className="text-sm text-charcoal-700 dark:text-sand-300">
                  {expense.label}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${isOverridden ? 'font-medium text-orange-600 dark:text-orange-400' : 'text-charcoal-600 dark:text-charcoal-400'}`}>
                    {formatCurrency(expense.amount)}
                  </span>
                  {isOverridden && (
                    <div title="Price adjusted from template">
                      <AlertCircle size={14} className="text-orange-600 dark:text-orange-400" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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
        <div className="space-y-4">
          {/* Templates Section */}
          {availableTemplates.length > 0 && (
            <div className="border-b border-sand-200 dark:border-charcoal-800 pb-4">
              <h4 className="text-sm font-semibold text-charcoal-700 dark:text-sand-200 mb-2">
                Quick Add from Templates
              </h4>
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="text-sm text-sage-600 dark:text-sage-400 hover:underline"
              >
                {showTemplates ? "Hide templates" : "Show templates"}
              </button>
              
              {showTemplates && (
                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                  {availableTemplates
                    .filter(t => !expenses.some(e => e.fixed_expense_id === t.id))
                    .map((template) => (
                      <div
                        key={template.id}
                        className="flex items-center justify-between p-2 bg-sand-100 dark:bg-charcoal-800 rounded"
                      >
                        <div>
                          <div className="text-sm font-sans text-charcoal-700 dark:text-sand-300">{template.label}</div>
                          <div className="text-xs font-sans text-charcoal-500 dark:text-charcoal-400">
                            Default: {formatCurrency(template.amount)}
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
                  {availableTemplates.filter(t => !expenses.some(e => e.fixed_expense_id === t.id)).length === 0 && (
                    <div className="text-sm text-charcoal-400 dark:text-charcoal-600 py-2">
                      All templates are already added
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Current Expenses */}
          <div>
            <h4 className="text-sm font-semibold text-charcoal-700 dark:text-sand-200 mb-2">
              Current Expenses
            </h4>
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
                    <div className="flex items-center justify-between py-2 px-2 bg-sand-50 dark:bg-charcoal-900 rounded border border-sand-200 dark:border-charcoal-800">
                      <div className="flex-1">
                        <div className="text-sm text-charcoal-700 dark:text-sand-300">{expense.label}</div>
                        {expense.fixed_expense_id && (
                          <div className="text-xs text-charcoal-500 dark:text-charcoal-400">
                            Template ID: {expense.fixed_expense_id}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${isPriceOverridden(expense) ? 'font-medium text-orange-600 dark:text-orange-400' : 'text-charcoal-600 dark:text-charcoal-400'}`}>
                            {formatCurrency(expense.amount)}
                          </span>
                          {isPriceOverridden(expense) && (
                            <div title="Price adjusted from template">
                              <AlertCircle size={14} className="text-orange-600 dark:text-orange-400" />
                            </div>
                          )}
                        </div>
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
            </div>
          </div>

          {/* Add Custom Expense */}
          <div className="border-t border-sand-200 dark:border-charcoal-800 pt-4">
            {isAdding ? (
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
                className="w-full"
              >
                <Plus size={16} className="mr-2" />
                Add Custom Expense
              </Button>
            )}
          </div>
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


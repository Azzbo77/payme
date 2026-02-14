import { useState, useCallback, useEffect } from "react";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { RecurringItem, BudgetCategory, api } from "../api/client";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { useCurrency } from "../context/CurrencyContext";

interface RecurringItemsProps {
  onClose?: () => void;
}

const SAVINGS_DESTINATIONS = [
  { value: "none", label: "Regular spending" },
  { value: "savings", label: "Savings" },
  { value: "retirement_savings", label: "Retirement savings" },
];

export function RecurringItemsModal({ onClose: _onClose }: RecurringItemsProps) {
  const { formatCurrency } = useCurrency();
  const [items, setItems] = useState<RecurringItem[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form state
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [categoryId, setCategoryId] = useState<string>("");
  const [savingsDestination, setSavingsDestination] = useState("none");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [itemsData, categoriesData] = await Promise.all([
        api.recurringItems.list(),
        api.categories.list(),
      ]);
      setItems(itemsData);
      setCategories(categoriesData);
      setError("");
    } catch {
      setError("Failed to load recurring items");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);

    try {
      const itemData = {
        category_id: parseInt(categoryId),
        description,
        amount: parseFloat(amount),
        day_of_month: parseInt(dayOfMonth),
        savings_destination: savingsDestination,
      };

      if (editingId) {
        await api.recurringItems.update(editingId, itemData);
      } else {
        await api.recurringItems.create(itemData);
      }

      await loadData();
      resetForm();
    } catch {
      setError("Failed to save recurring item");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;

    try {
      await api.recurringItems.delete(deleteConfirmId);
      await loadData();
      setDeleteConfirmId(null);
    } catch {
      setError("Failed to delete recurring item");
    }
  };

  const handleEdit = (item: RecurringItem) => {
    setEditingId(item.id);
    setDescription(item.description);
    setAmount(item.amount.toString());
    setDayOfMonth(item.day_of_month.toString());
    setCategoryId(item.category_id.toString());
    setSavingsDestination(item.savings_destination);
    setIsAdding(true);
  };

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setDescription("");
    setAmount("");
    setDayOfMonth("1");
    setCategoryId("");
    setSavingsDestination("none");
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <p className="text-sage-600 dark:text-sage-400">Loading recurring items...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-200">
          {error}
        </div>
      )}

      {/* List of recurring items */}
      <div className="space-y-3">
        <h3 className="font-semibold text-charcoal-900 dark:text-sand-50">Active Templates</h3>
        {items.length === 0 ? (
          <p className="text-sage-600 dark:text-sage-400 text-sm">No recurring items yet</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const category = categories.find((c) => c.id === item.category_id);
              const destination = SAVINGS_DESTINATIONS.find(
                (d) => d.value === item.savings_destination
              );

              return (
                <div
                  key={item.id}
                  className="p-3 bg-sand-50 dark:bg-charcoal-800 border border-sand-200 dark:border-charcoal-700 rounded-lg flex items-center justify-between"
                >
                  <div className="flex-1">
                    <p className="font-medium text-charcoal-900 dark:text-sand-50">
                      {item.description}
                    </p>
                    <p className="text-sm text-sage-600 dark:text-sage-400">
                      {category?.label || "Unknown category"} • Day {item.day_of_month} •{" "}
                      {formatCurrency(item.amount)} • {destination?.label || "Unknown"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(item)}
                      className="p-2 text-sage-600 hover:bg-sage-100 dark:hover:bg-sage-900 rounded"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(item.id)}
                      className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {deleteConfirmId && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg space-y-3">
          <p className="text-yellow-900 dark:text-yellow-200">Delete this recurring template?</p>
          <div className="flex gap-2">
            <Button
              onClick={handleDelete}
              variant="danger"
              size="sm"
              isLoading={submitLoading}
            >
              Delete
            </Button>
            <Button
              onClick={() => setDeleteConfirmId(null)}
              variant="secondary"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Add/Edit form */}
      {isAdding ? (
        <form onSubmit={handleAddOrUpdate} className="space-y-3 p-4 bg-sand-50 dark:bg-charcoal-800 border border-sand-200 dark:border-charcoal-700 rounded-lg">
          <h4 className="font-semibold text-charcoal-900 dark:text-sand-50">
            {editingId ? "Edit Recurring Item" : "Add Recurring Item"}
          </h4>

          <div>
            <label className="block text-sm font-medium text-charcoal-700 dark:text-sand-200 mb-1">
              Category
            </label>
            <Select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              options={[
                { value: "", label: "Select category..." },
                ...categories.map((c) => ({ value: c.id.toString(), label: c.label })),
              ]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal-700 dark:text-sand-200 mb-1">
              Description
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Weekly groceries"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-charcoal-700 dark:text-sand-200 mb-1">
                Amount
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal-700 dark:text-sand-200 mb-1">
                Day of Month
              </label>
              <Input
                type="number"
                min="1"
                max="31"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                placeholder="1-31"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal-700 dark:text-sand-200 mb-1">
              Destination
            </label>
            <Select
              value={savingsDestination}
              onChange={(e) => setSavingsDestination(e.target.value)}
              options={SAVINGS_DESTINATIONS}
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={submitLoading}
            >
              {editingId ? "Update" : "Add"}
            </Button>
            <Button
              type="button"
              onClick={resetForm}
              variant="secondary"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button
          onClick={() => setIsAdding(true)}
          variant="secondary"
          size="sm"
          className="w-full"
        >
          <Plus size={16} className="mr-2" />
          Add Recurring Item
        </Button>
      )}
    </div>
  );
}

import { useState } from "react";
import { Target, Pencil, Check, X, Trash2, Plus, Loader } from "lucide-react";
import { Card } from "./ui/Card";
import { Input } from "./ui/Input";
import { ProgressBar } from "./ui/ProgressBar";
import { Button } from "./ui/Button";
import { ConfirmModal } from "./ConfirmModal";
import { useLocalStorage, useFormValidation, validationRules } from "../hooks";
import { useCurrency } from "../context/CurrencyContext";

interface SavingsGoal {
  id: string;
  name: string;
  currentAmount: number;
  targetAmount: number;
}

export function CustomSavingsGoals() {
  const { formatCurrency, getCurrencySymbol } = useCurrency();
  
  // Persistent goals with automatic localStorage sync
  const [goals, setGoals] = useLocalStorage<SavingsGoal[]>("customSavingsGoals", []);
  
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("");
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editCurrentAmount, setEditCurrentAmount] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);

  const { fieldErrors: addFieldErrors, validateField: validateAddField, validateAll: validateAddAll, clearAll: clearAddForm } = useFormValidation({
    newGoalName: [validationRules.required("Goal Name"), validationRules.minLength("Goal Name", 1)],
    newGoalTarget: [validationRules.required("Target Amount"), validationRules.positive("Target Amount")],
  });

  const { fieldErrors: editFieldErrors, validateField: validateEditField, validateAll: validateEditAll } = useFormValidation({
    editCurrentAmount: [validationRules.required("Amount"), validationRules.nonNegative("Amount")],
  });

  const addNewGoal = () => {
    if (!validateAddAll({ newGoalName, newGoalTarget })) return;

    setAddLoading(true);
    try {
      const newGoal: SavingsGoal = {
        id: Date.now().toString(),
        name: newGoalName.trim(),
        currentAmount: 0,
        targetAmount: parseFloat(newGoalTarget),
      };

      setGoals([...goals, newGoal]);
      setNewGoalName("");
      setNewGoalTarget("");
      setIsAddingNew(false);
      clearAddForm();
    } finally {
      setAddLoading(false);
    }
  };

  const startEditAmount = (goalId: string, currentAmount: number) => {
    setEditingGoalId(goalId);
    setEditCurrentAmount(currentAmount.toString());
  };

  const cancelEditAmount = () => {
    setEditingGoalId(null);
    setEditCurrentAmount("");
  };

  const saveEditAmount = (goalId: string) => {
    if (!validateEditAll({ editCurrentAmount })) return;

    setUpdateLoading(true);
    try {
      setGoals(goals.map(goal => 
        goal.id === goalId ? { ...goal, currentAmount: parseFloat(editCurrentAmount) } : goal
      ));
      setEditingGoalId(null);
      setEditCurrentAmount("");
    } finally {
      setUpdateLoading(false);
    }
  };

  const deleteGoal = (goalId: string) => {
    setDeleteConfirmId(goalId);
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirmId === null) return;
    setGoals(goals.filter(goal => goal.id !== deleteConfirmId));
    setDeleteConfirmId(null);
  };

  const cancelAddNew = () => {
    setIsAddingNew(false);
    setNewGoalName("");
    setNewGoalTarget("");
    clearAddForm();
  };

  return (
    <>
    <Card className="!p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-sage-600" />
          <span className="text-sm font-semibold text-charcoal-700 dark:text-sand-200">
            Custom Savings Goals
          </span>
        </div>
        {!isAddingNew && (
          <button
            onClick={() => setIsAddingNew(true)}
            className="p-1.5 text-sage-600 hover:bg-sage-100 dark:hover:bg-sage-900 rounded transition-colors touch-manipulation"
            title="Add new goal"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      <div className="space-y-4">
        {goals.length === 0 && !isAddingNew && (
          <p className="text-xs text-charcoal-400 dark:text-charcoal-500 italic text-center py-4">
            No custom savings goals yet. Click + to add one!
          </p>
        )}

        {goals.map((goal) => {
          const percentage = goal.targetAmount > 0 
            ? (goal.currentAmount / goal.targetAmount) * 100 
            : 0;
          const isComplete = goal.currentAmount >= goal.targetAmount;
          const remaining = goal.targetAmount - goal.currentAmount;

          return (
            <div key={goal.id} className="border border-sand-300 dark:border-charcoal-700 rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-charcoal-700 dark:text-sand-200 mb-1">
                    {goal.name}
                  </h4>
                  
                  {editingGoalId === goal.id ? (
                    <div className="flex items-center gap-1 mb-2">
                      <span className="text-xs text-charcoal-500 dark:text-charcoal-400">{getCurrencySymbol()}</span>
                      <Input
                        type="number"
                        value={editCurrentAmount}
                        onChange={(e) => {
                          setEditCurrentAmount(e.target.value);
                          validateEditField("editCurrentAmount", e.target.value);
                        }}
                        error={editFieldErrors.editCurrentAmount}
                        className="flex-1 !py-1 !text-sm"
                        autoFocus
                        placeholder="Current amount"
                      />
                      <button
                        onClick={() => saveEditAmount(goal.id)}
                        disabled={updateLoading}
                        className="p-1 text-sage-600 hover:bg-sage-100 dark:hover:bg-sage-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updateLoading ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
                      </button>
                      <button
                        onClick={cancelEditAmount}
                        disabled={updateLoading}
                        className="p-1 text-charcoal-400 hover:bg-sand-100 dark:hover:bg-charcoal-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-sage-700 dark:text-sage-400">
                        {formatCurrency(goal.currentAmount)}
                      </span>
                      <span className="text-xs text-charcoal-400 dark:text-charcoal-500">
                        / {formatCurrency(goal.targetAmount)}
                      </span>
                      <button
                        onClick={() => startEditAmount(goal.id, goal.currentAmount)}
                        className="p-1 text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-200 transition-colors ml-auto"
                        title="Edit current amount"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => deleteGoal(goal.id)}
                        className="p-1 text-terracotta-500 hover:text-terracotta-600 dark:hover:text-terracotta-400 transition-colors"
                        title="Delete goal"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}

                  <ProgressBar 
                    value={goal.currentAmount} 
                    max={goal.targetAmount}
                    showOverage={false}
                    invertColors={true}
                  />

                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-xs font-medium ${
                      isComplete 
                        ? 'text-sage-600 dark:text-sage-400' 
                        : 'text-charcoal-500 dark:text-charcoal-400'
                    }`}>
                      {isComplete ? '✓ Complete!' : `${percentage.toFixed(1)}% complete`}
                    </span>
                    {!isComplete && (
                      <span className="text-xs text-charcoal-400 dark:text-charcoal-500">
                        {formatCurrency(remaining)} to go
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {isAddingNew && (
          <div className="border-2 border-dashed border-sage-300 dark:border-sage-700 rounded-lg p-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-charcoal-600 dark:text-charcoal-300 mb-1">
                Goal Name
              </label>
              <Input
                type="text"
                value={newGoalName}
                onChange={(e) => {
                  setNewGoalName(e.target.value);
                  validateAddField("newGoalName", e.target.value);
                }}
                error={addFieldErrors.newGoalName}
                placeholder="e.g., Emergency Fund, Vacation, New Car"
                className="w-full"
                autoFocus
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-charcoal-600 dark:text-charcoal-300 mb-1">
                Target Amount
              </label>
              <Input
                type="number"
                value={newGoalTarget}
                onChange={(e) => {
                  setNewGoalTarget(e.target.value);
                  validateAddField("newGoalTarget", e.target.value);
                }}
                error={addFieldErrors.newGoalTarget}
                placeholder="0.00"
                className="w-full"
              />
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={addNewGoal}
                className="flex-1"
                disabled={!!addFieldErrors.newGoalName || !!addFieldErrors.newGoalTarget}
                isLoading={addLoading}
              >
                Add Goal
              </Button>
              <Button 
                onClick={cancelAddNew}
                className="flex-1 bg-sand-200 text-charcoal-700 hover:bg-sand-300 dark:bg-charcoal-700 dark:text-sand-200 dark:hover:bg-charcoal-600"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
    <ConfirmModal
      isOpen={deleteConfirmId !== null}
      title="Delete Savings Goal"
      message="Are you sure you want to delete this savings goal? This action cannot be undone."
      confirmText="Delete"
      cancelText="Cancel"
      onConfirm={handleDeleteConfirm}
      onCancel={() => setDeleteConfirmId(null)}
    />
    </>  );
}

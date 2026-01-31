import { useState, useEffect } from "react";
import { TrendingUp, Pencil, Check, X, Info } from "lucide-react";
import { api } from "../api/client";
import { Card } from "./ui/Card";
import { Input } from "./ui/Input";
import { Modal } from "./ui/Modal";
import { useCurrency } from "../context/CurrencyContext";

export function RetirementSavingsCard({ refreshTrigger }: { refreshTrigger?: number }) {
  const [amount, setAmount] = useState<number>(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [showInfoModal, setShowInfoModal] = useState(false);

  const { formatCurrency } = useCurrency();

  useEffect(() => {
    api.retirementSavings.get().then((res) => setAmount(res.retirement_savings));
  }, [refreshTrigger]);

  const startEdit = () => {
    setEditValue(amount.toString());
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditValue("");
  };

  const saveEdit = async () => {
    const value = parseFloat(editValue);
    if (isNaN(value)) return;
    await api.retirementSavings.update(value);
    setAmount(value);
    setIsEditing(false);
  };

  return (
    <>
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-xs text-charcoal-500 dark:text-charcoal-400">
              Retirement Savings
            </span>
            <button
              onClick={() => setShowInfoModal(true)}
              className="p-0.5 hover:bg-sand-200 dark:hover:bg-charcoal-700 rounded transition-colors touch-manipulation"
              title="How this works"
            >
              <Info size={12} className="text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-300" />
            </button>
          </div>

          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-28 !py-1"
                autoFocus
              />
              <button
                onClick={saveEdit}
                className="p-1 text-sage-600 hover:bg-sage-100 dark:hover:bg-sage-900 transition-colors"
              >
                <Check size={16} />
              </button>
              <button
                onClick={cancelEdit}
                className="p-1 text-charcoal-400 hover:bg-sand-100 dark:hover:bg-charcoal-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold text-sage-600 dark:text-sage-400">
                {formatCurrency(amount)}
              </span>
              <button
                onClick={startEdit}
                className="p-1 text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-200 transition-colors"
              >
                <Pencil size={14} />
              </button>
            </div>
          )}
        </div>
        <TrendingUp size={20} className="text-sage-600 dark:text-sage-400" />
      </div>
    </Card>

    <Modal isOpen={showInfoModal} onClose={() => setShowInfoModal(false)} title="Retirement Savings">
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-charcoal-700 dark:text-sand-200 mb-2">
            Long-term Tracking
          </h3>
          <p className="text-sm text-charcoal-600 dark:text-charcoal-300">
            Track long-term retirement contributions separately from your general savings account. This helps monitor your retirement fund growth over time.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-charcoal-700 dark:text-sand-200 mb-2">
            Direct Transfers
          </h3>
          <p className="text-sm text-charcoal-600 dark:text-charcoal-300">
            Direct spending items to retirement savings using the Transferred Items section to grow your retirement fund.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-charcoal-700 dark:text-sand-200 mb-2">
            Manual Adjustments
          </h3>
          <p className="text-sm text-charcoal-600 dark:text-charcoal-300">
            Manually adjust the amount to reflect contributions, portfolio changes, or other adjustments.
          </p>
        </div>
      </div>
    </Modal>
    </>
  );
}
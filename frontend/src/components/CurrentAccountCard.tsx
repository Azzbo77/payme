import { useState, useEffect } from "react";
import { Banknote, Pencil, Check, X, Send } from "lucide-react";
import { api, CurrentAccountBalance } from "../api/client";
import { Card } from "./ui/Card";
import { Input } from "./ui/Input";
import { useCurrency } from "../context/CurrencyContext";
import { useCardEdit } from "../hooks/useCardEdit";
import { TransferFromCurrentModal } from "./TransferFromCurrentModal";

interface CurrentAccountCardProps {
  monthId: number;
  initialBalance?: CurrentAccountBalance | null;
  isReadOnly?: boolean;
  onUpdate?: (balance: number) => void;
  onTransferComplete?: () => void | Promise<void>;
}

export function CurrentAccountCard({ 
  monthId, 
  initialBalance, 
  isReadOnly, 
  onUpdate,
  onTransferComplete
}: CurrentAccountCardProps) {
  const [balance, setBalance] = useState<number>(initialBalance?.balance ?? 0);
  const [showTransferModal, setShowTransferModal] = useState(false);

  const { formatCurrency } = useCurrency();

  const { isEditing, editValue, isLoading, startEdit: _startEdit, cancelEdit, saveEdit: _saveEdit, setEditValue } = useCardEdit({
    initialValue: balance,
    onSave: async (value) => {
      const updated = await api.monthlyCurrentAccount.update(monthId, value);
      setBalance(updated.balance);
      onUpdate?.(updated.balance);
    },
  });

  const startEdit = () => {
    if (isReadOnly) return;
    _startEdit();
  };

  useEffect(() => {
    if (initialBalance) {
      setBalance(initialBalance.balance);
      return;
    }
    api.monthlyCurrentAccount.get(monthId).then((res) => {
      setBalance(res.balance);
      onUpdate?.(res.balance);
    });
  }, [monthId, initialBalance, onUpdate]);

  const isNegative = balance < 0;

  return (
    <Card className="!p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Banknote 
            size={16} 
            className={isNegative 
              ? "text-terracotta-600 dark:text-terracotta-400" 
              : "text-blue-600 dark:text-blue-400"
            } 
          />
          <span className="text-xs text-charcoal-500 dark:text-charcoal-400">
            Current Account
          </span>
        </div>
        {!isReadOnly && (
          <button
            onClick={startEdit}
            className="p-1 hover:bg-sand-200 dark:hover:bg-charcoal-800 transition-colors"
            title="Edit balance"
          >
            <Pencil size={14} />
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <Input
            type="number"
            step="0.01"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="0.00"
            disabled={isLoading}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={_saveEdit}
              disabled={isLoading}
              className="flex-1 p-1.5 bg-sage-600 dark:bg-sage-500 hover:bg-sage-700 dark:hover:bg-sage-600 text-white rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
              title="Save"
            >
              <Check size={14} />
            </button>
            <button
              onClick={cancelEdit}
              disabled={isLoading}
              className="flex-1 p-1.5 bg-charcoal-200 dark:bg-charcoal-700 hover:bg-charcoal-300 dark:hover:bg-charcoal-600 rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
              title="Cancel"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className={`text-lg sm:text-xl font-semibold ${
            isNegative 
              ? "text-terracotta-600 dark:text-terracotta-400" 
              : "text-blue-600 dark:text-blue-400"
          }`}>
            {formatCurrency(balance, { absolute: true })}
            {isNegative && <span className="text-xs ml-1">overdraft</span>}
          </div>
          {!isReadOnly && balance > 0 && (
            <button
              onClick={() => setShowTransferModal(true)}
              className="w-full p-2 bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded transition-colors text-sm font-medium flex items-center justify-center gap-2"
              title="Transfer to savings or retirement"
            >
              <Send size={14} />
              Transfer
            </button>
          )}
        </div>
      )}

      <TransferFromCurrentModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        monthId={monthId}
        currentBalance={balance}
        onTransferSuccess={async () => {
          const updated = await api.monthlyCurrentAccount.get(monthId);
          setBalance(updated.balance);
          onUpdate?.(updated.balance);
          if (onTransferComplete) {
            await onTransferComplete();
          }
        }}
      />
    </Card>
  );
}

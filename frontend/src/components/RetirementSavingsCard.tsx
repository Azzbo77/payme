import { useState, useEffect } from "react";
import { TrendingUp, Pencil, Check, X } from "lucide-react";
import { api, RetirementBreakdownItem } from "../api/client";
import { Card } from "./ui/Card";
import { Input } from "./ui/Input";
import { useCardEdit } from "../hooks/useCardEdit";
import { useCurrency } from "../context/CurrencyContext";
import { convertUSDPrice } from "../services/stockService";

interface RetirementSavingsCardProps {
  monthId?: number;
  refreshTrigger?: number;
}

export function RetirementSavingsCard({ refreshTrigger }: RetirementSavingsCardProps) {
  const [amount, setAmount] = useState<number>(0);
  const [conversionRate, setConversionRate] = useState<number>(1);
  const { formatCurrency, currency } = useCurrency();
  const [breakdownItems, setBreakdownItems] = useState<RetirementBreakdownItem[]>([]);

  // Fetch conversion rate when currency changes
  useEffect(() => {
    const fetchConversionRate = async () => {
      if (currency.code === "USD") {
        setConversionRate(1);
        return;
      }

      try {
        const converted = await convertUSDPrice(1, currency.code);
        setConversionRate(converted);
      } catch {
        setConversionRate(1); // Fallback to 1:1 if conversion fails
      }
    };

    fetchConversionRate();
  }, [currency.code]);

  const { isEditing, editValue, startEdit, cancelEdit, saveEdit, setEditValue } = useCardEdit({
    initialValue: amount,
    onSave: async (value) => {
      await api.retirementSavings.update(value);
      setAmount(value);
    },
  });

  // Load retirement savings and breakdown items on mount and when refreshTrigger changes
  useEffect(() => {
    const loadData = async () => {
      try {
        const [savingsRes, breakdownRes] = await Promise.all([
          api.retirementSavings.get(),
          api.retirementBreakdown.list(),
        ]);
        setAmount(savingsRes.retirement_savings);
        setBreakdownItems(breakdownRes);
      } catch (err) {
        console.error("Failed to load retirement data:", err);
      }
    };

    loadData();
  }, [refreshTrigger]);

  const breakdownTotal = breakdownItems.reduce((sum, item) => sum + item.amount, 0);
  const totalAmountUSD = amount + breakdownTotal;
  const totalAmount = totalAmountUSD * conversionRate;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-charcoal-500 dark:text-charcoal-400 mb-1">
            Retirement Savings
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
                className="p-1 text-sage-600 hover:bg-sage-100 dark:hover:bg-sage-900 transition-colors rounded"
              >
                <Check size={16} />
              </button>
              <button
                onClick={cancelEdit}
                className="p-1 text-charcoal-400 hover:bg-sand-100 dark:hover:bg-charcoal-800 transition-colors rounded"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-xl font-semibold text-sage-600 dark:text-sage-400">
                {formatCurrency(totalAmount)}
              </span>
              <button
                onClick={startEdit}
                className="p-1 text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-200 transition-colors rounded"
              >
                <Pencil size={14} />
              </button>
            </div>
          )}
        </div>
        <TrendingUp size={20} className="text-sage-600 dark:text-sage-400 flex-shrink-0" />
      </div>
    </Card>
  );
}

import { useState } from "react";
import { api } from "../api/client";
import { Modal } from "./ui/Modal";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { useCurrency } from "../context/CurrencyContext";
import { useToast } from "../hooks";

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthId: number;
  currentBalance: number;
  onTransferSuccess: () => Promise<void>;
}

export function TransferFromCurrentModal({
  isOpen,
  onClose,
  monthId,
  currentBalance,
  onTransferSuccess,
}: TransferModalProps) {
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState<"savings" | "retirement_savings">("savings");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { formatCurrency } = useCurrency();
  const { success, error: showError } = useToast();

  const handleTransfer = async () => {
    setError("");
    
    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (transferAmount > currentBalance) {
      setError(`Insufficient balance. Current balance: ${formatCurrency(currentBalance)}`);
      return;
    }

    setLoading(true);
    try {
      await api.monthlyCurrentAccount.transfer(monthId, transferAmount, destination);
      success(`Transferred ${formatCurrency(transferAmount)} to ${destination}`);
      setAmount("");
      setDestination("savings");
      await onTransferSuccess();
      onClose();
    } catch {
      showError("Failed to transfer. Please try again.");
      setError("Failed to transfer. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Transfer from Current Account">
      <div className="space-y-4">
        <div>
          <p className="text-sm text-charcoal-600 dark:text-charcoal-300 mb-2">
            Available balance: <span className="font-semibold">{formatCurrency(currentBalance)}</span>
          </p>
        </div>

        <Input
          label="Amount to Transfer"
          type="number"
          step="0.01"
          min="0"
          max={currentBalance}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          disabled={loading}
        />

        <div>
          <label className="block text-sm font-medium text-charcoal-700 dark:text-sand-200 mb-2">
            Transfer To
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 p-2 rounded border border-sand-200 dark:border-charcoal-700 cursor-pointer hover:bg-sand-50 dark:hover:bg-charcoal-800">
              <input
                type="radio"
                name="destination"
                value="savings"
                checked={destination === "savings"}
                onChange={(e) => setDestination(e.target.value as "savings")}
                disabled={loading}
                className="cursor-pointer"
              />
              <span className="text-sm text-charcoal-700 dark:text-sand-200">Savings Account</span>
            </label>
            <label className="flex items-center gap-2 p-2 rounded border border-sand-200 dark:border-charcoal-700 cursor-pointer hover:bg-sand-50 dark:hover:bg-charcoal-800">
              <input
                type="radio"
                name="destination"
                value="retirement_savings"
                checked={destination === "retirement_savings"}
                onChange={(e) => setDestination(e.target.value as "retirement_savings")}
                disabled={loading}
                className="cursor-pointer"
              />
              <span className="text-sm text-charcoal-700 dark:text-sand-200">Retirement Savings</span>
            </label>
          </div>
        </div>

        {error && <p className="text-sm text-terracotta-600">{error}</p>}

        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleTransfer}
            disabled={loading || !amount}
            className="flex-1"
          >
            {loading ? "Transferring..." : "Transfer"}
          </Button>
          <Button
            onClick={onClose}
            variant="ghost"
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

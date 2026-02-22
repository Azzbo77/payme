import { useState, useEffect } from "react";
import { Trash2, Edit2, Check, X, Loader, RefreshCw } from "lucide-react";
import { Card } from "./ui/Card";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { ConfirmModal } from "./ConfirmModal";
import { useToast } from "../hooks";
import { useCurrency } from "../context/CurrencyContext";
import { useUIPreferences } from "../context/UIPreferencesContext";
import { api, RetirementBreakdownItem } from "../api/client";
import { getStockPrice } from "../services/stockService";

export function RetirementBreakdownCard() {
  const { formatCurrency } = useCurrency();
  const { retirementBreakdownEnabled, stockTrackingEnabled } = useUIPreferences();
  const { success, error } = useToast();

  // Helper function to format USD prices
  const formatUSDPrice = (usdPrice: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(usdPrice);
  };

  const [breakdownItems, setBreakdownItems] = useState<RetirementBreakdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [addMode, setAddMode] = useState<"custom" | "stock">("custom");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [ticker, setTicker] = useState("");
  const [quantity, setQuantity] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [priceLoading, setPriceLoading] = useState<number | null>(null);

  // Load items from API on mount and when enabled status changes
  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const items = await api.retirementBreakdown.list();
      setBreakdownItems(items);
    } catch (err) {
      console.error("Failed to load retirement breakdown:", err);
      error("Failed to load retirement breakdown");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (addMode === "custom") {
      // Simple validation
      if (!label.trim() || !amount.trim()) {
        error("Please fill in all fields");
        return;
      }
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        error("Amount must be a positive number");
        return;
      }

      setAddLoading(true);
      try {
        const newItem = await api.retirementBreakdown.create({
          label,
          amount: numAmount,
          type: "custom",
        });
        setBreakdownItems([...breakdownItems, newItem]);
        success(`Added: ${label}`);
        resetForm();
      } catch (err) {
        console.error("Error adding item:", err);
        error("Failed to add item");
      } finally {
        setAddLoading(false);
      }
    } else {
      // Stock mode
      if (!ticker.trim() || !quantity.trim()) {
        error("Please enter ticker and quantity");
        return;
      }
      const numQuantity = parseFloat(quantity);
      if (isNaN(numQuantity) || numQuantity <= 0) {
        error("Quantity must be a positive number");
        return;
      }

      setAddLoading(true);
      try {
        const upperTicker = ticker.toUpperCase();
        const usdPrice = await getStockPrice(upperTicker);

        const newItem = await api.retirementBreakdown.create({
          label: upperTicker,
          ticker: upperTicker,
          quantity: numQuantity,
          current_price: usdPrice,
          amount: usdPrice * numQuantity,
          type: "stock",
          last_updated: Date.now(),
        });
        setBreakdownItems([...breakdownItems, newItem]);
        success(`Added ${quantity} shares of ${upperTicker} at ${formatUSDPrice(usdPrice)}`);
        resetForm();
      } catch (err) {
        console.error("Error adding stock:", err);
        error(`Failed to add stock: ${err instanceof Error ? err.message : "Unknown error"}`);
      } finally {
        setAddLoading(false);
      }
    }
  };

  const handleRefreshPrices = async () => {
    const stockItems = breakdownItems.filter((item) => item.type === "stock");
    if (stockItems.length === 0) return;

    for (const item of stockItems) {
      if (item.ticker) {
        setPriceLoading(item.id);
        try {
          const usdPrice = await getStockPrice(item.ticker, true);
          const updated = await api.retirementBreakdown.update(item.id, {
            label: item.label,
            amount: usdPrice * (item.quantity || 0),
            type: item.type,
            ticker: item.ticker,
            quantity: item.quantity,
            current_price: usdPrice,
            last_updated: Date.now(),
          });
          setBreakdownItems(
            breakdownItems.map((i) => (i.id === item.id ? updated : i))
          );
        } catch (err) {
          console.error(`Failed to refresh ${item.ticker}:`, err);
          error(`Failed to refresh ${item.ticker}`);
        } finally {
          setPriceLoading(null);
        }
      }
    }
  };

  const handleUpdate = async (id: number) => {
    const item = breakdownItems.find((i) => i.id === id);
    if (!item) return;

    if (item.type === "stock") {
      if (!ticker.trim() || !quantity.trim()) {
        error("Please enter ticker and quantity");
        return;
      }
      const numQuantity = parseFloat(quantity);
      if (isNaN(numQuantity) || numQuantity <= 0) {
        error("Quantity must be a positive number");
        return;
      }
    } else {
      if (!label.trim() || !amount.trim()) {
        error("Please fill in all fields");
        return;
      }
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        error("Amount must be a positive number");
        return;
      }
    }

    setUpdateLoading(true);
    try {
      if (item.type === "stock") {
        const numQuantity = parseFloat(quantity);
        const usdPrice = await getStockPrice(ticker.toUpperCase(), true);
        const updated = await api.retirementBreakdown.update(id, {
          label: ticker.toUpperCase(),
          ticker: ticker.toUpperCase(),
          quantity: numQuantity,
          current_price: usdPrice,
          amount: usdPrice * numQuantity,
          type: "stock",
          last_updated: Date.now(),
        });
        setBreakdownItems(
          breakdownItems.map((i) => (i.id === id ? updated : i))
        );
        success(`Updated ${quantity} shares of ${ticker.toUpperCase()}`);
      } else {
        const numAmount = parseFloat(amount);
        const updated = await api.retirementBreakdown.update(id, {
          label,
          amount: numAmount,
          type: "custom",
        });
        setBreakdownItems(
          breakdownItems.map((i) => (i.id === id ? updated : i))
        );
        success(`Updated: ${label}`);
      }
      resetForm();
    } catch (err) {
      console.error("Error updating item:", err);
      error(`Failed to update: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleDelete = (id: number) => {
    setDeleteConfirmId(id);
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirmId === null) return;
    try {
      await api.retirementBreakdown.delete(deleteConfirmId);
      setBreakdownItems(breakdownItems.filter((item) => item.id !== deleteConfirmId));
      success("Item deleted");
    } catch (err) {
      console.error("Failed to delete item:", err);
      error("Failed to delete item");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const startEdit = (item: RetirementBreakdownItem) => {
    setEditingId(item.id);
    if (item.type === "stock") {
      setAddMode("stock");
      setTicker(item.ticker || "");
      setQuantity(item.quantity?.toString() || "");
      setLabel("");
      setAmount("");
    } else {
      setAddMode("custom");
      setLabel(item.label);
      setAmount(item.amount.toString());
      setTicker("");
      setQuantity("");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setLabel("");
    setAmount("");
    setTicker("");
    setQuantity("");
    setIsAdding(false);
    setAddMode("custom");
  };

  if (!retirementBreakdownEnabled && breakdownItems.length === 0) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-8">
          <Loader size={20} className="animate-spin text-charcoal-400" />
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-charcoal-700 dark:text-sand-200">
              Retirement Savings Breakdown
            </h3>
          </div>
          <div className="flex gap-2">
            {breakdownItems.some((item) => item.type === "stock") && (
              <button
                onClick={handleRefreshPrices}
                disabled={priceLoading !== null}
                className="p-2 md:p-1 hover:bg-sand-200 dark:hover:bg-charcoal-800 active:bg-sand-300 dark:active:bg-charcoal-700 transition-colors rounded touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh stock prices"
              >
                <RefreshCw size={14} className={priceLoading ? "animate-spin" : ""} />
              </button>
            )}
            {!isAdding && retirementBreakdownEnabled && (
              <button
                onClick={() => {
                  setIsAdding(true);
                }}
                className="p-2 md:p-1 hover:bg-sand-200 dark:hover:bg-charcoal-800 active:bg-sand-300 dark:active:bg-charcoal-700 transition-colors rounded touch-manipulation"
              >
                <span className="text-lg">+</span>
              </button>
            )}
          </div>
        </div>

        {isAdding && (
          <div className="mb-4 p-4 bg-sand-100 dark:bg-charcoal-800">
            <div className="mb-3 flex gap-2">
              <button
                onClick={() => setAddMode("custom")}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  addMode === "custom"
                    ? "bg-sage-600 text-white dark:bg-sage-500"
                    : "bg-sand-200 dark:bg-charcoal-700 text-charcoal-700 dark:text-sand-200"
                }`}
              >
                Custom
              </button>
              {stockTrackingEnabled && (
                <button
                  onClick={() => setAddMode("stock")}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    addMode === "stock"
                      ? "bg-sage-600 text-white dark:bg-sage-500"
                      : "bg-sand-200 dark:bg-charcoal-700 text-charcoal-700 dark:text-sand-200"
                  }`}
                >
                  Stock
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {addMode === "custom" ? (
                <>
                  <Input
                    placeholder="Account/Source"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </>
              ) : (
                <>
                  <Input
                    placeholder="Ticker (e.g., AAPL, MSFT)"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  />
                  <Input
                    type="number"
                    placeholder="Quantity"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleAdd}
                isLoading={addLoading}
                disabled={addLoading}
              >
                <Check size={16} className="mr-1" />
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={resetForm} disabled={addLoading}>
                <X size={16} className="mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand-300 dark:border-charcoal-700">
                <th className="text-left py-2 px-1 font-medium text-charcoal-600 dark:text-sand-400 text-xs md:text-sm">
                  Account/Source
                </th>
                <th className="text-right py-2 px-1 font-medium text-charcoal-600 dark:text-sand-400 text-xs md:text-sm">
                  Quantity
                </th>
                <th className="text-right py-2 px-1 font-medium text-charcoal-600 dark:text-sand-400 text-xs md:text-sm">
                  Price/Amount
                </th>
                <th className="text-right py-2 px-1 font-medium text-charcoal-600 dark:text-sand-400 text-xs md:text-sm">
                  Total
                </th>
                {retirementBreakdownEnabled && <th className="w-16 md:w-20"></th>}
              </tr>
            </thead>
            <tbody>
              {breakdownItems.map((item) => {
                const isStock = item.type === "stock";
                const isEditing = editingId === item.id;

                return (
                  <tr
                    key={item.id}
                    className="border-b border-sand-200 dark:border-charcoal-800 hover:bg-sand-100 dark:hover:bg-charcoal-900/50 active:bg-sand-200 dark:active:bg-charcoal-900 transition-colors"
                  >
                    {isEditing ? (
                      <>
                        {isStock ? (
                          <>
                            <td className="py-2">
                              <Input
                                placeholder="Ticker"
                                value={ticker}
                                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                                className="text-xs"
                              />
                            </td>
                            <td className="py-2">
                              <Input
                                type="number"
                                placeholder="Quantity"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                className="text-xs text-right"
                              />
                            </td>
                            <td className="py-2 px-1 text-right font-medium text-xs md:text-sm text-charcoal-600 dark:text-sand-300">
                              {item.current_price ? `$${item.current_price.toFixed(2)} USD` : "—"}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-2">
                              <Input
                                placeholder="Label"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                className="text-xs"
                              />
                            </td>
                            <td colSpan={2}></td>
                            <td className="py-2">
                              <Input
                                type="number"
                                placeholder="Amount"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="text-xs text-right"
                              />
                            </td>
                          </>
                        )}
                        <td className="py-2">
                          <div className="flex gap-0.5 md:gap-1 justify-end">
                            <button
                              onClick={() => handleUpdate(item.id)}
                              disabled={updateLoading}
                              className="p-2 md:p-1 text-sage-600 hover:bg-sage-100 dark:hover:bg-charcoal-800 active:bg-sage-200 dark:active:bg-charcoal-700 transition-colors rounded touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {updateLoading ? (
                                <Loader size={14} className="animate-spin" />
                              ) : (
                                <Check size={14} />
                              )}
                            </button>
                            <button
                              onClick={resetForm}
                              disabled={updateLoading}
                              className="p-2 md:p-1 text-charcoal-500 hover:bg-sand-200 dark:hover:bg-charcoal-800 active:bg-sand-300 dark:active:bg-charcoal-700 transition-colors rounded touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 px-1 text-charcoal-800 dark:text-sand-200 text-xs md:text-sm font-medium">
                          {item.label}
                          {isStock && item.last_updated && (
                            <div className="text-xs text-charcoal-500 dark:text-charcoal-400">
                              Updated: {new Date(item.last_updated).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-1 text-right font-medium text-xs md:text-sm whitespace-nowrap text-charcoal-600 dark:text-sand-300">
                          {isStock ? item.quantity : "—"}
                        </td>
                        <td className="py-2 px-1 text-right font-medium text-xs md:text-sm whitespace-nowrap text-charcoal-600 dark:text-sand-300">
                          {isStock ? formatUSDPrice(item.current_price || 0) : "—"}
                        </td>
                        <td className="py-2 px-1 text-right font-medium text-xs md:text-sm whitespace-nowrap text-sage-600 dark:text-sage-400">
                          {isStock ? formatUSDPrice(item.amount || 0) : formatCurrency(item.amount)}
                        </td>
                        {retirementBreakdownEnabled && (
                          <td className="py-2 px-1">
                            <div className="flex gap-0.5 md:gap-1 justify-end">
                              <button
                                onClick={() => startEdit(item)}
                                className="p-2 md:p-1 hover:bg-sand-200 dark:hover:bg-charcoal-800 active:bg-sand-300 dark:active:bg-charcoal-700 transition-colors rounded touch-manipulation"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="p-2 md:p-1 text-terracotta-500 hover:bg-terracotta-100 dark:hover:bg-charcoal-800 active:bg-terracotta-200 dark:active:bg-charcoal-700 transition-colors rounded touch-manipulation"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {breakdownItems.length === 0 && (
            <div className="text-sm text-charcoal-400 dark:text-charcoal-600 py-8 text-center">
              No breakdown items. Add items to track what makes up your retirement savings.
            </div>
          )}
        </div>
      </Card>

      <ConfirmModal
        isOpen={deleteConfirmId !== null}
        title="Delete Item"
        message="Are you sure you want to delete this breakdown item?"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </>
  );
}

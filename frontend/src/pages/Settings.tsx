import { useState } from "react";
import { Layout } from "../components/Layout";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Modal } from "../components/ui/Modal";
import { RecurringItemsModal } from "../components/RecurringItems";
import { useAuth } from "../context/AuthContext";
import { useCurrency, SUPPORTED_CURRENCIES } from "../context/CurrencyContext";
import { useUIPreferences } from "../context/UIPreferencesContext";
import { api, RecurringWage, FixedExpense } from "../api/client";
import { ArrowLeft, Info, Eye, EyeOff, Trash2 } from "lucide-react";

interface SettingsProps {
  onBack: () => void;
  from?: "dashboard" | "summary";
}

export function Settings({ onBack, from = "dashboard" }: SettingsProps) {
  const { user, logout, updateUsername } = useAuth();
  const { currency, setCurrency, formatCurrency } = useCurrency();
  const { transfersEnabled, setTransfersEnabled, retirementBreakdownEnabled, setRetirementBreakdownEnabled, recurringWagesEnabled, setRecurringWagesEnabled, currentAccountEnabled, setCurrentAccountEnabled, customSavingsGoalsEnabled, setCustomSavingsGoalsEnabled, fixedExpensesEnabled, setFixedExpensesEnabled, recurringItemsEnabled, setRecurringItemsEnabled, stockTrackingEnabled, setStockTrackingEnabled, portfolioEncryptionPassphrase, setPortfolioEncryptionPassphrase } = useUIPreferences();
  const [newUsername, setNewUsername] = useState(user?.username || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [usernameSuccess, setUsernameSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [currencySuccess, setCurrencySuccess] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState(currency.code);
  const [showTransfersModal, setShowTransfersModal] = useState(false);
  const [showRetirementBreakdownModal, setShowRetirementBreakdownModal] = useState(false);
  const [showRecurringWagesInfoModal, setShowRecurringWagesInfoModal] = useState(false);
  const [showCurrentAccountInfoModal, setShowCurrentAccountInfoModal] = useState(false);
  const [showCustomSavingsGoalsInfoModal, setShowCustomSavingsGoalsInfoModal] = useState(false);
  const [showFixedExpensesInfoModal, setShowFixedExpensesInfoModal] = useState(false);
  const [showStockFeatureModal, setShowStockFeatureModal] = useState(false);
  const [showPortfolioEncryptionModal, setShowPortfolioEncryptionModal] = useState(false);
  const [showEncryptionInfoModal, setShowEncryptionInfoModal] = useState(false);
  const [portfolioPassphrase, setPortfolioPassphrase] = useState(portfolioEncryptionPassphrase || "");
  const [portfolioPassphraseVisible, setPortfolioPassphraseVisible] = useState(false);
  
  // Recurring wages state
  const [recurringWages, setRecurringWages] = useState<RecurringWage[]>([]);
  const [showRecurringWagesManageModal, setShowRecurringWagesManageModal] = useState(false);
  const [recurringWagesLoaded, setRecurringWagesLoaded] = useState(false);
  const [wageLabel, setWageLabel] = useState("Wages");
  const [wageAmount, setWageAmount] = useState("");
  const [wageEffectiveFrom, setWageEffectiveFrom] = useState("");
  const [wageLoading, setWageLoading] = useState(false);
  const [wageError, setWageError] = useState("");

  // Fixed expenses state
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [showFixedExpensesManageModal, setShowFixedExpensesManageModal] = useState(false);
  const [fixedExpensesLoaded, setFixedExpensesLoaded] = useState(false);
  const [expenseLabel, setExpenseLabel] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseAutoGenerate, setExpenseAutoGenerate] = useState(false);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseError, setExpenseError] = useState("");

  // Recurring items state
  const [showRecurringItemsManageModal, setShowRecurringItemsManageModal] = useState(false);
  const [showRecurringItemsInfoModal, setShowRecurringItemsInfoModal] = useState(false);

  // Payday state
  const [payday, setPayday] = useState<number | null>(null);
  const [paydayModeEnabled, setPaydayModeEnabled] = useState(true);
  const [showPaydayInfoModal, setShowPaydayInfoModal] = useState(false);
  const [paydayLoading, setPaydayLoading] = useState(false);
  const [paydayError, setPaydayError] = useState("");
  const [paydaySuccess, setPaydaySuccess] = useState(false);
  const [paydayLoaded, setPaydayLoaded] = useState(false);

  const loadRecurringWages = async () => {
    try {
      const wages = await api.recurringWages.list();
      setRecurringWages(wages);
      setRecurringWagesLoaded(true);
    } catch {
      setWageError("Failed to load recurring wages");
    }
  };

  const handleAddRecurringWage = async (e: React.FormEvent) => {
    e.preventDefault();
    setWageError("");

    if (!wageAmount || !wageEffectiveFrom) {
      setWageError("Please fill in all fields");
      return;
    }

    if (parseFloat(wageAmount) <= 0) {
      setWageError("Wage amount must be greater than 0");
      return;
    }

    setWageLoading(true);
    try {
      await api.recurringWages.create({
        amount: parseFloat(wageAmount),
        label: wageLabel || "Wages",
        effective_from: wageEffectiveFrom,
      });
      // Reload wages
      await loadRecurringWages();
      // Reset form
      setWageLabel("Wages");
      setWageAmount("");
      setWageEffectiveFrom("");
      setWageError("");
    } catch {
      setWageError("Failed to add recurring wage");
    } finally {
      setWageLoading(false);
    }
  };

  const handleDeleteRecurringWage = async (id: number) => {
    if (!confirm("Are you sure you want to delete this wage entry?")) {
      return;
    }

    try {
      await api.recurringWages.delete(id);
      await loadRecurringWages();
    } catch {
      setWageError("Failed to delete recurring wage");
    }
  };

  const openRecurringWagesModal = async () => {
    setShowRecurringWagesManageModal(true);
    if (!recurringWagesLoaded) {
      await loadRecurringWages();
    }
  };

  const loadFixedExpenses = async () => {
    try {
      const expenses = await api.fixedExpenses.list();
      setFixedExpenses(expenses);
      setFixedExpensesLoaded(true);
    } catch {
      setExpenseError("Failed to load fixed expenses");
    }
  };

  const handleAddFixedExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError("");

    if (!expenseLabel || !expenseAmount) {
      setExpenseError("Please fill in all fields");
      return;
    }

    if (parseFloat(expenseAmount) <= 0) {
      setExpenseError("Amount must be greater than 0");
      return;
    }

    setExpenseLoading(true);
    try {
      await api.fixedExpenses.create({
        label: expenseLabel,
        amount: parseFloat(expenseAmount),
        auto_generate: expenseAutoGenerate,
      });
      // Reload expenses
      await loadFixedExpenses();
      // Reset form
      setExpenseLabel("");
      setExpenseAmount("");
      setExpenseAutoGenerate(false);
      setExpenseError("");
    } catch {
      setExpenseError("Failed to add fixed expense");
    } finally {
      setExpenseLoading(false);
    }
  };

  const handleDeleteFixedExpense = async (id: number) => {
    if (!confirm("Are you sure you want to delete this expense template?")) {
      return;
    }

    try {
      await api.fixedExpenses.delete(id);
      await loadFixedExpenses();
    } catch {
      setExpenseError("Failed to delete fixed expense");
    }
  };

  const openFixedExpensesModal = async () => {
    setShowFixedExpensesManageModal(true);
    if (!fixedExpensesLoaded) {
      await loadFixedExpenses();
    }
  };

  const handleChangeUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameError("");
    setUsernameSuccess(false);

    if (newUsername.length < 3 || newUsername.length > 32) {
      setUsernameError("Username must be 3-32 characters");
      return;
    }

    setUsernameLoading(true);
    try {
      const response = await api.auth.changeUsername(newUsername);
      updateUsername(response.username);
      setUsernameSuccess(true);
      setTimeout(() => setUsernameSuccess(false), 3000);
    } catch {
      setUsernameError("Failed to change username. It may already be taken.");
    } finally {
      setUsernameLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword.length < 6 || newPassword.length > 128) {
      setPasswordError("Password must be 6-128 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setPasswordLoading(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch {
      setPasswordError("Failed to change password. Check your current password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleClearData = async () => {
    setDeleteError("");

    if (deletePassword.length < 6) {
      setDeleteError("Please enter your password");
      return;
    }

    setDeleteLoading(true);
    try {
      await api.auth.clearAllData(deletePassword);
      await logout();
    } catch {
      setDeleteError("Failed to clear data. Check your password.");
      setDeleteLoading(false);
    }
  };

  const handleSaveCurrency = () => {
    setCurrency(selectedCurrency);
    setCurrencySuccess(true);
  };

  const handleSavePortfolioPassphrase = () => {
    setPortfolioEncryptionPassphrase(portfolioPassphrase);
    setShowPortfolioEncryptionModal(false);
  };

  const loadPayday = async () => {
    if (paydayLoaded) return;
    try {
      const [paydayResult, modeResult] = await Promise.all([
        api.months.getPayday(),
        api.months.getPaydayModeEnabled(),
      ]);
      setPayday(paydayResult.payday);
      setPaydayModeEnabled(modeResult.enabled);
      setPaydayLoaded(true);
    } catch {
      setPaydayError("Failed to load payday preference");
    }
  };

  const handleSavePayday = async () => {
    if (payday === null || payday < 1 || payday > 31) {
      setPaydayError("Payday must be between 1 and 31");
      return;
    }

    setPaydayLoading(true);
    setPaydayError("");
    try {
      await api.months.setPayday(payday);
      setPaydaySuccess(true);
      setTimeout(() => setPaydaySuccess(false), 3000);
    } catch {
      setPaydayError("Failed to save payday preference");
    } finally {
      setPaydayLoading(false);
    }
  };

  const handleTogglePaydayMode = async () => {
    setPaydayLoading(true);
    setPaydayError("");
    try {
      await api.months.setPaydayModeEnabled(!paydayModeEnabled);
      setPaydayModeEnabled(!paydayModeEnabled);
      setPaydaySuccess(true);
      setTimeout(() => setPaydaySuccess(false), 3000);
    } catch {
      setPaydayError("Failed to update payday mode");
    } finally {
      setPaydayLoading(false);
    }
  };

  const openPaydayModal = async () => {
    setShowPaydayInfoModal(true);
    if (!paydayLoaded) {
      await loadPayday();
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <button
          onClick={onBack}
          className="mb-4 sm:mb-6 flex items-center gap-2 text-sm text-charcoal-600 dark:text-charcoal-400 hover:text-charcoal-900 dark:hover:text-sand-100 transition-colors touch-manipulation"
        >
          <ArrowLeft size={16} />
          Back to {from === "summary" ? "Summary" : "Dashboard"}
        </button>

        <h1 className="text-xl sm:text-2xl font-semibold mb-6 sm:mb-8 text-charcoal-800 dark:text-sand-100">
          Settings
        </h1>

        <div className="space-y-6 sm:space-y-8">
          <div className="bg-white dark:bg-charcoal-900 border border-sand-300 dark:border-charcoal-800 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-charcoal-700 dark:text-sand-200 mb-4">
              Currency
            </h3>
            <div className="space-y-4">
              <Select
                label="Display Currency"
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                options={SUPPORTED_CURRENCIES.map((c) => ({
                  value: c.code,
                  label: `${c.symbol} ${c.code} - ${c.name}`,
                }))}
              />
              <p className="text-xs text-charcoal-500 dark:text-charcoal-400">
                All monetary values will be displayed in {currency.name} ({currency.symbol}).
                <br />
                Example: {formatCurrency(1234.56)}
              </p>
              {currencySuccess && (
                <p className="text-sm text-sage-600">Currency changed successfully</p>
              )}
              <Button onClick={handleSaveCurrency} disabled={selectedCurrency === currency.code}>
                Save Currency
              </Button>
            </div>
          </div>

          <div className="bg-white dark:bg-charcoal-900 border border-sand-300 dark:border-charcoal-800 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-charcoal-700 dark:text-sand-200 mb-4">
              Payday
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-sm font-medium text-charcoal-700 dark:text-sand-300">
                      Enable Payday-Based Periods
                    </label>
                    <button
                      onClick={openPaydayModal}
                      className="p-0.5 hover:bg-sand-200 dark:hover:bg-charcoal-700 rounded transition-colors touch-manipulation"
                      title="How payday works"
                    >
                      <Info size={14} className="text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-300" />
                    </button>
                  </div>
                  <p className="text-xs text-charcoal-500 dark:text-charcoal-400">
                    Use payday-based accounting periods instead of calendar months
                  </p>
                </div>
                <button
                  onClick={handleTogglePaydayMode}
                  disabled={paydayLoading}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    paydayModeEnabled
                      ? "bg-sage-600 dark:bg-sage-500"
                      : "bg-charcoal-300 dark:bg-charcoal-600"
                  } ${paydayLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      paydayModeEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {paydayModeEnabled && (
                <div>
                  <label className="text-sm font-medium text-charcoal-700 dark:text-sand-300 block mb-2">
                    Day of Month (1-31)
                  </label>
                  <p className="text-xs text-charcoal-500 dark:text-charcoal-400 mb-3">
                    Your accounting period starts on this day each month. If it falls on a weekend, it will move to Friday.
                  </p>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={payday || "21"}
                    onChange={(e) => setPayday(parseInt(e.target.value) || 21)}
                    className="w-full px-3 py-2 border border-sand-300 dark:border-charcoal-600 rounded bg-white dark:bg-charcoal-800 text-charcoal-900 dark:text-sand-100"
                  />
                </div>
              )}
              {paydayError && <p className="text-sm text-red-600">{paydayError}</p>}
              {paydaySuccess && <p className="text-sm text-sage-600">Payday updated successfully</p>}
              {paydayModeEnabled && (
                <Button
                  onClick={handleSavePayday}
                  disabled={paydayLoading || payday === null}
                >
                  {paydayLoading ? "Saving..." : "Save Payday Day"}
                </Button>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-charcoal-900 border border-sand-300 dark:border-charcoal-800 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-charcoal-700 dark:text-sand-200 mb-4">
              Transferred Items
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-sm font-medium text-charcoal-700 dark:text-sand-300">
                      Enable Transferred Items
                    </label>
                    <button
                      onClick={() => setShowTransfersModal(true)}
                      className="p-0.5 hover:bg-sand-200 dark:hover:bg-charcoal-700 rounded transition-colors touch-manipulation"
                      title="How to use transfers"
                    >
                      <Info size={14} className="text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-300" />
                    </button>
                  </div>
                  <p className="text-xs text-charcoal-500 dark:text-charcoal-400">
                    Allow adding, editing, and deleting transferred items
                  </p>
                </div>
                <button
                  onClick={() => setTransfersEnabled(!transfersEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    transfersEnabled
                      ? "bg-sage-600 dark:bg-sage-500"
                      : "bg-charcoal-300 dark:bg-charcoal-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      transfersEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-charcoal-900 border border-sand-300 dark:border-charcoal-800 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-charcoal-700 dark:text-sand-200 mb-4">
              Retirement Savings Breakdown
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-sm font-medium text-charcoal-700 dark:text-sand-300">
                      Enable Retirement Breakdown
                    </label>
                    <button
                      onClick={() => setShowRetirementBreakdownModal(true)}
                      className="p-0.5 hover:bg-sand-200 dark:hover:bg-charcoal-700 rounded transition-colors touch-manipulation"
                      title="How to use retirement breakdown"
                    >
                      <Info size={14} className="text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-300" />
                    </button>
                  </div>
                  <p className="text-xs text-charcoal-500 dark:text-charcoal-400">
                    Track and view breakdown of retirement savings
                  </p>
                </div>
                <button
                  onClick={() => setRetirementBreakdownEnabled(!retirementBreakdownEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    retirementBreakdownEnabled
                      ? "bg-sage-600 dark:bg-sage-500"
                      : "bg-charcoal-300 dark:bg-charcoal-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      retirementBreakdownEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-charcoal-900 border border-sand-300 dark:border-charcoal-800 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-charcoal-700 dark:text-sand-200 mb-4">
              Current Account Balance
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-sm font-medium text-charcoal-700 dark:text-sand-300">
                      Enable Current Account Tracking
                    </label>
                    <button
                      onClick={() => setShowCurrentAccountInfoModal(true)}
                      className="p-0.5 hover:bg-sand-200 dark:hover:bg-charcoal-700 rounded transition-colors touch-manipulation"
                      title="How to use current account tracking"
                    >
                      <Info size={14} className="text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-300" />
                    </button>
                  </div>
                  <p className="text-xs text-charcoal-500 dark:text-charcoal-400">
                    Track your bank account balance and transfer to savings
                  </p>
                </div>
                <button
                  onClick={() => setCurrentAccountEnabled(!currentAccountEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    currentAccountEnabled
                      ? "bg-sage-600 dark:bg-sage-500"
                      : "bg-charcoal-300 dark:bg-charcoal-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      currentAccountEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-charcoal-900 border border-sand-300 dark:border-charcoal-800 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-charcoal-700 dark:text-sand-200 mb-4">
              Stock & Crypto Tracking
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-sm font-medium text-charcoal-700 dark:text-sand-300">
                      Enable Stock & Crypto Tracking
                    </label>
                    <button
                      onClick={() => setShowStockFeatureModal(true)}
                      className="p-0.5 hover:bg-sand-200 dark:hover:bg-charcoal-700 rounded transition-colors touch-manipulation"
                      title="How to add stocks and crypto"
                    >
                      <Info size={14} className="text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-300" />
                    </button>
                  </div>
                  <p className="text-xs text-charcoal-500 dark:text-charcoal-400">
                    Add stocks and cryptocurrencies to track alongside other accounts
                  </p>
                </div>
                <button
                  onClick={() => setStockTrackingEnabled(!stockTrackingEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    stockTrackingEnabled
                      ? "bg-sage-600 dark:bg-sage-500"
                      : "bg-charcoal-300 dark:bg-charcoal-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      stockTrackingEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-charcoal-900 border border-sand-300 dark:border-charcoal-800 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-charcoal-700 dark:text-sand-200 mb-4">
              Portfolio Encryption
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-sm font-medium text-charcoal-700 dark:text-sand-300">
                      Secure Your Portfolio Data
                    </label>
                    <button
                      onClick={() => setShowEncryptionInfoModal(true)}
                      className="p-0.5 hover:bg-sand-200 dark:hover:bg-charcoal-700 rounded transition-colors touch-manipulation"
                      title="Learn about encryption"
                    >
                      <Info size={14} className="text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-300" />
                    </button>
                  </div>
                  <p className="text-xs text-charcoal-500 dark:text-charcoal-400">
                    Your retirement portfolio data is encrypted using your user ID. You can optionally add a passphrase for extra security.
                  </p>
                </div>
                {portfolioEncryptionPassphrase && (
                  <div className="ml-4 flex-shrink-0">
                    <p className="text-xs text-sage-600 dark:text-sage-400">
                      ✓ Set
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowPortfolioEncryptionModal(true)}
                className="px-4 py-2 bg-sage-600 hover:bg-sage-700 dark:bg-sage-500 dark:hover:bg-sage-600 text-white rounded transition-colors text-sm font-medium w-full"
              >
                {portfolioEncryptionPassphrase ? "Update Passphrase" : "Add Passphrase"}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-charcoal-900 border border-sand-300 dark:border-charcoal-800 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-charcoal-700 dark:text-sand-200 mb-4">
              Custom Savings Goals
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-sm font-medium text-charcoal-700 dark:text-sand-300">
                      Enable Custom Savings Goals
                    </label>
                    <button
                      onClick={() => setShowCustomSavingsGoalsInfoModal(true)}
                      className="p-0.5 hover:bg-sand-200 dark:hover:bg-charcoal-700 rounded transition-colors touch-manipulation"
                      title="How to use custom savings goals"
                    >
                      <Info size={14} className="text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-300" />
                    </button>
                  </div>
                  <p className="text-xs text-charcoal-500 dark:text-charcoal-400">
                    Create custom financial goals and track your progress
                  </p>
                </div>
                <button
                  onClick={() => setCustomSavingsGoalsEnabled(!customSavingsGoalsEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    customSavingsGoalsEnabled
                      ? "bg-sage-600 dark:bg-sage-500"
                      : "bg-charcoal-300 dark:bg-charcoal-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      customSavingsGoalsEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-charcoal-900 border border-sand-300 dark:border-charcoal-800 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-charcoal-700 dark:text-sand-200 mb-4">
              Recurring Wages
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-sm font-medium text-charcoal-700 dark:text-sand-300">
                      Enable Recurring Wages
                    </label>
                    <button
                      onClick={() => setShowRecurringWagesInfoModal(true)}
                      className="p-0.5 hover:bg-sand-200 dark:hover:bg-charcoal-700 rounded transition-colors touch-manipulation"
                      title="How to use recurring wages"
                    >
                      <Info size={14} className="text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-300" />
                    </button>
                  </div>
                  <p className="text-xs text-charcoal-500 dark:text-charcoal-400">
                    Set up recurring monthly wages that automatically apply to new months
                  </p>
                </div>
                <button
                  onClick={() => setRecurringWagesEnabled(!recurringWagesEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    recurringWagesEnabled
                      ? "bg-sage-600 dark:bg-sage-500"
                      : "bg-charcoal-300 dark:bg-charcoal-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      recurringWagesEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              {recurringWagesEnabled && (
                <Button onClick={openRecurringWagesModal} className="w-full">
                  Manage Recurring Wages
                </Button>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-charcoal-900 border border-sand-300 dark:border-charcoal-800 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-charcoal-700 dark:text-sand-200 mb-4">
              Fixed Expense Templates
            </h3>
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-sm font-medium text-charcoal-600 dark:text-charcoal-300">
                      Create Reusable Templates
                    </label>
                    <button
                      onClick={() => setShowFixedExpensesInfoModal(true)}
                      className="p-0.5 hover:bg-sand-200 dark:hover:bg-charcoal-700 rounded transition-colors touch-manipulation"
                      title="How to use fixed expenses"
                    >
                      <Info size={14} className="text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-300" />
                    </button>
                  </div>
                  <p className="text-xs text-charcoal-500 dark:text-charcoal-400">
                    Create reusable expense templates that you can quickly add to any month (e.g., Rent, Utilities, Insurance). Optional auto-generation creates them automatically each month.
                  </p>
                </div>
                <button
                  onClick={() => setFixedExpensesEnabled(!fixedExpensesEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                    fixedExpensesEnabled
                      ? "bg-sage-600 dark:bg-sage-500"
                      : "bg-charcoal-300 dark:bg-charcoal-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      fixedExpensesEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              <Button onClick={openFixedExpensesModal} className="w-full">
                Manage Fixed Expenses
              </Button>
            </div>
          </div>

          <div className="bg-white dark:bg-charcoal-900 border border-sand-300 dark:border-charcoal-800 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-charcoal-700 dark:text-sand-200 mb-4">
              Recurring Transaction Templates
            </h3>
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-sm font-medium text-charcoal-600 dark:text-charcoal-300">
                      Set Up Recurring Templates
                    </label>
                    <button
                      onClick={() => setShowRecurringItemsInfoModal(true)}
                      className="p-0.5 hover:bg-sand-200 dark:hover:bg-charcoal-700 rounded transition-colors touch-manipulation"
                      title="How to use recurring templates"
                    >
                      <Info size={14} className="text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-300" />
                    </button>
                  </div>
                  <p className="text-xs text-charcoal-500 dark:text-charcoal-400">
                    Create recurring transaction templates that automatically generate each month (rent, subscriptions, etc.). Optional auto-generation creates them automatically on a selected day.
                  </p>
                </div>
                <button
                  onClick={() => setRecurringItemsEnabled(!recurringItemsEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                    recurringItemsEnabled
                      ? "bg-sage-600 dark:bg-sage-500"
                      : "bg-charcoal-300 dark:bg-charcoal-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      recurringItemsEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              <Button onClick={() => setShowRecurringItemsManageModal(true)} className="w-full">
                Manage Recurring Items
              </Button>
            </div>
          </div>

          <div className="bg-white dark:bg-charcoal-900 border border-sand-300 dark:border-charcoal-800 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-charcoal-700 dark:text-sand-200 mb-4">
              Change Username
            </h3>
            <form onSubmit={handleChangeUsername} className="space-y-4">
              <Input
                label="New Username"
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Enter new username"
                disabled={usernameLoading}
              />
              {usernameError && (
                <p className="text-sm text-terracotta-600">{usernameError}</p>
              )}
              {usernameSuccess && (
                <p className="text-sm text-sage-600">Username changed successfully</p>
              )}
              <Button type="submit" disabled={usernameLoading || newUsername === user?.username}>
                {usernameLoading ? "Saving..." : "Save Username"}
              </Button>
            </form>
          </div>

          <div className="bg-white dark:bg-charcoal-900 border border-sand-300 dark:border-charcoal-800 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-charcoal-700 dark:text-sand-200 mb-4">
              Change Password
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-charcoal-700 dark:text-sand-200 mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <Input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    disabled={passwordLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-2 bottom-3 p-1 text-charcoal-500 hover:text-charcoal-700 dark:text-charcoal-400 dark:hover:text-charcoal-200 transition-colors"
                    title={showCurrentPassword ? "Hide password" : "Show password"}
                  >
                    {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal-700 dark:text-sand-200 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    disabled={passwordLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2 bottom-3 p-1 text-charcoal-500 hover:text-charcoal-700 dark:text-charcoal-400 dark:hover:text-charcoal-200 transition-colors"
                    title={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal-700 dark:text-sand-200 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    disabled={passwordLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 bottom-3 p-1 text-charcoal-500 hover:text-charcoal-700 dark:text-charcoal-400 dark:hover:text-charcoal-200 transition-colors"
                    title={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              {passwordError && (
                <p className="text-sm text-terracotta-600">{passwordError}</p>
              )}
              {passwordSuccess && (
                <p className="text-sm text-sage-600">Password changed successfully</p>
              )}
              <Button type="submit" disabled={passwordLoading}>
                {passwordLoading ? "Changing..." : "Change Password"}
              </Button>
            </form>
          </div>

          <div className="bg-terracotta-50 dark:bg-charcoal-900 p-4 sm:p-6 border-2 border-terracotta-300 dark:border-terracotta-800">
            <h2 className="text-base sm:text-lg font-medium mb-2 text-terracotta-800 dark:text-terracotta-300">
              Danger Zone
            </h2>
            <p className="text-sm text-charcoal-600 dark:text-charcoal-400 mb-4">
              This action cannot be undone. All your data will be permanently deleted.
            </p>
            <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
              Clear All Data
            </Button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeletePassword("");
          setDeleteError("");
        }}
        title="Clear All Data"
      >
        <div className="space-y-4">
          <p className="text-sm text-charcoal-600 dark:text-charcoal-300">
            This will permanently delete all your data including:
          </p>
          <ul className="text-sm text-charcoal-600 dark:text-charcoal-300 list-disc list-inside space-y-1">
            <li>All months and transactions</li>
            <li>All budget categories</li>
            <li>All fixed expenses</li>
            <li>All income entries</li>
            <li>Your account and settings</li>
          </ul>
          <p className="text-sm font-medium text-terracotta-700 dark:text-terracotta-400">
            This action cannot be undone.
          </p>
          <Input
            label="Confirm your password"
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder="Enter your password"
            disabled={deleteLoading}
          />
          {deleteError && (
            <p className="text-sm text-terracotta-600">{deleteError}</p>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="danger" onClick={handleClearData} disabled={deleteLoading} className="w-full sm:w-auto">
              {deleteLoading ? "Deleting..." : "Yes, Delete Everything"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowDeleteModal(false);
                setDeletePassword("");
                setDeleteError("");
              }}
              disabled={deleteLoading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showTransfersModal} onClose={() => setShowTransfersModal(false)}>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-charcoal-800 dark:text-sand-100">
            How to Use Transferred Items
          </h2>
          
          <div className="space-y-3 text-sm text-charcoal-600 dark:text-charcoal-300">
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">What are transfers?</p>
              <p>Track portions of your budgeted spending that you plan to transfer to savings or retirement accounts instead of spending.</p>
            </div>
            
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">Enable/Disable behavior:</p>
              <ul className="space-y-1">
                <li><span className="font-medium">When enabled:</span> You can add, edit, and delete transfers.</li>
                <li><span className="font-medium">When disabled:</span> View only. Card hides once all transfers are deleted.</li>
              </ul>
            </div>
            
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">When to use transfers:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>You have extra budget left and want to save it</li>
                <li>You want to contribute to retirement beyond regular deductions</li>
                <li>You want to track discretionary savings separately</li>
              </ul>
            </div>
            
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">How to add a transfer:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Open the "Transferred Items" card on the dashboard</li>
                <li>Click the <span className="inline-block">+</span> button to create a transfer</li>
                <li>Fill in the description, amount, and date</li>
                <li>Choose the destination: Savings or Retirement</li>
                <li>Click confirm</li>
              </ol>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={() => setShowTransfersModal(false)}
              className="w-full"
            >
              Got it
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showRetirementBreakdownModal} onClose={() => setShowRetirementBreakdownModal(false)}>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-charcoal-800 dark:text-sand-100">
            How to Use Retirement Savings Breakdown
          </h2>
          
          <div className="space-y-3 text-sm text-charcoal-600 dark:text-charcoal-300">
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">What is the retirement breakdown?</p>
              <p>A detailed breakdown of what makes up your total retirement savings amount. Track different accounts or sources (pension plans, investment accounts, savings accounts, etc.) and see exactly how your retirement funds are composed.</p>
            </div>
            
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">Enable/Disable behavior:</p>
              <ul className="space-y-1">
                <li><span className="font-medium">When enabled:</span> You can add, edit, and delete breakdown items. The card is always visible.</li>
                <li><span className="font-medium">When disabled:</span> View only. Card hides once all entries are deleted.</li>
              </ul>
            </div>
            
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">When to use:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Track your pension plans, retirement accounts, and investment portfolios</li>
                <li>Monitor the composition of your total retirement savings</li>
                <li>Keep a detailed record of where your retirement funds are allocated</li>
              </ul>
            </div>
            
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">How to add a breakdown item:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Open the "Retirement Savings Breakdown" card on the dashboard</li>
                <li>Click the <span className="inline-block">+</span> button to create an entry</li>
                <li>Enter the account/source label (e.g., "Pension", "Investment Account", "Savings")</li>
                <li>Enter the amount in that account</li>
                <li>Click confirm</li>
              </ol>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={() => setShowRetirementBreakdownModal(false)}
              className="w-full"
            >
              Got it
            </Button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={showRecurringWagesManageModal} 
        onClose={() => {
          setShowRecurringWagesManageModal(false);
          setWageLabel("Wages");
          setWageAmount("");
          setWageEffectiveFrom("");
          setWageError("");
        }}
        title="Manage Recurring Wages"
      >
        <div className="space-y-4">
          {recurringWages.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-charcoal-700 dark:text-sand-300 mb-3">
                Wage History
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto bg-sand-50 dark:bg-charcoal-800 p-3 rounded border border-sand-200 dark:border-charcoal-700">
                {recurringWages.map((wage) => (
                  <div key={wage.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-charcoal-700 dark:text-sand-200">
                        {wage.label}: {formatCurrency(wage.amount)}
                      </p>
                      <p className="text-xs text-charcoal-500 dark:text-charcoal-400">
                        Effective from {new Date(wage.effective_from).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteRecurringWage(wage.id)}
                      className="p-1 hover:bg-terracotta-100 dark:hover:bg-terracotta-900 rounded transition-colors"
                      title="Delete wage entry"
                    >
                      <Trash2 size={16} className="text-terracotta-600" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleAddRecurringWage} className="space-y-4 border-t border-sand-200 dark:border-charcoal-700 pt-4">
            <h3 className="text-sm font-semibold text-charcoal-700 dark:text-sand-300">
              Add New Wage Entry
            </h3>
            <Input
              label="Wage Label"
              type="text"
              value={wageLabel}
              onChange={(e) => setWageLabel(e.target.value)}
              placeholder="e.g., Wages, Salary"
              disabled={wageLoading}
            />
            <Input
              label="Amount"
              type="number"
              step="0.01"
              value={wageAmount}
              onChange={(e) => setWageAmount(e.target.value)}
              placeholder="0.00"
              disabled={wageLoading}
            />
            <Input
              label="Effective From (Date)"
              type="date"
              value={wageEffectiveFrom}
              onChange={(e) => setWageEffectiveFrom(e.target.value)}
              disabled={wageLoading}
            />
            <p className="text-xs text-charcoal-500 dark:text-charcoal-400">
              This wage will apply to all months from the effective date onwards, unless overridden by a later entry.
            </p>
            {wageError && (
              <p className="text-sm text-terracotta-600">{wageError}</p>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button type="submit" disabled={wageLoading} className="flex-1">
                {wageLoading ? "Saving..." : "Add Wage Entry"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowRecurringWagesManageModal(false);
                  setWageLabel("Wages");
                  setWageAmount("");
                  setWageEffectiveFrom("");
                  setWageError("");
                }}
                disabled={wageLoading}
                className="flex-1"
              >
                Close
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      <Modal isOpen={showRecurringWagesInfoModal} onClose={() => setShowRecurringWagesInfoModal(false)}>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-charcoal-800 dark:text-sand-100">
            How to Use Recurring Wages
          </h2>
          
          <div className="space-y-3 text-sm text-charcoal-600 dark:text-charcoal-300">
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">What are recurring wages?</p>
              <p>Set up your monthly wages once, and they'll automatically be added as income to every new month you create. Perfect for employees with consistent paychecks.</p>
            </div>
            
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">Enable/Disable behavior:</p>
              <ul className="space-y-1">
                <li><span className="font-medium">When enabled:</span> You can manage wage entries. Wages automatically apply to new months.</li>
                <li><span className="font-medium">When disabled:</span> Existing wages won't apply to new months, but you can still view and manage entries.</li>
              </ul>
            </div>
            
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">How to add a wage:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Toggle "Enable Recurring Wages" to on</li>
                <li>Click "Manage Recurring Wages"</li>
                <li>Fill in the wage label, amount, and effective date</li>
                <li>Click "Add Wage Entry"</li>
                <li>The wage will apply to all months from that date forward</li>
              </ol>
            </div>

            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">Handling wage increases:</p>
              <p>When you get a raise, just add a new wage entry with the new amount and the effective date. Previous months will keep their original wage amount - only months from the new date will use the increased amount.</p>
            </div>

            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">Important notes:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Wages are added automatically when you create or navigate to a month</li>
                <li>You can still manually edit or delete the wage income if needed</li>
                <li>The most recent effective wage date applies to each month</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={() => setShowRecurringWagesInfoModal(false)}
              className="w-full"
            >
              Got it
            </Button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={showFixedExpensesManageModal} 
        onClose={() => {
          setShowFixedExpensesManageModal(false);
          setExpenseLabel("");
          setExpenseAmount("");
          setExpenseError("");
        }}
        title="Manage Fixed Expense Templates"
      >
        <div className="space-y-4">
          {fixedExpenses.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-charcoal-700 dark:text-sand-300 mb-3">
                Your Templates
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto bg-sand-50 dark:bg-charcoal-800 p-3 rounded border border-sand-200 dark:border-charcoal-700">
                {fixedExpenses.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-charcoal-700 dark:text-sand-200">
                        {expense.label}: {formatCurrency(expense.amount)}
                      </p>
                      {expense.auto_generate && (
                        <p className="text-xs text-sage-600 dark:text-sage-400">
                          ✓ Auto-generates each month
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteFixedExpense(expense.id)}
                      className="p-1 hover:bg-terracotta-100 dark:hover:bg-terracotta-900 rounded transition-colors"
                      title="Delete expense template"
                    >
                      <Trash2 size={16} className="text-terracotta-600" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleAddFixedExpense} className="space-y-4 border-t border-sand-200 dark:border-charcoal-700 pt-4">
            <h3 className="text-sm font-semibold text-charcoal-700 dark:text-sand-300">
              Add New Template
            </h3>
            <Input
              label="Expense Label"
              type="text"
              value={expenseLabel}
              onChange={(e) => setExpenseLabel(e.target.value)}
              placeholder="e.g., Rent, Internet, Insurance"
              disabled={expenseLoading}
            />
            <Input
              label="Default Amount"
              type="number"
              step="0.01"
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              placeholder="0.00"
              disabled={expenseLoading}
            />
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto-generate-check"
                checked={expenseAutoGenerate}
                onChange={(e) => setExpenseAutoGenerate(e.target.checked)}
                disabled={expenseLoading}
                className="w-4 h-4 rounded border-sand-300 dark:border-charcoal-600 dark:bg-charcoal-800 cursor-pointer"
              />
              <label htmlFor="auto-generate-check" className="text-sm text-charcoal-700 dark:text-sand-300 cursor-pointer">
                Auto-generate each month
              </label>
            </div>
            {expenseError && (
              <p className="text-sm text-terracotta-600">{expenseError}</p>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button type="submit" disabled={expenseLoading} className="flex-1">
                {expenseLoading ? "Saving..." : "Add Template"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowFixedExpensesManageModal(false);
                  setExpenseLabel("");
                  setExpenseAmount("");
                  setExpenseAutoGenerate(false);
                  setExpenseError("");
                }}
                disabled={expenseLoading}
                className="flex-1"
              >
                Close
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      <Modal 
        isOpen={showRecurringItemsManageModal} 
        onClose={() => setShowRecurringItemsManageModal(false)}
        title="Manage Recurring Transaction Templates"
      >
        <RecurringItemsModal onClose={() => setShowRecurringItemsManageModal(false)} />
      </Modal>

      <Modal isOpen={showCurrentAccountInfoModal} onClose={() => setShowCurrentAccountInfoModal(false)}>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-charcoal-800 dark:text-sand-100">
            How to Use Current Account Tracking
          </h2>
          
          <div className="space-y-3 text-sm text-charcoal-600 dark:text-charcoal-300">
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">What is a current account?</p>
              <p>Your current account represents your main bank account - the account where your wages go in and where you pay your bills from. This is separate from your savings accounts.</p>
            </div>
            
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">Enable/Disable behavior:</p>
              <ul className="space-y-1">
                <li><span className="font-medium">When enabled:</span> You can track your current account balance and transfer money to savings or retirement accounts.</li>
                <li><span className="font-medium">When disabled:</span> The current account card will be hidden from the dashboard.</li>
              </ul>
            </div>
            
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">How to use it:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Toggle "Enable Current Account Tracking" to on</li>
                <li>Enter your current account balance in the card</li>
                <li>As you add expenses, your budget tracks where the money goes</li>
                <li>When you save money or move to retirement, use the "Transfer" button to move funds</li>
                <li>Transfers appear in the "Transferred Items" section for a record</li>
              </ol>
            </div>

            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">When to transfer:</p>
              <p>Transfer money from your current account when you've saved enough to move it to long-term savings or retirement accounts. This helps you keep track of how much is in each account.</p>
            </div>

            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">Important notes:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Current account balance is tracked per month</li>
                <li>You can manually edit the balance if needed</li>
                <li>Transfers automatically appear as items in the Transferred Items section</li>
                <li>The balance can go negative if spending exceeds income (overdraft)</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={() => setShowCurrentAccountInfoModal(false)}
              className="w-full"
            >
              Got it
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showCustomSavingsGoalsInfoModal} onClose={() => setShowCustomSavingsGoalsInfoModal(false)}>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-charcoal-800 dark:text-sand-100">
            How to Use Custom Savings Goals
          </h2>
          
          <div className="space-y-3 text-sm text-charcoal-600 dark:text-charcoal-300">
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">What are custom savings goals?</p>
              <p>Custom savings goals let you create and track your own financial targets beyond the standard savings and retirement accounts. Perfect for saving towards specific things like a vacation, a car, or a home.</p>
            </div>
            
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">Enable/Disable behavior:</p>
              <ul className="space-y-1">
                <li><span className="font-medium">When enabled:</span> You can add, edit, and delete custom savings goals with target amounts.</li>
                <li><span className="font-medium">When disabled:</span> The card hides. Your saved goals are preserved in case you re-enable it.</li>
              </ul>
            </div>
            
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">How to add a goal:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Toggle "Enable Custom Savings Goals" to on</li>
                <li>Click the + button on the card</li>
                <li>Enter a goal name (e.g., "Holiday Fund")</li>
                <li>Set your target amount</li>
                <li>Track your progress as you add money towards each goal</li>
              </ol>
            </div>

            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">Managing your goals:</p>
              <p>You can edit goal names and amounts, or delete goals when you've saved enough. Your goals are stored locally, so they persist between sessions.</p>
            </div>

            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">Important notes:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Goals are separate from your main savings and retirement accounts</li>
                <li>This is a tracking feature - amounts are manually updated by you</li>
                <li>Each goal can have its own target to work towards</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={() => setShowCustomSavingsGoalsInfoModal(false)}
              className="w-full"
            >
              Got it
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showRecurringItemsInfoModal} onClose={() => setShowRecurringItemsInfoModal(false)}>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-charcoal-800 dark:text-sand-100">
            How to Use Recurring Transaction Templates
          </h2>
          
          <div className="space-y-3 text-sm text-charcoal-600 dark:text-charcoal-300">
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">What are recurring templates?</p>
              <p>Recurring templates are transaction templates that automatically generate items each month on a specific day (e.g., Rent on the 1st, Salary on the 25th). They match your Fixed Expenses in flexibility but auto-generate without manual selection.</p>
            </div>
            
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">How it works:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li><span className="font-medium">Create templates:</span> Go to "Manage Recurring Items" and add your recurring transactions</li>
                <li><span className="font-medium">Set the day:</span> Pick which day of the month it should appear (1-31)</li>
                <li><span className="font-medium">Enable auto-generation:</span> Toggle "Auto-generate each month" to create items automatically</li>
                <li><span className="font-medium">Monthly view:</span> See recurring items in the month view, grouped with other transactions</li>
                <li><span className="font-medium">Manage anytime:</span> Add or remove specific instances from any month using the settings icon</li>
              </ol>
            </div>

            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">Auto-generation vs manual:</p>
              <ul className="space-y-1">
                <li><span className="font-medium">Auto-generate enabled:</span> Items are created automatically when you create a new month on that day</li>
                <li><span className="font-medium">Auto-generate disabled:</span> You can manually add them from the month view using the selector</li>
              </ul>
            </div>

            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">Example workflow:</p>
              <p className="text-xs bg-charcoal-100 dark:bg-charcoal-800 p-2 rounded">Templates: Salary (day 25, auto-generate), Rent (day 1, auto-generate), Groceries (day 15, no auto-generate) → Create February → Salary & Rent auto-appear → Manually add Groceries if needed</p>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={() => setShowRecurringItemsInfoModal(false)}
              className="w-full"
            >
              Got it
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showFixedExpensesInfoModal} onClose={() => setShowFixedExpensesInfoModal(false)}>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-charcoal-800 dark:text-sand-100">
            How to Use Fixed Expenses
          </h2>
          
          <div className="space-y-3 text-sm text-charcoal-600 dark:text-charcoal-300">
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">What are fixed expenses?</p>
              <p>Fixed expenses are recurring costs that stay roughly the same each month (e.g., Rent, Internet, Insurance). Create templates once and quickly add them to each month without retyping.</p>
            </div>
            
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">How it works:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li><span className="font-medium">Create templates:</span> Go to "Manage Fixed Expenses" and add your recurring expenses (Rent: $1000, Internet: $50, etc.)</li>
                <li><span className="font-medium">Select for months:</span> When viewing a month, click ⚙️ on the Fixed Expenses card</li>
                <li><span className="font-medium">Quick add:</span> Click + next to any template to instantly add it that month</li>
                <li><span className="font-medium">Adjust if needed:</span> Edit the amount for that specific month (e.g., extra internet bill)</li>
                <li><span className="font-medium">Save:</span> Changes only affect that month - templates stay unchanged</li>
              </ol>
            </div>

            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">Price adjustments:</p>
              <p>If you adjust a price for a specific month, an orange alert icon appears. This shows the price differs from your template - your global template is never changed.</p>
            </div>

            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">Enable/Disable behavior:</p>
              <ul className="space-y-1">
                <li><span className="font-medium">When enabled:</span> Fixed Expenses card appears on dashboard where you can select templates and adjust prices.</li>
                <li><span className="font-medium">When disabled:</span> The card hides. Your templates and month data are preserved if you re-enable later.</li>
              </ul>
            </div>

            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">Example workflow:</p>
              <p className="text-xs bg-charcoal-100 dark:bg-charcoal-800 p-2 rounded">Templates: Rent ($1000), Internet ($50), Groceries ($300) → February: Add all three → March: Add all three + adjust Internet to $60 (extra charge) → April: Add Rent & Internet, skip Groceries</p>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={() => setShowFixedExpensesInfoModal(false)}
              className="w-full"
            >
              Got it
            </Button>
          </div>
        </div>
      </Modal>

```      <Modal isOpen={showStockFeatureModal} onClose={() => setShowStockFeatureModal(false)}>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-charcoal-800 dark:text-sand-100">
            How to Add Stocks & Cryptocurrencies
          </h2>
          
          <div className="space-y-3 text-sm text-charcoal-600 dark:text-charcoal-300">
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">What is stock & crypto tracking?</p>
              <p>Track individual stock holdings and cryptocurrency positions with live price updates. Prices are automatically fetched and converted to your selected currency (GBP, EUR, USD, etc.).</p>
            </div>
            
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">How to add a stock:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Open the "Retirement Savings Breakdown" card on the dashboard</li>
                <li>Click the <span className="inline-block">+</span> button to create an entry</li>
                <li>Select "Stock" mode (toggle the radio button)</li>
                <li>Enter the stock ticker (e.g., AAPL, MSFT, GOOGL)</li>
                <li>Enter the quantity of shares you own</li>
                <li>Click confirm - price is fetched automatically and converted to your currency</li>
              </ol>
            </div>

            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">How to add a cryptocurrency:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Follow the same steps as stocks</li>
                <li>Enter the crypto ticker: <span className="font-mono text-xs">BTC</span>, <span className="font-mono text-xs">ETH</span>, <span className="font-mono text-xs">SOL</span>, etc.</li>
                <li>For FTT (from FTX), use <span className="font-mono text-xs">FTT.IO</span></li>
                <li>Price is fetched in USD and automatically converted to your currency</li>
              </ol>
            </div>

            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">Supported cryptocurrencies:</p>
              <p className="text-xs">BTC, ETH, XRP, BCH, LTC, EOS, XLM, LINK, DOT, YFI, DOGE, ADA, SOL, MATIC, AVAX, LUNA, ATOM, NEAR, and most major exchanges (fallback to stock lookup)</p>
            </div>

            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">Features:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li><span className="font-medium">Live prices:</span> Prices auto-convert to your selected currency</li>
                <li><span className="font-medium">Refresh:</span> Click the refresh icon to update all stock prices</li>
                <li><span className="font-medium">Edit/Delete:</span> Modify holdings or remove entries anytime</li>
                <li><span className="font-medium">Caching:</span> Prices cached for performance (stock: 7 days, forex: 1 day)</li>
              </ul>
            </div>

            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">Notes:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Prices use Alpha Vantage API (5 calls/min, 500/day free tier)</li>
                <li>If ticker not found as stock, system tries crypto lookup</li>
                <li>All prices displayed in your selected currency with conversion</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={() => setShowStockFeatureModal(false)}
              className="w-full"
            >
              Got it
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showEncryptionInfoModal} onClose={() => setShowEncryptionInfoModal(false)}>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-charcoal-800 dark:text-sand-100">
            How Portfolio Encryption Works
          </h2>

          <div className="space-y-3 text-sm text-charcoal-600 dark:text-charcoal-300">
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">What's being encrypted?</p>
              <p>Your retirement portfolio breakdown data (stocks, cryptocurrencies, and custom items) is encrypted and stored only in your browser. This data never leaves your device.</p>
            </div>

            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">How is it protected?</p>
              <p>Your portfolio uses <span className="font-mono text-xs bg-charcoal-700 dark:bg-charcoal-800 px-1 py-0.5 rounded">AES-256-GCM</span> encryption. The encryption key is derived from a combination of:</p>
              <ul className="list-disc list-inside space-y-1 text-xs mt-2">
                <li>Your user ID (from your account)</li>
                <li>An app secret (built into the application)</li>
                <li>Your optional passphrase (if you set one)</li>
              </ul>
            </div>

            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">Do I need a passphrase?</p>
              <p>No, but it's recommended. Without a passphrase: your portfolio is protected by your user ID. With a passphrase: you add an extra layer of security. Only you know your passphrase - it's never sent to our servers.</p>
            </div>

            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">What if I forget my passphrase?</p>
              <p className="text-amber-600 dark:text-amber-400 font-medium">⚠️ Your encrypted portfolio data cannot be recovered. If you forget your passphrase, the existing data will be inaccessible. Choose a passphrase you can remember.</p>
            </div>

            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">Is my password at risk?</p>
              <p>No. Encryption and decryption happens entirely in your browser using Web Crypto API. Your passphrase is never sent to the server, and the server has no ability to decrypt your data.</p>
            </div>

            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">What happens when I change my passphrase?</p>
              <p>Your existing portfolio data is re-encrypted with the new passphrase. When the page refreshes after updating, it will decrypt and re-encrypt automatically using the new key.</p>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={() => setShowEncryptionInfoModal(false)}
              className="w-full"
            >
              Got it
            </Button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={showPortfolioEncryptionModal}
        onClose={() => {
          setShowPortfolioEncryptionModal(false);
          setPortfolioPassphrase(portfolioEncryptionPassphrase || "");
          setPortfolioPassphraseVisible(false);
        }}
        title="Portfolio Encryption"
      >
        <div className="space-y-4">
          <p className="text-sm text-charcoal-600 dark:text-charcoal-300">
            Your retirement portfolio data is automatically encrypted using your user ID. Add an optional passphrase for extra security.
          </p>
          
          <div>
            <label className="block text-sm font-medium text-charcoal-700 dark:text-sand-300 mb-2">
              Encryption Passphrase (Optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                type={portfolioPassphraseVisible ? "text" : "password"}
                value={portfolioPassphrase}
                onChange={(e) => setPortfolioPassphrase(e.target.value)}
                placeholder="Leave empty for default encryption"
                className="flex-1 px-3 py-2 border border-sand-300 dark:border-charcoal-600 rounded bg-white dark:bg-charcoal-800 text-charcoal-900 dark:text-sand-100 text-sm"
              />
              <button
                onClick={() => setPortfolioPassphraseVisible(!portfolioPassphraseVisible)}
                className="p-2 hover:bg-sand-200 dark:hover:bg-charcoal-700 rounded transition-colors"
              >
                {portfolioPassphraseVisible ? (
                  <EyeOff size={16} className="text-charcoal-600 dark:text-charcoal-400" />
                ) : (
                  <Eye size={16} className="text-charcoal-600 dark:text-charcoal-400" />
                )}
              </button>
            </div>
          </div>

          <div className="bg-sage-50 dark:bg-sage-900/20 p-3 rounded">
            <p className="text-xs text-sage-700 dark:text-sage-300">
              <strong>Security Note:</strong> Your passphrase is never sent to the server. If you forget it, you'll need to clear your browser's local storage to reset.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={handleSavePortfolioPassphrase}
              className="flex-1"
            >
              Save
            </Button>
            <Button
              onClick={() => setShowPortfolioEncryptionModal(false)}
              variant="ghost"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showPaydayInfoModal} onClose={() => setShowPaydayInfoModal(false)}>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-charcoal-800 dark:text-sand-100">
            How to Use Payday Settings
          </h2>
          
          <div className="space-y-3 text-sm text-charcoal-600 dark:text-charcoal-300">
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">What is Payday Mode?</p>
              <p>This is an optional feature. When enabled, payday-based accounting periods organize your finances around when you get paid instead of using calendar months (1st-31st). Each month in the app represents the period from your payday in one calendar month to your payday in the next month.</p>
            </div>

            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">Calendar Months (Default):</p>
              <p>If payday mode is disabled, the app uses traditional calendar months (1st through the last day of each month).</p>
            </div>
            
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">Example with Payday Mode Enabled:</p>
              <p>If your payday is the 21st and today is February 20th:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
                <li>You're in the January period (Jan 21 - Feb 20)</li>
                <li>Tomorrow (Feb 21) starts the February period (Feb 21 - Mar 20)</li>
              </ul>
            </div>
            
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">Weekend Adjustment:</p>
              <p>If your chosen payday falls on a weekend (Saturday or Sunday), it automatically moves to Friday of that week.</p>
            </div>
            
            <div>
              <p className="font-medium text-charcoal-700 dark:text-sand-300 mb-1">Switching Modes:</p>
              <p>You can toggle payday mode on or off anytime. When disabled, the app uses calendar months. When enabled again, it uses your configured payday.</p>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={() => setShowPaydayInfoModal(false)}
              className="w-full"
            >
              Got it
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}

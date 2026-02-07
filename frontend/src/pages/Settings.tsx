import { useState } from "react";
import { Layout } from "../components/Layout";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Modal } from "../components/ui/Modal";
import { useAuth } from "../context/AuthContext";
import { useCurrency, SUPPORTED_CURRENCIES } from "../context/CurrencyContext";
import { useUIPreferences } from "../context/UIPreferencesContext";
import { api, RecurringWage } from "../api/client";
import { ArrowLeft, Info, Eye, EyeOff, Trash2 } from "lucide-react";

interface SettingsProps {
  onBack: () => void;
  from?: "dashboard" | "summary";
}

export function Settings({ onBack, from = "dashboard" }: SettingsProps) {
  const { user, logout, updateUsername } = useAuth();
  const { currency, setCurrency, formatCurrency } = useCurrency();
  const { transfersEnabled, setTransfersEnabled, retirementBreakdownEnabled, setRetirementBreakdownEnabled, recurringWagesEnabled, setRecurringWagesEnabled, currentAccountEnabled, setCurrentAccountEnabled } = useUIPreferences();
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
  
  // Recurring wages state
  const [recurringWages, setRecurringWages] = useState<RecurringWage[]>([]);
  const [showRecurringWagesManageModal, setShowRecurringWagesManageModal] = useState(false);
  const [recurringWagesLoaded, setRecurringWagesLoaded] = useState(false);
  const [wageLabel, setWageLabel] = useState("Wages");
  const [wageAmount, setWageAmount] = useState("");
  const [wageEffectiveFrom, setWageEffectiveFrom] = useState("");
  const [wageLoading, setWageLoading] = useState(false);
  const [wageError, setWageError] = useState("");

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
          <div className="bg-sand-100 dark:bg-charcoal-900 p-4 sm:p-6 border border-sand-200 dark:border-charcoal-800">
            <h2 className="text-base sm:text-lg font-medium mb-4 text-charcoal-800 dark:text-sand-100">
              Currency
            </h2>
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

          <div className="bg-sand-100 dark:bg-charcoal-900 p-4 sm:p-6 border border-sand-200 dark:border-charcoal-800">
            <h2 className="text-base sm:text-lg font-medium mb-4 text-charcoal-800 dark:text-sand-100">
              Transferred Items
            </h2>
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

          <div className="bg-sand-100 dark:bg-charcoal-900 p-4 sm:p-6 border border-sand-200 dark:border-charcoal-800">
            <h2 className="text-base sm:text-lg font-medium mb-4 text-charcoal-800 dark:text-sand-100">
              Retirement Savings Breakdown
            </h2>
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

          <div className="bg-sand-100 dark:bg-charcoal-900 p-4 sm:p-6 border border-sand-200 dark:border-charcoal-800">
            <h2 className="text-base sm:text-lg font-medium mb-4 text-charcoal-800 dark:text-sand-100">
              Current Account Balance
            </h2>
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

          <div className="bg-sand-100 dark:bg-charcoal-900 p-4 sm:p-6 border border-sand-200 dark:border-charcoal-800">
            <h2 className="text-base sm:text-lg font-medium mb-4 text-charcoal-800 dark:text-sand-100">
              Recurring Wages
            </h2>
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

          <div className="bg-sand-100 dark:bg-charcoal-900 p-4 sm:p-6 border border-sand-200 dark:border-charcoal-800">
            <h2 className="text-base sm:text-lg font-medium mb-4 text-charcoal-800 dark:text-sand-100">
              Change Username
            </h2>
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

          <div className="bg-sand-100 dark:bg-charcoal-900 p-4 sm:p-6 border border-sand-200 dark:border-charcoal-800">
            <h2 className="text-base sm:text-lg font-medium mb-4 text-charcoal-800 dark:text-sand-100">
              Change Password
            </h2>
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
    </Layout>
  );
}

import { useState } from "react";
import { Layout } from "../components/Layout";
import { MonthNav } from "../components/MonthNav";
import { Summary } from "../components/Summary";
import { SavingsCard } from "../components/SavingsCard";
import { CurrentAccountCard } from "../components/CurrentAccountCard";
import { RetirementSavingsCard } from "../components/RetirementSavingsCard";
import { RetirementBreakdownCard } from "../components/RetirementBreakdownCard";
import { CustomSavingsGoals } from "../components/CustomSavingsGoals";
import { TransfersCard } from "../components/TransfersCard";
import { VarianceModal } from "../components/VarianceModal";
import { IncomeSection } from "../components/IncomeSection";
import { FixedExpenses } from "../components/FixedExpenses";
import { RecurringItemsInMonth } from "../components/RecurringItemsInMonth";
import { BudgetSection } from "../components/BudgetSection";
import { ItemsSection } from "../components/ItemsSection";
import { Stats } from "../components/Stats";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useMonth } from "../hooks/useMonth";
import { useUIPreferences } from "../context/UIPreferencesContext";
import { Loader2 } from "lucide-react";

interface DashboardProps {
  onSettingsClick: () => void;
  onSummaryClick: (monthId?: number) => void;
}

export function Dashboard({ onSettingsClick, onSummaryClick }: DashboardProps) {
  const [showVarianceModal, setShowVarianceModal] = useState(false);
  const { transfersEnabled, currentAccountEnabled, customSavingsGoalsEnabled, recurringItemsEnabled } = useUIPreferences();
  const {
    summary,
    currentAccount,
    months,
    categories,
    selectedMonthId,
    loading,
    selectMonth,
    createMonth,
    refresh,
    closeMonth,
    reopenMonth,
    updateCurrentAccount,
    refreshTrigger,
  } = useMonth();

  if (loading && !summary) {
    return (
      <Layout onSettingsClick={onSettingsClick}>
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-charcoal-400" />
        </div>
      </Layout>
    );
  }

  if (!summary) {
    return (
      <Layout onSettingsClick={onSettingsClick}>
        <div className="text-center py-20 text-charcoal-500">
          Unable to load data
        </div>
      </Layout>
    );
  }

  const isReadOnly = summary.month.is_closed;

  return (
    <Layout onSettingsClick={onSettingsClick}>
      <div className="space-y-4 mb-4">
        <MonthNav
          months={months}
          selectedMonthId={selectedMonthId}
          onSelect={selectMonth}
          onCreateMonth={createMonth}
          onClose={closeMonth}
          onReopen={reopenMonth}
          onSummary={() => onSummaryClick(selectedMonthId ?? undefined)}
        />
        <div className="hidden lg:flex justify-end">
          <Stats />
        </div>
      </div>

      <div className="space-y-6">
        <ErrorBoundary section="Summary">
          <Summary
            totalIncome={summary.total_income}
            totalFixed={summary.total_fixed}
            totalSpent={summary.total_spent}
            remaining={summary.remaining}
            extraCard={
              <RetirementSavingsCard
                refreshTrigger={refreshTrigger} 
              />
            }
          />
        </ErrorBoundary>

        <ErrorBoundary section="Savings Cards">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SavingsCard
              key={summary.month.id}
              monthId={summary.month.id}
              initialSavings={summary.savings}
              isReadOnly={isReadOnly}
              refreshTrigger={refreshTrigger}
            />
            {currentAccountEnabled && (
              <CurrentAccountCard
                monthId={summary.month.id}
                initialBalance={currentAccount}
                isReadOnly={isReadOnly}
                onUpdate={updateCurrentAccount}
                onTransferComplete={refresh}
              />
            )}
            {customSavingsGoalsEnabled && <CustomSavingsGoals />}
          </div>
        </ErrorBoundary>

        <ErrorBoundary section="Income & Expenses">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <IncomeSection
              monthId={summary.month.id}
              entries={summary.income_entries}
              isReadOnly={isReadOnly}
              onUpdate={refresh}
            />
            <FixedExpenses
              monthId={summary.month.id}
              expenses={summary.fixed_expenses}
              isReadOnly={isReadOnly}
              onUpdate={refresh}
            />
            <BudgetSection
              monthId={summary.month.id}
              budgets={summary.budgets}
              categories={categories}
              isReadOnly={isReadOnly}
              onUpdate={refresh}
            />
          </div>
        </ErrorBoundary>

        {recurringItemsEnabled && (
          <ErrorBoundary section="Recurring Items">
            <RecurringItemsInMonth
              monthId={summary.month.id}
              items={summary.items}
              isReadOnly={isReadOnly}
              onUpdate={refresh}
            />
          </ErrorBoundary>
        )}

        <ErrorBoundary section="Items">
          <ItemsSection
            monthId={summary.month.id}
            items={summary.items}
            categories={categories}
            isReadOnly={isReadOnly}
            onUpdate={refresh}
          />
        </ErrorBoundary>

        {(transfersEnabled || summary.items.some(item => item.savings_destination === "savings" || item.savings_destination === "retirement_savings")) && (
          <ErrorBoundary section="Transfers">
            <TransfersCard 
              monthId={summary.month.id}
              items={summary.items}
              categories={categories}
              isReadOnly={isReadOnly}
              onUpdate={refresh}
            />
          </ErrorBoundary>
        )}

        <ErrorBoundary section="Retirement Plan">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RetirementBreakdownCard />
          </div>
        </ErrorBoundary>
      </div>

      <footer className="mt-12 py-4 text-center text-xs text-charcoal-400 dark:text-charcoal-600">
        {new Date().toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </footer>

      <VarianceModal
        isOpen={showVarianceModal}
        onClose={() => setShowVarianceModal(false)}
        budgets={summary.budgets}
        totalIncome={summary.total_income}
        totalFixed={summary.total_fixed}
        totalBudgeted={summary.total_budgeted}
      />
    </Layout>
  );
}


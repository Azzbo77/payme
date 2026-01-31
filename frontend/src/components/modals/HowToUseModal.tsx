import { Modal } from "../ui/Modal";
import { ChevronDown, Calendar, Wallet, CreditCard, PieChart, ShoppingCart, Vault, BarChart3, Settings } from "lucide-react";
import { useState } from "react";

interface HowToUseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Section {
  title: string;
  icon: React.ReactNode;
  content: string[];
}

export function HowToUseModal({ isOpen, onClose }: HowToUseModalProps) {
  const [expandedSection, setExpandedSection] = useState<number | null>(0);

  const sections: Section[] = [
    {
      title: "Monthly Structure",
      icon: <Calendar size={20} className="text-charcoal-600 dark:text-sand-300" />,
      content: [
        "Payme operates on a monthly basis. Each month is independent and contains its own income, expenses, budgets, and items.",
        "You can create new months, close completed months, or reopen closed months for adjustments.",
        "Closed months are read-only and cannot be modified - you'll need to reopen them first.",
      ],
    },
    {
      title: "Income Section",
      icon: <Wallet size={20} className="text-sage-600 dark:text-sage-400" />,
      content: [
        "Add your monthly income sources here (salary, bonus, side gigs, etc.).",
        "This is monthly income - it will reset for each new month.",
        "Your total income is used to calculate remaining funds and check budget feasibility.",
      ],
    },
    {
      title: "Fixed Expenses",
      icon: <CreditCard size={20} className="text-charcoal-600 dark:text-charcoal-400" />,
      content: [
        "Fixed expenses are costs that stay the same each month (rent, insurance, subscriptions, etc.).",
        "These are tracked separately from budgeted categories.",
        "Fixed expenses are deducted from your income to determine available funds for budgeting.",
      ],
    },
    {
      title: "Budget Section",
      icon: <PieChart size={20} className="text-charcoal-600 dark:text-charcoal-400" />,
      content: [
        "Set budget allocations for different spending categories (groceries, entertainment, etc.).",
        "Track your spending against these budgets throughout the month.",
        "The Budget Analysis shows where you're over/under budget and identifies unplanned expenses.",
      ],
    },
    {
      title: "Items & Spending",
      icon: <ShoppingCart size={20} className="text-terracotta-600 dark:text-terracotta-400" />,
      content: [
        "Log individual purchases and expenses under different categories.",
        "Each item can be marked as going to savings, retirement savings, or back to income.",
        "Items are monthly - they're associated with a specific month.",
      ],
    },
    {
      title: "Savings Cards",
      icon: <Vault size={20} className="text-sage-600 dark:text-sage-400" />,
      content: [
        "General Savings: Shows your accumulated savings across all months.",
        "Retirement Savings: Tracks long-term retirement contributions.",
        "Custom Goals: Set and monitor specific savings targets.",
        "Transfers: Manage movements between income, savings, and retirement accounts.",
      ],
    },
    {
      title: "Statistics & Reports",
      icon: <BarChart3 size={20} className="text-charcoal-600 dark:text-charcoal-400" />,
      content: [
        "View spending trends, category analysis, and monthly comparisons.",
        "Identify patterns in your spending habits.",
        "Use insights to refine budgets and savings plans.",
      ],
    },
    {
      title: "Settings",
      icon: <Settings size={20} className="text-charcoal-600 dark:text-charcoal-400" />,
      content: [
        "Configure your currency preference for display throughout the app.",
        "Enable/disable optional features like transfers.",
        "Export and import your data for backup or migration.",
      ],
    },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="How to Use Payme">
      <div className="space-y-2">
        {sections.map((section, index) => (
          <div
            key={index}
            className="border border-sand-200 dark:border-charcoal-700 rounded-lg overflow-hidden"
          >
            <button
              onClick={() =>
                setExpandedSection(expandedSection === index ? null : index)
              }
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-sand-100 dark:hover:bg-charcoal-800 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                {section.icon}
                <h3 className="font-semibold text-charcoal-800 dark:text-sand-100">
                  {section.title}
                </h3>
              </div>
              <ChevronDown
                size={20}
                className={`transition-transform ${
                  expandedSection === index ? "rotate-180" : ""
                }`}
              />
            </button>
            {expandedSection === index && (
              <div className="px-4 py-3 bg-sand-50 dark:bg-charcoal-900/50 border-t border-sand-200 dark:border-charcoal-700 space-y-2">
                {section.content.map((text, textIndex) => (
                  <p key={textIndex} className="text-sm text-charcoal-600 dark:text-charcoal-300 leading-relaxed">
                    {text}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

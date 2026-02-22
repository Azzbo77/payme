import { ApiError, parseApiError } from "./errors";

const BASE_URL = "/api";

// Track if we're currently refreshing to avoid duplicate refresh calls
let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(): Promise<void> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        // Refresh failed, user needs to log in again
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        throw new ApiError("Session expired", "auth", 401);
      }
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  retried = false
): Promise<T> {
  let response: Response;
  
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      credentials: "include",
    });
  } catch (err) {
    // Network error
    const message = err instanceof Error ? err.message : "Network error";
    throw new ApiError(message, "network", 0);
  }

  // Handle 401 - attempt to refresh token and retry
  if (response.status === 401 && !retried && !endpoint.includes("/auth/")) {
    try {
      await refreshAccessToken();
      // Retry the request with the new token
      return request<T>(endpoint, options, true);
    } catch {
      // Refresh failed, let the error propagate
      const requestId = response.headers.get("x-request-id") || undefined;
      throw parseApiError(401, null, requestId);
    }
  }

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    const requestId = (body as Record<string, unknown> | null)?.request_id as
      | string
      | undefined;
    throw parseApiError(response.status, body, requestId);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  auth: {
    register: (username: string, password: string) =>
      request<{ id: number; username: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }),
    login: (username: string, password: string) =>
      request<{ id: number; username: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }),
    logout: () => request<void>("/auth/logout", { method: "POST" }),
    refresh: () => request<{ id: number; username: string }>("/auth/refresh", { method: "POST" }),
    me: () => request<{ id: number; username: string }>("/auth/me"),
    changeUsername: (newUsername: string) =>
      request<{ id: number; username: string }>("/auth/change-username", {
        method: "PUT",
        body: JSON.stringify({ new_username: newUsername }),
      }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ message: string }>("/auth/change-password", {
        method: "PUT",
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      }),
    clearAllData: (password: string) =>
      request<{ message: string }>("/auth/clear-data", {
        method: "DELETE",
        body: JSON.stringify({ password }),
      }),
  },

  months: {
    list: () => request<Month[]>("/months"),
    current: () => request<MonthSummary>("/months/current"),
    get: (id: number) => request<MonthSummary>(`/months/${id}`),
    create: (year: number, month: number) =>
      request<MonthSummary>("/months", {
        method: "POST",
        body: JSON.stringify({ year, month }),
      }),
    close: (id: number) => request<Month>(`/months/${id}/close`, { method: "POST" }),
    reopen: (id: number) => request<Month>(`/months/${id}/reopen`, { method: "POST" }),
    downloadPdf: async (id: number) => {
      const response = await fetch(`${BASE_URL}/months/${id}/pdf`, {
        credentials: "include",
      });
      return response.blob();
    },
    getPayday: () => request<{ payday: number }>("/payday/preferences"),
    setPayday: (payday: number) =>
      request<{ payday: number }>("/payday/preferences", {
        method: "PUT",
        body: JSON.stringify({ payday }),
      }),
    getPaydayModeEnabled: () =>
      request<{ enabled: boolean }>("/payday-mode/preferences/enabled"),
    setPaydayModeEnabled: (enabled: boolean) =>
      request<{ enabled: boolean }>("/payday-mode/preferences/enabled", {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      }),
  },

  fixedExpenses: {
    list: () => request<FixedExpense[]>("/fixed-expenses"),
    create: (data: { label: string; amount: number; auto_generate?: boolean }) =>
      request<FixedExpense>("/fixed-expenses", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: { label?: string; amount?: number; auto_generate?: boolean }) =>
      request<FixedExpense>(`/fixed-expenses/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request<void>(`/fixed-expenses/${id}`, { method: "DELETE" }),
    getEnabled: () =>
      request<{ enabled: boolean }>(`/fixed-expenses/preferences/enabled`),
    setEnabled: (enabled: boolean) =>
      request<{ enabled: boolean }>(`/fixed-expenses/preferences/enabled`, {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      }),
  },

  recurringItems: {
    list: () => request<RecurringItem[]>("/recurring-items"),
    create: (data: {
      category_id: number;
      description: string;
      amount: number;
      day_of_month: number;
      savings_destination?: string;
    }) =>
      request<RecurringItem>("/recurring-items", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      id: number,
      data: {
        category_id?: number;
        description?: string;
        amount?: number;
        day_of_month?: number;
        savings_destination?: string;
        is_active?: boolean;
      }
    ) =>
      request<RecurringItem>(`/recurring-items/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request<void>(`/recurring-items/${id}`, { method: "DELETE" }),
  },

  categories: {
    list: () => request<BudgetCategory[]>("/categories"),
    create: (data: { label: string; default_amount: number }) =>
      request<BudgetCategory>("/categories", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: { label?: string; default_amount?: number }) =>
      request<BudgetCategory>(`/categories/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request<void>(`/categories/${id}`, { method: "DELETE" }),
  },

  budgets: {
    list: (monthId: number) => request<MonthlyBudget[]>(`/months/${monthId}/budgets`),
    update: (monthId: number, budgetId: number, amount: number) =>
      request<MonthlyBudget>(`/months/${monthId}/budgets/${budgetId}`, {
        method: "PUT",
        body: JSON.stringify({ allocated_amount: amount }),
      }),
  },

  income: {
    list: (monthId: number) => request<IncomeEntry[]>(`/months/${monthId}/income`),
    create: (monthId: number, data: { label: string; amount: number }) =>
      request<IncomeEntry>(`/months/${monthId}/income`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      monthId: number,
      incomeId: number,
      data: { label?: string; amount?: number }
    ) =>
      request<IncomeEntry>(`/months/${monthId}/income/${incomeId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (monthId: number, incomeId: number) =>
      request<void>(`/months/${monthId}/income/${incomeId}`, { method: "DELETE" }),
  },

  items: {
    list: (monthId: number) => request<ItemWithCategory[]>(`/months/${monthId}/items`),
    create: (
      monthId: number,
      data: { category_id: number; description: string; amount: number; spent_on: string; savings_destination?: string }
    ) =>
      request<Item>(`/months/${monthId}/items`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      monthId: number,
      itemId: number,
      data: {
        category_id?: number;
        description?: string;
        amount?: number;
        spent_on?: string;
        savings_destination?: string;
      }
    ) =>
      request<Item>(`/months/${monthId}/items/${itemId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (monthId: number, itemId: number) =>
      request<void>(`/months/${monthId}/items/${itemId}`, { method: "DELETE" }),
  },

  stats: {
    get: () => request<StatsResponse>("/stats"),
  },

  exportDb: async () => {
    const response = await fetch(`${BASE_URL}/export`, {
      credentials: "include",
    });
    return response.blob();
  },

  exportJson: async () => {
    return request<UserExport>("/export/json");
  },

  importJson: async (data: UserExport) => {
    return request<void>("/import/json", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  backups: {
    create: async (reason?: string) =>
      request<{ filename: string; timestamp: string; size: string; size_bytes: number }>("/backups/create", {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    list: () =>
      request<{ backups: Array<{ filename: string; timestamp: string; size: string; size_bytes: number }>; total_count: number }>("/backups/list"),
    delete: (filename: string) =>
      request<void>(`/backups/${filename}`, {
        method: "DELETE",
      }),
    restore: (filename: string) =>
      request<void>(`/backups/${filename}/restore`, {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
      }),
  },

  savings: {
    get: () => request<{ savings: number; savings_goal: number }>("/savings"),
    update: (savings: number) =>
      request<{ savings: number; savings_goal: number }>("/savings", {
        method: "PUT",
        body: JSON.stringify({ savings }),
      }),
    updateGoal: (savings_goal: number) =>
      request<{ savings: number; savings_goal: number }>("/savings/goal", {
        method: "PUT",
        body: JSON.stringify({ savings_goal }),
      }),
  },

  monthlySavings: {
    get: (monthId: number) =>
      request<MonthlySavings>(`/months/${monthId}/savings`),
    update: (
      monthId: number,
      data: { savings?: number; retirement_savings?: number; savings_goal?: number }
    ) =>
      request<MonthlySavings>(`/months/${monthId}/savings`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
  },

  monthlyFixedExpenses: {
    getAvailable: (monthId: number) =>
      request<FixedExpense[]>(`/months/${monthId}/available-fixed-expenses`),
    create: (monthId: number, data: { label: string; amount: number; fixed_expense_id?: number }) =>
      request<MonthlyFixedExpense>(`/months/${monthId}/fixed-expenses`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (monthId: number, id: number, data: { label?: string; amount?: number; fixed_expense_id?: number }) =>
      request<MonthlyFixedExpense>(`/months/${monthId}/fixed-expenses/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (monthId: number, id: number) =>
      request<void>(`/months/${monthId}/fixed-expenses/${id}`, { method: "DELETE" }),
  },

  monthlyCurrentAccount: {
    get: (monthId: number) =>
      request<CurrentAccountBalance>(`/months/${monthId}/current-account`),
    update: (monthId: number, balance: number) =>
      request<CurrentAccountBalance>(`/months/${monthId}/current-account`, {
        method: "PUT",
        body: JSON.stringify({ balance }),
      }),
    transfer: (monthId: number, amount: number, destination: "savings" | "retirement_savings") =>
      request<{ success: boolean; message: string }>(`/months/${monthId}/transfer`, {
        method: "POST",
        body: JSON.stringify({ amount, destination }),
      }),
    getEnabled: () =>
      request<{ enabled: boolean }>(`/current-account/preferences/enabled`),
    setEnabled: (enabled: boolean) =>
      request<{ enabled: boolean }>(`/current-account/preferences/enabled`, {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      }),
  },

  customSavingsGoals: {
    getEnabled: () =>
      request<{ enabled: boolean }>(`/custom-savings-goals/preferences/enabled`),
    setEnabled: (enabled: boolean) =>
      request<{ enabled: boolean }>(`/custom-savings-goals/preferences/enabled`, {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      }),
  },

  retirementSavings: {
    get: () => request<{ retirement_savings: number }>("/retirement-savings"),
    update: (retirement_savings: number) =>
      request<{ retirement_savings: number }>("/retirement-savings", {
        method: "PUT",
        body: JSON.stringify({ retirement_savings }),
      }),
  },

  retirementBreakdown: {
    list: () => request<RetirementBreakdownItem[]>("/retirement-breakdown"),
    create: (data: {
      label: string;
      amount: number;
      type: string;
      ticker?: string;
      quantity?: number;
      current_price?: number;
      last_updated?: number;
    }) =>
      request<RetirementBreakdownItem>("/retirement-breakdown", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      id: number,
      data: {
        label: string;
        amount: number;
        type: string;
        ticker?: string;
        quantity?: number;
        current_price?: number;
        last_updated?: number;
      }
    ) =>
      request<RetirementBreakdownItem>(`/retirement-breakdown/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request<void>(`/retirement-breakdown/${id}`, { method: "DELETE" }),
  },

  recurringWages: {
    list: () => request<RecurringWage[]>("/recurring-wages"),
    getCurrent: () => request<RecurringWage>("/recurring-wages/current"),
    create: (data: { amount: number; label: string; effective_from: string }) =>
      request<RecurringWage>("/recurring-wages", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: { amount?: number; label?: string; effective_from?: string }) =>
      request<RecurringWage>(`/recurring-wages/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request<void>(`/recurring-wages/${id}`, { method: "DELETE" }),
    getEnabled: () => request<{ enabled: boolean }>("/recurring-wages/preferences/enabled"),
    setEnabled: (enabled: boolean) =>
      request<{ enabled: boolean }>("/recurring-wages/preferences/enabled", {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      }),
  },
};

export interface BreakdownItem {
  id: string;
  label: string;
  amount: number;
  type?: "custom" | "stock";
  ticker?: string;
  quantity?: number;
  currentPrice?: number;
  lastUpdated?: number;
  currencyCode?: string;
  ciphertext?: string;
  iv?: string;
  salt?: string;
  version?: number;
}

export interface UserExport {
  version: number;
  savings?: number;
  retirement_savings?: number;
  portfolio?: BreakdownItem[];
  preferences?: {
    recurring_wages_enabled: boolean;
    current_account_enabled: boolean;
    custom_savings_goals_enabled: boolean;
    fixed_expenses_enabled: boolean;
    stock_tracking_enabled: boolean;
  };
  fixed_expenses: { label: string; amount: number }[];
  categories: { label: string; default_amount: number }[];
  recurring_wages?: { label: string; amount: number; effective_from: string }[];
  months: {
    year: number;
    month: number;
    is_closed: boolean;
    current_account_balance?: number;
    monthly_savings_amount?: number;
    monthly_savings_goal?: number;
    monthly_retirement_savings_goal?: number;
    income_entries: { label: string; amount: number }[];
    budgets: { category_label: string; allocated_amount: number }[];
    items: { category_label: string; description: string; amount: number; spent_on: string; savings_destination: string }[];
    monthly_fixed_expenses?: { label: string; amount: number }[];
  }[];
}

export interface Month {
  id: number;
  user_id: number;
  year: number;
  month: number;
  is_closed: boolean;
  closed_at: string | null;
}

export interface FixedExpense {
  id: number;
  user_id: number;
  label: string;
  amount: number;
  auto_generate: boolean;
}

export interface MonthlyFixedExpense {
  id: number;
  month_id: number;
  fixed_expense_id?: number | null;
  label: string;
  amount: number;
}

export interface BudgetCategory {
  id: number;
  user_id: number;
  label: string;
  default_amount: number;
}

export interface MonthlyBudget {
  id: number;
  month_id: number;
  category_id: number;
  allocated_amount: number;
}

export interface MonthlyBudgetWithCategory {
  id: number;
  month_id: number;
  category_id: number;
  category_label: string;
  allocated_amount: number;
  spent_amount: number;
}

export interface IncomeEntry {
  id: number;
  month_id: number;
  label: string;
  amount: number;
}

export interface Item {
  id: number;
  month_id: number;
  category_id: number;
  description: string;
  amount: number;
  spent_on: string;
  savings_destination: string;
  recurring_item_id?: number | null;
}

export interface ItemWithCategory extends Item {
  category_label: string;
}

export interface MonthlySavings {
  id: number;
  month_id: number;
  savings: number;
  retirement_savings: number;
  savings_goal: number;
}

export interface MonthSummary {
  month: Month;
  income_entries: IncomeEntry[];
  fixed_expenses: MonthlyFixedExpense[];
  budgets: MonthlyBudgetWithCategory[];
  items: ItemWithCategory[];
  savings: MonthlySavings | null;
  total_income: number;
  total_fixed: number;
  total_budgeted: number;
  total_spent: number;
  remaining: number;
}

export interface CategoryStats {
  category_id: number;
  category_label: string;
  current_month_spent: number;
  previous_month_spent: number;
  change_amount: number;
  change_percent: number | null;
}

export interface MonthlyStats {
  year: number;
  month: number;
  total_income: number;
  total_spent: number;
  total_fixed: number;
  net: number;
}

export interface StatsResponse {
  category_comparisons: CategoryStats[];
  monthly_trends: MonthlyStats[];
  average_monthly_spending: number;
  average_monthly_income: number;
}

export interface RecurringWage {
  id: number;
  user_id: number;
  amount: number;
  label: string;
  effective_from: string;
  created_at: string;
}

export interface RecurringItem {
  id: number;
  user_id: number;
  category_id: number;
  description: string;
  amount: number;
  day_of_month: number;
  savings_destination: string;
  is_active: boolean;
  created_at: string;
}

export interface CurrentAccountBalance {
  id: number;
  month_id: number;
  balance: number;
}

export interface RetirementBreakdownItem {
  id: number;
  user_id: number;
  label: string;
  amount: number;
  type: string;
  ticker?: string;
  quantity?: number;
  current_price?: number;
  last_updated?: number;
  created_at: string;
  updated_at: string;
}



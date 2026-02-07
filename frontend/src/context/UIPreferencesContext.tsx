import { createContext, useContext, useState, ReactNode } from "react";
import { api } from "../api/client";

interface UIPreferencesContextType {
  transfersEnabled: boolean;
  setTransfersEnabled: (enabled: boolean) => void;
  retirementBreakdownEnabled: boolean;
  setRetirementBreakdownEnabled: (enabled: boolean) => void;
  recurringWagesEnabled: boolean;
  setRecurringWagesEnabled: (enabled: boolean) => void;
  currentAccountEnabled: boolean;
  setCurrentAccountEnabled: (enabled: boolean) => void;
}

const UIPreferencesContext = createContext<UIPreferencesContextType | undefined>(undefined);

const STORAGE_KEY = "uiPreferences";

export function UIPreferencesProvider({ children }: { children: ReactNode }) {
  const [transfersEnabled, setTransfersEnabledState] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const prefs = JSON.parse(stored);
        return prefs.transfersEnabled ?? true;
      } catch {
        return true;
      }
    }
    return true;
  });

  const [retirementBreakdownEnabled, setRetirementBreakdownEnabledState] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const prefs = JSON.parse(stored);
        return prefs.retirementBreakdownEnabled ?? false;
      } catch {
        return false;
      }
    }
    return false;
  });

  const [recurringWagesEnabled, setRecurringWagesEnabledState] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const prefs = JSON.parse(stored);
        return prefs.recurringWagesEnabled ?? true;
      } catch {
        return true;
      }
    }
    return true;
  });

  const [currentAccountEnabled, setCurrentAccountEnabledState] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const prefs = JSON.parse(stored);
        return prefs.currentAccountEnabled ?? true;
      } catch {
        return true;
      }
    }
    return true;
  });

  const setTransfersEnabled = (enabled: boolean) => {
    setTransfersEnabledState(enabled);
    const stored = localStorage.getItem(STORAGE_KEY);
    const prefs = stored ? JSON.parse(stored) : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prefs, transfersEnabled: enabled }));
  };

  const setRetirementBreakdownEnabled = (enabled: boolean) => {
    setRetirementBreakdownEnabledState(enabled);
    const stored = localStorage.getItem(STORAGE_KEY);
    const prefs = stored ? JSON.parse(stored) : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prefs, retirementBreakdownEnabled: enabled }));
  };

  const setRecurringWagesEnabled = (enabled: boolean) => {
    setRecurringWagesEnabledState(enabled);
    const stored = localStorage.getItem(STORAGE_KEY);
    const prefs = stored ? JSON.parse(stored) : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prefs, recurringWagesEnabled: enabled }));
    // Sync to server
    api.recurringWages.setEnabled(enabled).catch((e) => {
      console.error("Failed to sync recurring wages enabled preference:", e);
    });
  };

  const setCurrentAccountEnabled = (enabled: boolean) => {
    setCurrentAccountEnabledState(enabled);
    const stored = localStorage.getItem(STORAGE_KEY);
    const prefs = stored ? JSON.parse(stored) : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prefs, currentAccountEnabled: enabled }));
    // Sync to server
    api.monthlyCurrentAccount.setEnabled(enabled).catch((e) => {
      console.error("Failed to sync current account enabled preference:", e);
    });
  };

  return (
    <UIPreferencesContext.Provider value={{ transfersEnabled, setTransfersEnabled, retirementBreakdownEnabled, setRetirementBreakdownEnabled, recurringWagesEnabled, setRecurringWagesEnabled, currentAccountEnabled, setCurrentAccountEnabled }}>
      {children}
    </UIPreferencesContext.Provider>
  );
}

export function useUIPreferences() {
  const context = useContext(UIPreferencesContext);
  if (context === undefined) {
    throw new Error("useUIPreferences must be used within UIPreferencesProvider");
  }
  return context;
}

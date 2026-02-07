import { useState } from "react";

interface UseCardEditOptions {
  initialValue: number;
  onSave: (value: number) => Promise<void> | void;
}

export function useCardEdit({ initialValue, onSave }: UseCardEditOptions) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const startEdit = () => {
    setEditValue(initialValue.toString());
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditValue("");
  };

  const saveEdit = async () => {
    const value = parseFloat(editValue);
    if (isNaN(value)) return;

    setIsLoading(true);
    try {
      await onSave(value);
      setIsEditing(false);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isEditing,
    editValue,
    isLoading,
    startEdit,
    cancelEdit,
    saveEdit,
    setEditValue,
  };
}

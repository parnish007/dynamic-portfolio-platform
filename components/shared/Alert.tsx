// components/shared/Alert.tsx

import { X } from "lucide-react";
import { useState } from "react";

type AlertVariant = "success" | "warning" | "error";

interface AlertProps {
  variant?: AlertVariant;
  message: string;
  onClose?: () => void;
  className?: string;
}

const variantClasses: Record<AlertVariant, string> = {
  success: "bg-green-900/30 border-green-700 text-green-200",
  warning: "bg-yellow-900/30 border-yellow-700 text-yellow-200",
  error: "bg-red-900/30 border-red-700 text-red-200",
};

export default function Alert({
  variant = "success",
  message,
  onClose,
  className = "",
}: AlertProps) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const handleClose = () => {
    setVisible(false);
    if (onClose) onClose();
  };

  return (
    <div
      className={`relative flex items-center justify-between rounded-xl border p-4 text-sm ${variantClasses[variant]} ${className}`}
      role="alert"
    >
      <span>{message}</span>
      <button
        onClick={handleClose}
        className="ml-4 rounded focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-white"
        aria-label="Close alert"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

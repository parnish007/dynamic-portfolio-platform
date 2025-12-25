// components/shared/Toast.tsx

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";

interface ToastProps {
  message: string;
  duration?: number; // in ms, default 3000
  onClose?: () => void;
  className?: string;
}

export default function Toast({
  message,
  duration = 3000,
  onClose,
  className = "",
}: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      if (onClose) onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex max-w-xs items-center justify-between rounded-lg bg-zinc-900/90 px-4 py-3 text-sm text-zinc-200 shadow-lg animate-slide-in ${className}`}
    >
      <span>{message}</span>
      <button
        onClick={() => {
          setVisible(false);
          if (onClose) onClose();
        }}
        className="ml-4 text-zinc-400 hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-500 rounded"
        aria-label="Close toast"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

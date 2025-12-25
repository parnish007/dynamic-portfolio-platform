// components/shared/Modal.tsx

import { X } from "lucide-react";
import React, { ReactNode, useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  className = "",
}: ModalProps) {
  // Close on ESC
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-lg rounded-xl bg-zinc-900 p-6 shadow-lg ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 rounded"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {title && <h2 className="mb-4 text-lg font-semibold text-zinc-100">{title}</h2>}

        <div>{children}</div>
      </div>
    </div>
  );
}

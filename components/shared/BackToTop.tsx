// components/shared/BackToTop.tsx

import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";

interface BackToTopProps {
  scrollThreshold?: number; // px scrolled before showing the button
  className?: string;
}

export default function BackToTop({
  scrollThreshold = 300,
  className = "",
}: BackToTopProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > scrollThreshold);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [scrollThreshold]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!visible) return null;

  return (
    <button
      onClick={scrollToTop}
      className={`fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900/80 text-white shadow-lg transition hover:bg-zinc-900/100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-500 ${className}`}
      aria-label="Scroll to top"
    >
      <ArrowUp className="h-6 w-6" />
    </button>
  );
}

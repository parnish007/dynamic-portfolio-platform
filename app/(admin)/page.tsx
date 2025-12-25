// app/page.tsx

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dynamic Portfolio Platform",
  description: "AI-powered, fully dynamic portfolio platform",
};

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: "0.75rem",
      }}
    >
      <h1>Dynamic Portfolio Platform</h1>
      <p>Home page placeholder</p>
    </main>
  );
}

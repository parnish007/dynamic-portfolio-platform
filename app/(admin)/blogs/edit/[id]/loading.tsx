// app/(admin)/blogs/edit/[id]/loading.tsx

export default function LoadingBlogEditor() {
  return (
    <section style={{ maxWidth: 980 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Edit Blog</h1>
        <p style={{ marginTop: 6, opacity: 0.6 }}>
          Loading blog editor…
        </p>
      </header>

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: 14,
          background: "rgba(255,255,255,0.02)",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "grid", gap: 10 }}>
          <Skeleton height={20} width="60%" />
          <Skeleton height={36} />
          <Skeleton height={36} />
          <Skeleton height={36} />
          <Skeleton height={90} />
          <Skeleton height={260} />
        </div>
      </div>
    </section>
  );
}

function Skeleton(props: { height: number; width?: string }) {
  return (
    <div
      style={{
        height: props.height,
        width: props.width ?? "100%",
        borderRadius: 8,
        background:
          "linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.12), rgba(255,255,255,0.06))",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.2s infinite",
      }}
    />
  );
}

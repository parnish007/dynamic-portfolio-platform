// app/(admin)/projects/edit/[id]/loading.tsx

export default function LoadingProjectEdit() {
  return (
    <section style={{ maxWidth: 980 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Edit Project</h1>
        <p style={{ marginTop: 6, opacity: 0.75 }}>Loading project…</p>
      </header>

      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <div
            style={{
              height: 14,
              width: 180,
              borderRadius: 6,
              background: "rgba(255,255,255,0.06)",
            }}
          />
          <div
            style={{
              height: 12,
              width: "60%",
              borderRadius: 6,
              background: "rgba(255,255,255,0.05)",
            }}
          />

          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "8px 0" }} />

          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ display: "grid", gap: 6 }}>
              <div
                style={{
                  height: 10,
                  width: 120,
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.05)",
                }}
              />
              <div
                style={{
                  height: 36,
                  width: "100%",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.02)",
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

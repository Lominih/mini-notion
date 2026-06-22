"use client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1rem" }}>系统错误</h2>
          <p style={{ color: "#666", marginBottom: "1rem" }}>{error.message || "发生了严重错误"}</p>
          <button onClick={reset} style={{ padding: "0.5rem 1rem", background: "#000", color: "#fff", borderRadius: "0.5rem", border: "none", cursor: "pointer" }}>重新加载</button>
        </div>
      </body>
    </html>
  );
}
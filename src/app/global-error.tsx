"use client";

const buttonStyle = {
  border: 0,
  borderRadius: "999px",
  background: "#17684f",
  color: "white",
  cursor: "pointer",
  fontSize: "16px",
  fontWeight: 700,
  padding: "13px 24px",
};

export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          alignItems: "center",
          background: "#f7f7f2",
          color: "#17241f",
          display: "flex",
          fontFamily: "Arial, sans-serif",
          justifyContent: "center",
          margin: 0,
          minHeight: "100vh",
          padding: "24px",
        }}
      >
        <main style={{ maxWidth: "620px", textAlign: "center" }}>
          <title>Something went wrong | Auxilium</title>
          <p
            style={{
              color: "#17684f",
              fontSize: "14px",
              fontWeight: 700,
              letterSpacing: "3px",
              textTransform: "uppercase",
            }}
          >
            Auxilium
          </p>
          <h1 style={{ color: "#0f4f3d", fontSize: "42px", margin: "20px 0" }}>
            We hit an unexpected problem.
          </h1>
          <p style={{ color: "#64746d", fontSize: "18px", lineHeight: 1.7 }}>
            Your information is still safe. Please try loading Auxilium again.
          </p>
          <button type="button" onClick={() => retry()} style={buttonStyle}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

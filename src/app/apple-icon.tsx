import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#FFCF00",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          fontWeight: 900,
          letterSpacing: -2,
          borderRadius: 28,
        }}
      >
        <div style={{ display: "flex", fontSize: 92, lineHeight: 1 }}>
          <span style={{ color: "#D01012" }}>L</span>
          <span style={{ color: "#1B1B1B" }}>F</span>
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 18,
            color: "#1B1B1B",
            letterSpacing: 2,
            fontWeight: 700,
          }}
        >
          FUTURE
        </div>
      </div>
    ),
    { ...size }
  );
}

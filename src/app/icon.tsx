import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#FFCF00",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#1B1B1B",
          fontSize: 20,
          fontWeight: 900,
          letterSpacing: -1,
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          borderRadius: 6,
        }}
      >
        BF
      </div>
    ),
    { ...size }
  );
}

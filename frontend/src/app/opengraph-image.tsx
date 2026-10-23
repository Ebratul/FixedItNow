import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#0d1b33",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", fontSize: 88, fontWeight: 800 }}>
          <span>Fixed</span>
          <span style={{ color: "#3db8ab" }}>It</span>
          <span>Now</span>
        </div>
        <div style={{ fontSize: 40, marginTop: 24, color: "#c3d3ec" }}>
          {SITE_TAGLINE}
        </div>
      </div>
    ),
    size,
  );
}

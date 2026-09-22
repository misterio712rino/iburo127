import { ImageResponse } from "next/og";

/** One artwork for the favicon, Android install and iOS home-screen icon. */
export function renderIBuroAppIcon(dimension: number): ImageResponse {
  const p = (value: number) => (value * dimension) / 512;
  const gold = "#E6C483";
  const white = "#F7F9FE";
  const line = (left: number, top: number, width: number, height: number, color: string) => (
    <div
      style={{
        position: "absolute",
        left: p(left),
        top: p(top),
        width: p(width),
        height: p(height),
        backgroundColor: color,
        borderRadius: p(7),
      }}
    />
  );

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        position: "relative",
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#102340",
        color: white,
      }}
    >
      {line(251, 129, 10, 219, white)}
      {line(109, 155, 294, 9, white)}
      <div
        style={{
          position: "absolute",
          left: p(243),
          top: p(115),
          width: p(26),
          height: p(26),
          borderRadius: "50%",
          backgroundColor: white,
        }}
      />
      {line(151, 164, 5, 95, gold)}
      {line(356, 164, 5, 95, gold)}
      {line(104, 255, 99, 13, gold)}
      {line(309, 255, 99, 13, gold)}
      {line(206, 343, 100, 10, white)}
      {line(188, 354, 136, 11, white)}
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: p(379),
          left: p(64),
          width: p(384),
          height: p(83),
          justifyContent: "center",
          alignItems: "center",
          fontSize: p(58),
          fontWeight: 700,
          letterSpacing: p(-1),
          color: white,
        }}
      >
        iБюро
      </div>
    </div>,
    { width: dimension, height: dimension },
  );
}

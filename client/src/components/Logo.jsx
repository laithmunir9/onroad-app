export default function Logo({ size = 30, radius = 8 }) {
  return (
    <img
      src="/logo.png"
      alt="OnRoad"
      width={size}
      height={size}
      style={{ borderRadius: radius, objectFit: "cover", flex: "none" }}
    />
  );
}

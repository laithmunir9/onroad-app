// No onroad-logo.png asset was included in the design bundle — this mark is
// recreated from the wheel/eye motif defined in the bundle's own thumbnail template.
export default function Logo({ size = 30, radius = 8 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      style={{ borderRadius: radius, flex: "none" }}
    >
      <rect width="48" height="48" rx={radius} fill="#030c22" />
      <circle cx="24" cy="24" r="13" fill="none" stroke="#35D6A4" strokeWidth="2.6" opacity="0.6" />
      <path
        d="M15.5 24.5s3.2-6 8.5-6 8.5 6 8.5 6-3.2 6-8.5 6-8.5-6-8.5-6Z"
        fill="none"
        stroke="#F5A623"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="24" cy="24.5" r="3.1" fill="#F5A623" />
    </svg>
  );
}

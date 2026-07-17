import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "./Icons";

export default function BackButton({ to = "/", onClick, style }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={onClick || (() => navigate(to))}
      aria-label="Back"
      style={{
        width: 40,
        height: 40,
        borderRadius: 14,
        background: "rgba(255,255,255,.05)",
        border: "1px solid rgba(255,255,255,.12)",
        color: "#a9bdde",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flex: "none",
        ...style,
      }}
    >
      <ArrowLeftIcon size={18} color="#a9bdde" />
    </button>
  );
}

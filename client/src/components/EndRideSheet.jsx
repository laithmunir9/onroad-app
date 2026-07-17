import Button from "./Button";

export default function EndRideSheet({
  onCancel,
  onConfirm,
  title = "End this ride?",
  description = (
    <>
      Monitoring will stop and you'll get a
      <br />
      safety summary for the trip.
    </>
  ),
  confirmLabel = "End Ride & view summary",
  cancelLabel = "Keep watching",
}) {
  return (
    <div
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(3,10,25,.72)", animation: "fadeIn .2s ease", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#0c1e40", borderTop: "1px solid rgba(255,255,255,.1)", borderRadius: "28px 26px 0 0", padding: "28px 24px 40px", animation: "sheetUp .28s cubic-bezier(.2,.8,.2,1)" }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,.2)", margin: "0 auto 22px" }} />
        <div style={{ fontSize: 21, fontWeight: 700, textAlign: "center" }}>{title}</div>
        <div style={{ fontSize: 14, color: "#8298c0", textAlign: "center", margin: "9px 0 26px", lineHeight: 1.5 }}>{description}</div>
        <div style={{ marginBottom: 11 }}>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
        <Button variant="ghost" onClick={onCancel} height={52}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}

import React from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";

export function ConfirmModal({
  isOpen,
  aberto,
  onClose,
  aoFechar,
  onConfirm,
  aoConfirmar,
  title,
  titulo,
  message,
  mensagem,
  confirmLabel,
  textoConfirmar,
  cancelLabel,
  textoCancelar,
  isDanger,
  perigo
}) {
  const modalOpen = isOpen !== undefined ? isOpen : aberto;
  const fechar = onClose || aoFechar;
  const confirmar = onConfirm || aoConfirmar;
  const modalTitle = title || titulo || "Confirmar Operação";
  const modalMsg = message || mensagem || "Tem certeza de que deseja realizar esta ação?";
  const btnConfirm = confirmLabel || textoConfirmar || "Confirmar";
  const btnCancel = cancelLabel || textoCancelar || "Cancelar";
  const danger = isDanger !== undefined ? isDanger : (perigo !== undefined ? perigo : true);

  return (
    <Modal
      isOpen={modalOpen}
      onClose={fechar}
      title={modalTitle}
      maxWidth="480px"
      footer={
        <>
          <button className="btn btn-secondary" onClick={fechar}>
            {btnCancel}
          </button>
          <button
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={() => {
              if (confirmar) confirmar();
              if (fechar) fechar();
            }}
          >
            {btnConfirm}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
        <div
          style={{
            backgroundColor: danger ? "#FEE2E2" : "#FEF3C7",
            padding: "10px",
            borderRadius: "50%",
            color: danger ? "#DC2626" : "#D97706",
            flexShrink: 0
          }}
        >
          <AlertTriangle size={24} />
        </div>
        <div style={{ fontSize: "14px", color: "#334155", lineHeight: "1.5", whiteSpace: "pre-line" }}>
          {modalMsg}
        </div>
      </div>
    </Modal>
  );
}

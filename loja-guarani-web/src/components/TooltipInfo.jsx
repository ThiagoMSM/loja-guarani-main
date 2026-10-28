import React, { useState } from "react";
import { Info } from "lucide-react";

export function TooltipInfo({ text }) {
  const [visivel, setVisivel] = useState(false);

  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "pointer", marginLeft: "4px" }}
      onMouseEnter={() => setVisivel(true)}
      onMouseLeave={() => setVisivel(false)}
    >
      <Info size={14} color="#64748B" />
      {visivel && (
        <span
          style={{
            position: "absolute",
            bottom: "125%",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#0F172A",
            color: "#FFFFFF",
            padding: "6px 10px",
            borderRadius: "4px",
            fontSize: "12px",
            lineHeight: "1.3",
            whiteSpace: "normal",
            width: "220px",
            zIndex: 1000,
            boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
            textAlign: "center"
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

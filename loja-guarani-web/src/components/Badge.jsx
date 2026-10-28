import React from "react";

export function Badge({ children, variant = "neutral", className = "", style = {} }) {
  const variantClass = {
    success: "badge-success",
    warning: "badge-warning",
    danger: "badge-danger",
    info: "badge-info",
    neutral: "badge-neutral"
  }[variant] || "badge-neutral";

  return (
    <span className={`badge ${variantClass} ${className}`} style={style}>
      {children}
    </span>
  );
}

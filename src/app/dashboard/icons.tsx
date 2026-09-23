/** Íconos de línea minimalistas para la navegación del dashboard. Sin dependencias externas. */

const common = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconTreasury() {
  return (
    <svg {...common} aria-hidden>
      <path d="M3 9l9-5 9 5" />
      <rect x="3" y="9" width="18" height="11" rx="2" />
      <circle cx="12" cy="14.5" r="2" />
    </svg>
  );
}

export function IconMetrics() {
  return (
    <svg {...common} aria-hidden>
      <line x1="5" y1="20" x2="5" y2="12" />
      <line x1="12" y1="20" x2="12" y2="6" />
      <line x1="19" y1="20" x2="19" y2="15" />
    </svg>
  );
}

export function IconPolicy() {
  return (
    <svg {...common} aria-hidden>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <line x1="8" y1="8" x2="16" y2="8" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="13" y2="16" />
    </svg>
  );
}

export function IconEmployees() {
  return (
    <svg {...common} aria-hidden>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17.5" cy="9" r="2.3" />
      <path d="M15.8 14.3c2.4.5 4.2 2.6 4.2 5.2" />
    </svg>
  );
}

export function IconExpenses() {
  return (
    <svg {...common} aria-hidden>
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <line x1="9" y1="7" x2="15" y2="7" />
      <line x1="9" y1="11" x2="15" y2="11" />
      <line x1="9" y1="15" x2="13" y2="15" />
    </svg>
  );
}

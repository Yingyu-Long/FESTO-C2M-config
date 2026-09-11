import type { ReactNode } from "react";

export default function Icon({
  name,
  size = 20,
}: {
  name: string;
  size?: number;
}) {
  const paths: Record<string, ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </>
    ),
    flow: (
      <>
        <path d="M3 7h13a3 3 0 1 0-3-3M3 12h17M3 17h10a3 3 0 1 1-3 3" />
      </>
    ),
    pressure: (
      <>
        <path d="M4 19a10 10 0 1 1 16 0M12 13l5-6M6 16h12" />
        <circle cx="12" cy="13" r="2" />
      </>
    ),
    total: (
      <>
        <path d="M5 5h14v15H5zM9 2v6M15 2v6M8 12h8M8 16h5" />
      </>
    ),
    trend: (
      <>
        <path d="M3 4v16h18M5 14l5-5 4 3 6-7" />
      </>
    ),
    settings: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="3" fill="white" />
        <circle cx="15" cy="17" r="3" fill="white" />
      </>
    ),
    reset: (
      <>
        <path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    plug: (
      <>
        <path d="M8 3v5M16 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7v1" />
      </>
    ),
    arrow: <path d="M4 12h16m-5-5 5 5-5 5" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.grid}
    </svg>
  );
}

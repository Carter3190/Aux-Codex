import type { ReactNode } from "react";

export type CustomerIconName =
  | "overview"
  | "calendar"
  | "book"
  | "messages"
  | "payments"
  | "arrow"
  | "back"
  | "clock"
  | "help"
  | "check"
  | "pending"
  | "browse"
  | "upload";

const paths: Record<CustomerIconName, ReactNode> = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2" />
    </>
  ),
  book: (
    <>
      <path d="M12 5.5C9.5 3.7 6.5 3.3 3 4v15c3.5-.7 6.5-.3 9 1.5 2.5-1.8 5.5-2.2 9-1.5V4c-3.5-.7-6.5-.3-9 1.5Z" />
      <path d="M12 5.5v15" />
    </>
  ),
  messages: <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a9 9 0 0 1-.9-4A8.5 8.5 0 0 1 12.5 3H13a8.5 8.5 0 0 1 8 8v.5Z" />,
  payments: (
    <>
      <rect x="3" y="5" width="18" height="15" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </>
  ),
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  back: <path d="M19 12H5m6-6-6 6 6 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.4 9a2.6 2.6 0 0 1 5.1.7c0 1.8-2.5 2-2.5 3.8M12 17h.01" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  pending: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5M12 16h.01" />
    </>
  ),
  browse: <path d="M7 17 17 7M7 7h10v10" />,
  upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" /></>,
};

export function CustomerIcon({
  name,
  className,
}: {
  name: CustomerIconName;
  className?: string;
}) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}

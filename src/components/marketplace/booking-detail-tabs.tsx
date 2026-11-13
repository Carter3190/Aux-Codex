"use client";

import { useId, useRef, useState, type ReactNode, type KeyboardEvent } from "react";
import styles from "./booking-detail.module.css";

type Tab = "overview" | "payment" | "help" | "review";
const tabs: Array<{ key: Tab; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "payment", label: "Payment" },
  { key: "help", label: "Help" },
  { key: "review", label: "Review" },
];

export function BookingDetailTabs({ overview, payment, help, review, paymentDue = false, initialTab }: {
  overview: ReactNode; payment: ReactNode; help: ReactNode; review: ReactNode; paymentDue?: boolean;
  initialTab?: Tab;
}) {
  const [active, setActive] = useState<Tab>(initialTab ?? (paymentDue ? "payment" : "overview"));
  const id = useId();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const panels = { overview, payment, help, review };

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    setActive(tabs[next].key);
    buttons.current[next]?.focus();
  }

  return <div className={styles.tabsWorkspace}>
    <div className={styles.tabs} role="tablist" aria-label="Booking details">
      {tabs.map((tab, index) => <button
        key={tab.key} ref={(node) => { buttons.current[index] = node; }} type="button" role="tab"
        id={`${id}-${tab.key}-tab`} aria-controls={`${id}-${tab.key}-panel`}
        aria-selected={active === tab.key} tabIndex={active === tab.key ? 0 : -1}
        onClick={() => setActive(tab.key)} onKeyDown={(event) => moveTab(event, index)}
      >{tab.label}{tab.key === "payment" && paymentDue && <span className={styles.dueDot} aria-label="Payment due" />}</button>)}
    </div>
    {tabs.map((tab) => <div key={tab.key} role="tabpanel" id={`${id}-${tab.key}-panel`}
      aria-labelledby={`${id}-${tab.key}-tab`} hidden={active !== tab.key} tabIndex={0}
      className={styles.tabPanel}>{panels[tab.key]}</div>)}
  </div>;
}

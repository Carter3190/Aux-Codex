"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { CustomerIcon } from "@/components/dashboard/customer-icon";
import styles from "./booking-request.module.css";

export function BookingRequestConfirmation({ focusOnMount = false }: { focusOnMount?: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnMount) heading.current?.focus();
  }, [focusOnMount]);

  return <section className={styles.confirmationPanel} aria-label="Booking request confirmation">
    <p className={styles.eyebrow}>Booking request</p>
    <div className={styles.success} role="status">
      <span className={styles.successIcon}><CustomerIcon name="check" /></span>
      <div>
        <h3 ref={heading} tabIndex={-1}>Booking request sent</h3>
        <p>You can track it in your dashboard.</p>
      </div>
    </div>
    <div className={styles.information}>
      <CustomerIcon name="calendar" />
      <p>Check your booking requests for the provider’s response. No payment has been taken.</p>
    </div>
    <Link href="/dashboard/customer/bookings?filter=requests" className={styles.secondary}>
      View booking requests<CustomerIcon name="arrow" />
    </Link>
  </section>;
}

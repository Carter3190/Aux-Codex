"use client";

import Link from "next/link";
import { createContext, useContext, useState } from "react";
import styles from "./legal-pages.module.css";

export const LegalReviewContext = createContext({ reviewMode: false, acceptancePath: "/legal/accept" });

export function PolicyReviewReturnLink() {
  const { reviewMode, acceptancePath } = useContext(LegalReviewContext);
  return reviewMode ? <Link className={styles.backLink} href={acceptancePath}>← Agreement review</Link> : null;
}

export function PolicyContents({ sections }: { sections: { id: string; title: string }[] }) {
  const { reviewMode } = useContext(LegalReviewContext);
  const [currentSection, setCurrentSection] = useState<string | null>(null);
  const contents = reviewMode
    ? [...sections, { id: "legal-document-review", title: "Confirm your review" }]
    : sections;

  return (
    <aside className={styles.contents}>
      <h2>On this page</h2>
      <nav aria-label="Document sections">
        <ul>
          {contents.map(({ id, title }) => (
            <li key={id}>
              <button
                type="button"
                className={styles.sectionButton}
                aria-controls={id}
                aria-current={currentSection === id ? "location" : undefined}
                onClick={() => {
                  const section = document.getElementById(id);
                  if (section) {
                    section.scrollIntoView({ block: "start", behavior: "instant" });
                    setCurrentSection(id);
                  }
                }}
              >
                {title}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

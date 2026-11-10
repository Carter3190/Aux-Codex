import { SiteHeader } from "@/components/site-header";
import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import { PolicyContents, PolicyReviewReturnLink } from "./policy-navigation";
import styles from "./legal-pages.module.css";

type PolicySectionProps = { title: string; children: ReactNode; anchorId?: string };

function sectionId(title: string) {
  return `policy-section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export function PolicyPage({
  eyebrow,
  title,
  summary,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  updated: string;
  children: React.ReactNode;
}) {
  const sections = Children.toArray(children).filter(
    (child) => isValidElement<PolicySectionProps>(child) && child.type === PolicySection,
  );
  const contents = sections.map((child) => {
    const section = child as React.ReactElement<PolicySectionProps>;
    return { id: section.props.anchorId ?? sectionId(section.props.title), title: section.props.title };
  });
  const documentSections = Children.map(children, (child) =>
    isValidElement<PolicySectionProps>(child) && child.type === PolicySection
      ? cloneElement(child, { anchorId: child.props.anchorId ?? sectionId(child.props.title) })
      : child,
  );

  return (
    <main className={styles.surface}>
      <SiteHeader />
      <article className={styles.container}>
        <PolicyReviewReturnLink />
        <header className={styles.heading}>
        <p className={styles.eyebrow}>
          {eyebrow}
        </p>
        <h1 className={styles.title}>
          {title}
        </h1>
        <p className={styles.description}>{summary}</p>
        <p className={styles.updated}>
          Last updated {updated}
        </p>
        </header>
        <div className={styles.layout}>
          <PolicyContents sections={contents} />
          <div className={`policy-content ${styles.document}`}>{documentSections}</div>
        </div>
      </article>
    </main>
  );
}

export function PolicySection({
  title,
  children,
  anchorId,
}: PolicySectionProps) {
  return (
    <section id={anchorId ?? sectionId(title)} className={styles.section}>
      <h2>
        {title}
      </h2>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

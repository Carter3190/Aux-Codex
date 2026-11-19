"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./account-avatar.module.css";

export type AccountAvatarData = {
  initials: string;
  photoUrl: string | null;
  href: string;
};

export function AccountAvatar({ account, onClick }: { account: AccountAvatarData; onClick?: () => void }) {
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);
  const showPhoto = Boolean(account.photoUrl && account.photoUrl !== failedPhotoUrl);

  return (
    <Link
      href={account.href}
      className={styles.link}
      aria-label="Open your account"
      title="Your account"
      onClick={onClick}
    >
      <span className={styles.circle} aria-hidden="true">
        {showPhoto ? (
          // Account photos use the server-approved profile image URL.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={account.photoUrl!}
            alt=""
            className={styles.photo}
            onError={() => setFailedPhotoUrl(account.photoUrl)}
          />
        ) : (
          <span>{account.initials || "A"}</span>
        )}
      </span>
    </Link>
  );
}

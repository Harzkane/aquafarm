"use client";

import { signOut } from "next-auth/react";

type Props = {
  className?: string;
  callbackUrl?: string;
  label?: string;
};

export default function SignOutButton({ className = "", callbackUrl = "/", label = "Sign out" }: Props) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl })}
      className={className}
    >
      {label}
    </button>
  );
}

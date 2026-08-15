"use client";

import { useState } from "react";
import { IconCopy, IconDice, IconEye, IconEyeOff } from "./Icons";
import { useToast } from "./Toast";
import { generatePassword } from "@/lib/password";

/**
 * A password the admin is handing to someone: masked until asked for, copyable,
 * and editable in place.
 *
 * It never shows an existing password — those are stored as scrypt hashes and
 * cannot be read back. What it holds is whatever was just typed or generated.
 */
export function PasswordField({
  value,
  onChange,
  placeholder = "Set a new password — the current one cannot be shown",
  autoFocus = false,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const toast = useToast();
  const [visible, setVisible] = useState(false);

  const button =
    "grid size-9 shrink-0 place-items-center rounded-lg border border-(--glass-border) text-ink-secondary transition-colors hover:text-ink disabled:opacity-40";

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Password"
        autoComplete="new-password"
        autoFocus={autoFocus}
        spellCheck={false}
        className="min-w-0 flex-1 rounded-xl border border-(--glass-border) bg-(--glass-inset) px-3 py-2 font-mono text-sm tracking-wider placeholder:font-sans placeholder:tracking-normal placeholder:text-ink-muted"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide" : "Show"}
        className={button}
      >
        {visible ? <IconEyeOff /> : <IconEye />}
      </button>
      <button
        type="button"
        disabled={!value}
        onClick={() => {
          void navigator.clipboard.writeText(value);
          toast("ok", "Password copied");
        }}
        aria-label="Copy password"
        title="Copy"
        className={button}
      >
        <IconCopy />
      </button>
      <button
        type="button"
        onClick={() => {
          onChange(generatePassword());
          setVisible(true);
        }}
        aria-label="Generate a random password"
        title="Generate"
        className={button}
      >
        <IconDice />
      </button>
    </div>
  );
}

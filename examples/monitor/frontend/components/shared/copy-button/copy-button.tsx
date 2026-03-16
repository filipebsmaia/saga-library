"use client";

import { useState, useCallback } from "react";
import styles from "./copy-button.module.scss";
import { cn } from "@/lib/utils/format";

interface CopyButtonProps {
  text: string;
  displayText?: string;
  className?: string;
}

export function CopyButton({ text, displayText, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <button
      className={cn(styles.button, copied && styles.copied, className)}
      onClick={handleCopy}
      title={`Copy: ${text}`}
    >
      <span className={styles.text}>{displayText ?? text}</span>
      <span className={styles.icon}>{copied ? "✓" : "⎘"}</span>
    </button>
  );
}

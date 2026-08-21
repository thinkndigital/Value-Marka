"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function CopyReferralLink({ code, locale }: { code: string; locale: string }) {
  const [copied, setCopied] = useState(false);
  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/${locale}/register?ref=${code}`
      : `/${locale}/register?ref=${code}`;

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-end gap-2">
      <Input id="referralLink" label="Your referral link" value={link} readOnly className="flex-1" />
      <Button type="button" variant="secondary" onClick={copy}>
        {copied ? "Copied!" : "Copy"}
      </Button>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { setSourceEnabledAction } from "@/server/actions/sources";

export function SourceToggle({
  slug,
  sourceId,
  enabled,
}: {
  slug: string;
  sourceId: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(enabled);
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-3 text-ui">
      <Switch
        checked={checked}
        disabled={pending}
        onCheckedChange={(next) => {
          setChecked(next);
          startTransition(async () => {
            const result = await setSourceEnabledAction(slug, sourceId, next);
            if (!result.ok) setChecked(!next);
            router.refresh();
          });
        }}
      />
      Scheduled sync {checked ? "on" : "off"}
    </label>
  );
}

"use client";

import Form from "next/form";
import type { ComponentProps } from "react";

/**
 * A GET form that navigates client-side and resubmits when a select or date
 * changes. Text fields submit on Enter. Works without JavaScript via the
 * submit button.
 */
export function AutoSubmitForm(props: ComponentProps<typeof Form>) {
  return (
    <Form
      {...props}
      onChange={(event) => {
        const target = event.target as HTMLElement;
        if (
          target instanceof HTMLSelectElement ||
          (target instanceof HTMLInputElement && target.type === "date")
        ) {
          event.currentTarget.requestSubmit();
        }
      }}
    />
  );
}

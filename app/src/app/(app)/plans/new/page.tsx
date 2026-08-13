import type { Metadata } from "next";

import { PlanForm } from "@/components/plans/plan-form";
import { PageHeader } from "@/components/ui/states";
import { requireUser } from "@/lib/auth/dal";
import { createPlanAction } from "@/lib/plans/actions";

export const metadata: Metadata = { title: "New plan · Home Meal Planner" };

export default async function NewPlanPage() {
  await requireUser();

  return (
    <>
      <PageHeader
        title="New plan"
        description="Name it first, then add meals."
      />
      <PlanForm
        action={createPlanAction}
        submitLabel="Create plan"
        values={{ name: "", description: "" }}
      />
    </>
  );
}

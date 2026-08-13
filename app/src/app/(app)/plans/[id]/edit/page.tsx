import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlanForm } from "@/components/plans/plan-form";
import { PageHeader } from "@/components/ui/states";
import { updatePlanAction } from "@/lib/plans/actions";
import { getPlan } from "@/lib/plans/queries";

export async function generateMetadata({
  params,
}: PageProps<"/plans/[id]/edit">): Promise<Metadata> {
  const { id } = await params;
  if (!(await getPlan(id))) notFound();
  return { title: "Edit plan · Home Meal Planner" };
}

export default async function EditPlanPage({
  params,
}: PageProps<"/plans/[id]/edit">) {
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) notFound();

  return (
    <>
      <PageHeader title="Edit plan" />
      <PlanForm
        action={updatePlanAction.bind(null, plan.id)}
        submitLabel="Save changes"
        values={{
          id: plan.id,
          name: plan.name,
          description: plan.description ?? "",
        }}
      />
    </>
  );
}

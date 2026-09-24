import { getCompany } from "../data";
import { Card } from "../ui";
import { PolicyForm } from "../policy-form";
import { PolicyEditor } from "../policy-editor";
import type { StructuredPolicy } from "@/lib/policy/types";

export const dynamic = "force-dynamic";

export default async function PolicyPage() {
  const company = await getCompany();
  if (!company) return null;

  return (
    <Card title="Política de gastos">
      <PolicyForm companyId={company.id} defaultText={company.policy?.rawText} />
      {company.policy && (
        <PolicyEditor
          companyId={company.id}
          structured={company.policy.structured as unknown as StructuredPolicy}
        />
      )}
    </Card>
  );
}

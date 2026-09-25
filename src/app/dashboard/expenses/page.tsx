import { getCompany } from "../data";
import { Card, CountBadge } from "../ui";
import { ExpenseUploadForm } from "../expense-upload-form";
import { ExpenseConfirmForm } from "../expense-confirm-form";
import { BulkUpload } from "../bulk-upload";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const company = await getCompany();
  if (!company) return null;

  const pending = company.expenses.filter((e) => e.status === "EXTRACTED");

  return (
    <Card title="Gastos" badge={<CountBadge count={pending.length} />}>
      <p className="text-sm text-text-secondary">
        Sube un comprobante o una carga masiva para analizar el gasto y ejecutar el reembolso — reglas, Jev y pago
        corren en cuanto se confirma. El historial de lo ya evaluado está en{" "}
        <a href="/dashboard/historial" className="underline">
          Historial
        </a>
        .
      </p>

      <ExpenseUploadForm
        companyId={company.id}
        employees={company.employees.map((e) => ({ id: e.id, name: e.name }))}
      />

      <BulkUpload companyId={company.id} />

      {pending.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-status-warning/40 bg-status-warning/5 p-3">
          <h3 className="text-sm font-semibold text-status-warning">
            ! Pendientes de confirmación — acción requerida
          </h3>
          {pending.map((expense) => {
            const extracted = expense.extractedData as { confidence?: number } | null;
            return (
              <ExpenseConfirmForm
                key={expense.id}
                expenseId={expense.id}
                employeeName={expense.employee.name}
                receiptDataUrl={`data:${expense.receiptMimeType};base64,${Buffer.from(expense.receiptFile!).toString("base64")}`}
                amount={expense.amount}
                currency={expense.currency}
                merchant={expense.merchant}
                expenseDate={expense.expenseDate?.toISOString().slice(0, 10)}
                category={expense.category}
                confidence={extracted?.confidence}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

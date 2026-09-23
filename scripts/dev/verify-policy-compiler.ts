import { compilePolicy } from "../../src/lib/policy/compiler.ts";

const rawText = `Meals up to $50 per day. Alcohol is not reimbursable.
Hotels up to $180 per night during approved trips.
Software up to $300 annually per tool when relevant to the employee's role.
Entertainment requires manager approval.`;

const structured = await compilePolicy(rawText);
console.log(JSON.stringify(structured, null, 2));

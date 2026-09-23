import { readFileSync } from "node:fs";
import { extractReceiptData } from "../../src/lib/receipt/extract.ts";

const path = process.argv[2];
if (!path) {
  console.error("Uso: verify-receipt-extraction.ts <ruta-imagen>");
  process.exit(1);
}

const buffer = readFileSync(path);
const mimeType = path.endsWith(".png") ? "image/png" : "image/jpeg";

const result = await extractReceiptData(buffer.toString("base64"), mimeType);
console.log(JSON.stringify(result, null, 2));

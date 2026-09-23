import * as XLSX from "xlsx";

const rows = [
  {
    empleado: "angel@acmeremote.test",
    comercio: "Starbucks",
    monto: 12,
    moneda: "USD",
    categoria: "meals",
    fecha: "2026-09-10",
    justificacion: "Café de trabajo con el equipo de producto.",
  },
  {
    empleado: "angel@acmeremote.test",
    comercio: "Marriott",
    monto: 165,
    moneda: "USD",
    categoria: "hotels",
    fecha: "2026-09-11",
    justificacion: "Hospedaje durante viaje aprobado a Bogotá.",
  },
  {
    empleado: "angel@acmeremote.test",
    comercio: "Figma",
    monto: 144,
    moneda: "USD",
    categoria: "software",
    fecha: "2026-09-12",
    justificacion: "Licencia anual de Figma para diseño de producto.",
  },
  {
    empleado: "angel@acmeremote.test",
    comercio: "Bar El Rincón",
    monto: 60,
    moneda: "USD",
    categoria: "meals",
    fecha: "2026-09-13",
    justificacion: "Tragos con el equipo después del trabajo, incluyó alcohol.",
  },
  {
    empleado: "noexiste@acmeremote.test",
    comercio: "Random",
    monto: 10,
    moneda: "USD",
    categoria: "meals",
    fecha: "2026-09-14",
    justificacion: "Fila de prueba con empleado inexistente.",
  },
];

const sheet = XLSX.utils.json_to_sheet(rows);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, sheet, "Gastos");
XLSX.writeFile(workbook, process.argv[2] ?? "test-bulk.xlsx");
console.log("Excel de prueba generado.");

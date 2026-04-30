import { describe, expect, it } from "vitest";

import { parseStatementCsv } from "../lib/csv";

describe("parseStatementCsv", () => {
  it("parses valid rows and skips invalid rows", () => {
    const csv = [
      "date,counterparty,description,amount",
      "2025-01-01,Acme,Valid income,1000.00",
      "invalid-date,Acme,Bad date,300.00",
      "2025-01-03,Contoso,Bad amount,not-number",
      "2025-01-04,Globex,Valid expense,-200.50"
    ].join("\n");

    const result = parseStatementCsv(csv);

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]).toMatchObject({
      date: "2025-01-01",
      counterparty: "Acme",
      amount: 1000,
      type: "income"
    });
    expect(result.transactions[1]).toMatchObject({
      date: "2025-01-04",
      counterparty: "Globex",
      amount: -200.5,
      type: "expense"
    });
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });

  it("supports semicolon delimiter", () => {
    const csv = [
      "date;counterparty;description;amount",
      "2025-01-01;Acme;Income;500.00",
      "2025-01-02;Contoso;Expense;-100.00"
    ].join("\n");

    const result = parseStatementCsv(csv);

    expect(result.issues).toHaveLength(0);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.counterparty).toBe("Acme");
    expect(result.transactions[1]?.type).toBe("expense");
  });
});

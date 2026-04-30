import { describe, expect, it } from "vitest";

import { calculateStatementSummary, type Transaction } from "../lib/statement";

describe("calculateStatementSummary", () => {
  it("calculates totals and top-5 expense counterparties", () => {
    const transactions: Transaction[] = [
      { date: "2025-01-01", counterparty: "A", description: "Income", amount: 1000, type: "income" },
      { date: "2025-01-02", counterparty: "B", description: "Expense", amount: -300, type: "expense" },
      { date: "2025-01-03", counterparty: "C", description: "Expense", amount: -700, type: "expense" },
      { date: "2025-01-04", counterparty: "B", description: "Expense", amount: -200, type: "expense" },
      { date: "2025-01-05", counterparty: "D", description: "Expense", amount: -500, type: "expense" },
      { date: "2025-01-06", counterparty: "E", description: "Expense", amount: -100, type: "expense" },
      { date: "2025-01-07", counterparty: "F", description: "Expense", amount: -50, type: "expense" }
    ];

    const summary = calculateStatementSummary(transactions);

    expect(summary.totalIncome).toBe(1000);
    expect(summary.totalExpense).toBe(1850);
    expect(summary.netResult).toBe(-850);
    expect(summary.transactionCount).toBe(7);
    expect(summary.topExpenseCounterparties).toEqual([
      { counterparty: "C", totalExpense: 700 },
      { counterparty: "B", totalExpense: 500 },
      { counterparty: "D", totalExpense: 500 },
      { counterparty: "E", totalExpense: 100 },
      { counterparty: "F", totalExpense: 50 }
    ]);
  });
});

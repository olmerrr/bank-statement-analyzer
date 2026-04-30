export type TransactionType = "income" | "expense";

export type Transaction = {
  date: string;
  counterparty: string;
  description: string;
  amount: number;
  type: TransactionType;
};

export type TopCounterparty = {
  counterparty: string;
  totalExpense: number;
};

export type StatementSummary = {
  totalIncome: number;
  totalExpense: number;
  netResult: number;
  transactionCount: number;
  topExpenseCounterparties: TopCounterparty[];
};

export function calculateStatementSummary(
  transactions: Transaction[]
): StatementSummary {
  let totalIncome = 0;
  let totalExpense = 0;
  const expenseByCounterparty = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.amount > 0) {
      totalIncome += transaction.amount;
      continue;
    }

    const expenseAmount = Math.abs(transaction.amount);
    totalExpense += expenseAmount;
    const current = expenseByCounterparty.get(transaction.counterparty) ?? 0;
    expenseByCounterparty.set(transaction.counterparty, current + expenseAmount);
  }

  const topExpenseCounterparties = [...expenseByCounterparty.entries()]
    .map(([counterparty, totalExpenseValue]) => ({
      counterparty,
      totalExpense: totalExpenseValue
    }))
    .sort((a, b) => b.totalExpense - a.totalExpense)
    .slice(0, 5);

  return {
    totalIncome,
    totalExpense,
    netResult: totalIncome - totalExpense,
    transactionCount: transactions.length,
    topExpenseCounterparties
  };
}

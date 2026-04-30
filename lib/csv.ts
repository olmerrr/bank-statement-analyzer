import Papa from "papaparse";
import { z } from "zod";

import type { Transaction } from "@/lib/statement";

const csvRowSchema = z.object({
  date: z.string().date(),
  counterparty: z.string().trim().min(1),
  description: z.string().trim().min(1),
  amount: z
    .string()
    .trim()
    .regex(/^-?\d+(\.\d+)?$/, "Amount must be a number")
    .transform((value) => Number(value))
});

const REQUIRED_HEADERS = ["date", "counterparty", "description", "amount"] as const;

export type ParseIssue = {
  rowNumber: number;
  reason: string;
  raw: Record<string, string>;
};

export type ParsedStatement = {
  transactions: Transaction[];
  issues: ParseIssue[];
};

function detectMissingHeaders(headers: string[]): string[] {
  return REQUIRED_HEADERS.filter((header) => !headers.includes(header));
}

function detectDelimiter(csvText: string): "," | ";" {
  const headerLine = csvText.split(/\r?\n/, 1)[0] ?? "";
  const commaCount = headerLine.split(",").length - 1;
  const semicolonCount = headerLine.split(";").length - 1;
  return semicolonCount > commaCount ? ";" : ",";
}

export function parseStatementCsv(csvText: string): ParsedStatement {
  const delimiter = detectDelimiter(csvText);
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    delimiter,
    transformHeader: (header) => header.trim().toLowerCase()
  });

  const headers = parsed.meta.fields ?? [];
  const missingHeaders = detectMissingHeaders(headers);

  if (missingHeaders.length > 0) {
    return {
      transactions: [],
      issues: [
        {
          rowNumber: 0,
          reason: `Missing headers: ${missingHeaders.join(", ")}`,
          raw: {}
        }
      ]
    };
  }

  const transactions: Transaction[] = [];
  const issues: ParseIssue[] = parsed.errors.map((error) => ({
    rowNumber: (error.row ?? 0) + 2,
    reason: error.message,
    raw: {}
  }));

  for (const [index, row] of parsed.data.entries()) {
    const result = csvRowSchema.safeParse(row);
    if (!result.success) {
      issues.push({
        rowNumber: index + 2,
        reason: result.error.issues[0]?.message ?? "Invalid row",
        raw: row
      });
      continue;
    }

    const normalized = result.data;
    const amount = normalized.amount;

    transactions.push({
      date: normalized.date,
      counterparty: normalized.counterparty,
      description: normalized.description,
      amount,
      type: amount > 0 ? "income" : "expense"
    });
  }

  return { transactions, issues };
}

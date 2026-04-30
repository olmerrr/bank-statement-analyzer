"use client";

import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseStatementCsv, type ParseIssue } from "@/lib/csv";
import { calculateStatementSummary, type Transaction } from "@/lib/statement";
import { cn } from "@/lib/utils";

type FilterType = "all" | "income" | "expense";
type SortField = "date" | "amount";
type SortDirection = "asc" | "desc";
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function formatAmount(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const absolute = Math.abs(amount);
  const [integerPart, decimalPart] = absolute.toFixed(2).split(".");
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${groupedInteger}.${decimalPart} UAH`;
}

function summarizeIssues(issues: ParseIssue[]): string {
  if (issues.length === 0) {
    return "";
  }

  const grouped = issues.reduce<Map<string, number>>((acc, issue) => {
    acc.set(issue.reason, (acc.get(issue.reason) ?? 0) + 1);
    return acc;
  }, new Map<string, number>());

  return [...grouped.entries()]
    .map(([reason, count]) => `${reason} (${count})`)
    .join("; ");
}

function escapeCsvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function isCsvFile(file: File): boolean {
  const normalizedName = file.name.toLowerCase();
  const normalizedType = file.type.toLowerCase();
  return (
    normalizedName.endsWith(".csv") ||
    normalizedType === "text/csv" ||
    normalizedType === "application/vnd.ms-excel"
  );
}

export default function HomePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [issues, setIssues] = useState<ParseIssue[]>([]);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [query, setQuery] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isDeduplicationEnabled, setIsDeduplicationEnabled] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>("");
  const [globalError, setGlobalError] = useState<string>("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const sourceTransactions = useMemo(() => {
    if (!isDeduplicationEnabled) {
      return transactions;
    }

    const unique = new Map<string, Transaction>();
    for (const transaction of transactions) {
      const key = [
        transaction.date,
        transaction.counterparty.trim().toLowerCase(),
        transaction.description.trim().toLowerCase(),
        transaction.amount.toFixed(2)
      ].join("|");
      if (!unique.has(key)) {
        unique.set(key, transaction);
      }
    }

    return [...unique.values()];
  }, [transactions, isDeduplicationEnabled]);

  const filteredTransactions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matched = sourceTransactions.filter((transaction) => {
      const matchesType = filterType === "all" ? true : transaction.type === filterType;
      const matchesQuery =
        normalizedQuery.length === 0
          ? true
          : transaction.counterparty.toLowerCase().includes(normalizedQuery) ||
            transaction.description.toLowerCase().includes(normalizedQuery);
      return matchesType && matchesQuery;
    });
    return matched.sort((left, right) => {
      if (sortField === "date") {
        const leftTs = new Date(left.date).getTime();
        const rightTs = new Date(right.date).getTime();
        return sortDirection === "asc" ? leftTs - rightTs : rightTs - leftTs;
      }

      return sortDirection === "asc"
        ? left.amount - right.amount
        : right.amount - left.amount;
    });
  }, [sourceTransactions, filterType, query, sortField, sortDirection]);

  const summary = useMemo(
    () => calculateStatementSummary(filteredTransactions),
    [filteredTransactions]
  );

  const issueText = useMemo(() => summarizeIssues(issues), [issues]);

  const parseAndApply = (text: string, sourceFileName: string): void => {
    const result = parseStatementCsv(text);
    setTransactions(result.transactions);
    setIssues(result.issues);
    setFileName(sourceFileName);
    setGlobalError(
      result.transactions.length === 0 && result.issues.length > 0
        ? "No valid transactions were parsed from this file."
        : ""
    );
  };

  const onFileSelected = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!isCsvFile(file)) {
      setGlobalError("Unsupported file type. Please upload a CSV file.");
      setTransactions([]);
      setIssues([]);
      setFileName(file.name);
      event.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setGlobalError("File is too large. Maximum size is 5 MB.");
      setTransactions([]);
      setIssues([]);
      setFileName(file.name);
      event.target.value = "";
      return;
    }

    try {
      const text = await file.text();
      parseAndApply(text, file.name);
    } catch {
      setGlobalError("Failed to read the file.");
      setTransactions([]);
      setIssues([]);
      setFileName(file.name);
    } finally {
      event.target.value = "";
    }
  };

  const onDrop = async (event: DragEvent<HTMLDivElement>): Promise<void> => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    if (!isCsvFile(file)) {
      setGlobalError("Unsupported file type. Please upload a CSV file.");
      setTransactions([]);
      setIssues([]);
      setFileName(file.name);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setGlobalError("File is too large. Maximum size is 5 MB.");
      setTransactions([]);
      setIssues([]);
      setFileName(file.name);
      return;
    }

    try {
      const text = await file.text();
      parseAndApply(text, file.name);
    } catch {
      setGlobalError("Failed to read the file.");
      setTransactions([]);
      setIssues([]);
      setFileName(file.name);
    }
  };

  const onExportFiltered = (): void => {
    if (filteredTransactions.length === 0) {
      setGlobalError("There is no data to export.");
      return;
    }

    const header = "date,counterparty,description,amount,type";
    const rows = filteredTransactions.map((transaction) =>
      [
        transaction.date,
        escapeCsvCell(transaction.counterparty),
        escapeCsvCell(transaction.description),
        transaction.amount.toFixed(2),
        transaction.type
      ].join(",")
    );
    const csvContent = [header, ...rows].join("\n");
    downloadCsv("filtered-transactions.csv", csvContent);
    setGlobalError("");
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Bank Statement Analyzer</h1>

      <Card>
        <CardHeader>
          <CardTitle>CSV Upload</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div
            className={cn(
              "flex min-h-28 items-center justify-center rounded-lg border-2 border-dashed p-4 text-center text-sm",
              isDragging ? "border-neutral-900 bg-neutral-100" : "border-neutral-300 bg-white"
            )}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              void onDrop(event);
            }}
          >
            Drag and drop a CSV file here or use the button below
          </div>
          <div className="flex gap-3">
            <Button type="button" onClick={() => inputRef.current?.click()}>
              Choose file
            </Button>
            <input
              ref={inputRef}
              className="hidden"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                void onFileSelected(event);
              }}
            />
            {fileName ? <p className="self-center text-sm text-neutral-600">{fileName}</p> : null}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-500">Maximum file size: 5 MB</p>
            <Button
              type="button"
              variant={isDeduplicationEnabled ? "default" : "outline"}
              onClick={() => setIsDeduplicationEnabled((current) => !current)}
            >
              {isDeduplicationEnabled ? "Deduplication on" : "Deduplication off"}
            </Button>
          </div>
          {issues.length > 0 ? (
            <p className="text-sm text-amber-700">Skipped {issues.length} rows: {issueText}</p>
          ) : null}
          {globalError ? <p className="text-sm text-red-700">{globalError}</p> : null}
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total income</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold text-emerald-600">
            {formatAmount(summary.totalIncome)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total expense</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold text-red-600">
            {formatAmount(summary.totalExpense)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Net result</CardTitle>
          </CardHeader>
          <CardContent
            className={cn(
              "text-xl font-semibold",
              summary.netResult >= 0 ? "text-emerald-600" : "text-red-600"
            )}
          >
            {formatAmount(summary.netResult)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Transactions count</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{summary.transactionCount}</CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <Select
              value={filterType}
              onChange={(event) => setFilterType(event.target.value as FilterType)}
              options={[
                { label: "All", value: "all" },
                { label: "Income", value: "income" },
                { label: "Expense", value: "expense" }
              ]}
              className="md:col-span-1"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by counterparty or description"
              className="md:col-span-2"
            />
            <Select
              value={sortField}
              onChange={(event) => setSortField(event.target.value as SortField)}
              options={[
                { label: "Sort by date", value: "date" },
                { label: "Sort by amount", value: "amount" }
              ]}
              className="md:col-span-1"
            />
            <Select
              value={sortDirection}
              onChange={(event) => setSortDirection(event.target.value as SortDirection)}
              options={[
                { label: "Descending", value: "desc" },
                { label: "Ascending", value: "asc" }
              ]}
              className="md:col-span-1"
            />
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onExportFiltered}>
              Export filtered CSV
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Counterparty</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-neutral-500">
                    No transactions to display
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions.map((transaction, index) => (
                  <TableRow key={`${transaction.date}-${transaction.counterparty}-${index}`}>
                    <TableCell>{transaction.date}</TableCell>
                    <TableCell>{transaction.counterparty}</TableCell>
                    <TableCell>{transaction.description}</TableCell>
                    <TableCell>{transaction.type === "income" ? "Income" : "Expense"}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium",
                        transaction.amount > 0 ? "text-emerald-600" : "text-red-600"
                      )}
                    >
                      {formatAmount(transaction.amount)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top 5 counterparties by expense volume</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Counterparty</TableHead>
                <TableHead className="text-right">Expense amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.topExpenseCounterparties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="py-6 text-center text-neutral-500">
                    No expenses
                  </TableCell>
                </TableRow>
              ) : (
                summary.topExpenseCounterparties.map((item) => (
                  <TableRow key={item.counterparty}>
                    <TableCell>{item.counterparty}</TableCell>
                    <TableCell className="text-right font-medium text-red-600">
                      {formatAmount(item.totalExpense)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parsing issues</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Row</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Raw values</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-6 text-center text-neutral-500">
                    No parsing issues
                  </TableCell>
                </TableRow>
              ) : (
                issues.map((issue, index) => (
                  <TableRow key={`${issue.rowNumber}-${issue.reason}-${index}`}>
                    <TableCell>{issue.rowNumber}</TableCell>
                    <TableCell>{issue.reason}</TableCell>
                    <TableCell className="max-w-xl break-words text-xs text-neutral-600">
                      {Object.entries(issue.raw)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(" | ") || "N/A"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}

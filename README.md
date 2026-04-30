# Bank Statement Analyzer

Production-style frontend application for parsing and analyzing bank statement CSV files directly in the browser.

## What This Project Does

This app helps finance and operations teams quickly inspect transaction statements without backend infrastructure.

Core capabilities:
- Upload CSV files by drag-and-drop or file picker
- Parse and validate rows with strict schema checks
- Display transactions with filtering, search, and sorting
- Calculate financial summary metrics in real time
- Show top 5 counterparties by total expense volume
- Export the currently filtered data set back to CSV
- Present parsing errors with row-level diagnostics

## Tech Stack

- **Framework:** Next.js 15 (App Router), React 19
- **Language:** TypeScript (strict mode)
- **UI:** Tailwind CSS + shadcn-style reusable UI components
- **CSV parsing:** Papa Parse
- **Validation:** Zod
- **Testing:** Vitest
- **Quality checks:** ESLint + TypeScript type checking
- **CI:** GitHub Actions (`lint`, `tsc`, `test`)

## Non-Happy Path Handling

The app includes explicit safeguards for real-world file import scenarios:
- Unsupported file types are rejected
- File size limit is enforced (max 5 MB)
- Malformed rows are skipped while valid rows are still imported
- Parser errors are surfaced with line-level issue details
- Empty valid-result imports show clear user feedback
- Optional deduplication mode removes repeated transactions
- Semicolon-delimited CSV files are supported automatically

## Project Structure

- `app` — Next.js pages/layout/styles
- `components/ui` — reusable UI primitives
- `lib/statement.ts` — pure business logic for summaries/top-5
- `lib/csv.ts` — parsing + validation pipeline
- `test` — unit tests for summary calculations and CSV parsing behavior
- `.github/workflows/ci.yml` — CI pipeline

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality Commands

```bash
npm run lint
npx tsc --noEmit
npm run test
```

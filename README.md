# Casa Take Home Assessment

An end-to-end test suite using [Playwright](https://playwright.dev) for the [Vault Health Dashboard](https://app-stg.keys.casa/qa_hire_q1_2026) staging intsance.

## Assessment Overview

You've been asked to evaluate a new internal dashboard feature before it ships. The page is live at:

https://app-stg.keys.casa/qa_hire_q1_2026

Here's what the JIRA epic would have included as feature requirements for the developers:

Vault Health DashboardBuild a dashboard that displays:
* Vault summary (name, type, balance)
* Recent transaction history
* Connected signing devices
* Receiving addresses
* Key health status

## Deliverables

Push your work to a **public GitHub repo** and share the link with us. Your repo should contain:

### Part 1 — Automated Tests *(primary)*

Write an automated test suite for this page using your preferred framework (Playwright, Cypress, or similar).

### Part 2 — Bug Documentation

In your repo's README, document:

**A. The most critical functional bug you found** 

**B. The most critical UX bug you found**

For each, include:

* Steps to reproduce
* Expected vs. actual behavior
* Why you consider it the most critical

### Part 3 — AI Tooling

We encourage the use of AI tools during this assessment.

In your README, please include a short section describing:

* Which AI tool(s) and model(s) you used
* How you used them (e.g., test generation, bug analysis, code review, debugging, etc.)

### What We're Looking For

* Test architecture and code quality
* How you prioritize what to test first
* Severity reasoning and communication clarity

## Tech Stack

- **Runtime:** Node.js (LTS) + npm
- **Language:** TypeScript
- **Test Framework:** Playwright Test (`@playwright/test`)
- **Typing Support:** `@types/node`

## Quick Start

```bash
# Install dependencies
npm install

# Install Playwright browser(s)
npx playwright install

# Run tests
npx playwright test

# Run tests in headed/UI modes (optional)
npx playwright test --headed
npx playwright test --ui

# Open the HTML report (after test run)
npx playwright show-report
```

## Project Structure

## Architecture & Best Practices

The test suite is built on the [Page Object Model (POM)](https://playwright.dev/docs/pom) pattern. Each dashboard section has its own page object class that owns all locators and interaction helpers for that section. Tests import and compose these objects rather than hard-coding selectors or logic inline.

The patterns below are applied consistently across every page object. Any new page file added to the suite should follow the same conventions for consistency and reliability.

---

### Page Object Model (POM)

Each section of the dashboard maps to a dedicated class in `tests/pages/`. The class owns:
- All locators for that section
- Visibility and field-coverage assertion helpers (`expectVisible`, `expectFieldCoverage`)
- Data extraction helpers that return typed objects (`getTransactions`, `getDevices`, etc.)
- Action helpers for interactive elements (`expandTransactionById`, `copyAddressByIndex`, etc.)

Tests remain thin and expressive — they call helper methods rather than interacting with DOM details directly.

---

### Card-Scoped Locators

Every locator that targets content within a section is scoped to that section's card element:

```typescript
this.card = page.getByTestId('vault-summary-card');
this.totalBalance = this.card.getByTestId('total-balance'); // scoped, not page-level
```

Scoping prevents false matches when multiple sections render similar elements (e.g. a `fee` field in both the transaction row and the expanded detail panel). It also makes failures more specific — a scoped locator failure immediately identifies which section is broken.

---

### Dual-Locator Strategy

Structural anchors use `data-testid` for stability. User-facing labels use role or text-based locators for semantic correctness:

```typescript
this.card = page.getByTestId('vault-summary-card');          // stable testid anchor
this.sectionLabel = page.getByRole('heading', { name: '...' }); // semantic role locator
```

This means changes to the DOM structure (e.g. wrapping a heading in a new `<div>`) won't silently break a testid-only assertion that wouldn't catch the semantic regression.

---

### Prefix-Based Collection Locators

Lists of repeated elements (transaction rows, device rows, address rows) are matched using CSS attribute prefix selectors scoped to the card:

```typescript
this.transactionRows = this.card.locator('[data-testid^="transaction-row-tx-"]');
```

This captures all rows without hardcoding a count, so tests remain valid as data changes. Collection size is validated at runtime with `toHaveCount` or a `count()` assertion.

---

### Normalization Helpers

Individual element helpers accept flexible input so callers don't need to know the exact testid format:

```typescript
// Both are valid:
page.transactionRowById('1');      // bare ID
page.transactionRowById('tx-1');   // prefixed ID
```

Each page object includes a private `normalizeId` / `normalizeIndex` method that canonicalizes the input before constructing the testid. Invalid inputs throw immediately with a clear message, surfacing errors at the call site rather than producing a silent locator mismatch.

---

### Typed Return Shapes

Data extraction methods return named TypeScript type aliases rather than inline or untyped objects:

```typescript
type Transaction = { rowText: string; status: string; confirmations: string; fee: string };

async getTransactions(): Promise<Transaction[]> { ... }
```

Named types make method signatures self-documenting, enable IDE autocompletion on returned values, and make it obvious when a field is missing or the structure has changed.

---

### Non-Empty Content Assertions

Content presence is asserted with `/\S/` (a non-whitespace regex) rather than `.not.toHaveText('')`:

```typescript
await expect(row).toContainText(/\S/);
```

`.not.toHaveText('')` passes for whitespace-only strings. `/\S/` confirms actual visible content has rendered, which is important for client-rendered pages where elements may briefly appear in the DOM with empty text before data loads.

---

### Parallel DOM Reads

Data helpers read multiple fields simultaneously using `Promise.all` to minimize test execution time:

```typescript
const [rowText, status, confirmations, fee] = await Promise.all([
  this.transactionRows.nth(index).innerText(),
  this.transactionStatuses.nth(index).innerText(),
  this.transactionConfirmations.nth(index).innerText(),
  this.transactionFees.nth(index).innerText(),
]);
```

---

### DOM Presence Check Pattern

Conditional logic (e.g. "expand if not already expanded") uses explicit DOM presence and visibility checks instead of `try/catch`:

```typescript
const hasDetailInDom = (await detail.count()) > 0;
const isDetailVisible = hasDetailInDom && (await detail.isVisible());
```

`try/catch` around locator calls can mask real failures. The two-step check is explicit and makes the intent clear: check whether the element exists before checking its state.

> **Note:** Playwright's `isVisible()` already returns `false` (rather than throwing) when an element is absent from the DOM, so the `count() > 0` pre-check is technically redundant. It is kept here intentionally — it makes the two-step intent explicit for readers unfamiliar with that Playwright behavior, and it costs nothing at runtime.

---

### SPA Render Wait Strategy

The dashboard is a client-rendered SPA that polls for live data. Tests wait for the root page element to be visible before asserting anything:

```typescript
await page.getByTestId('page').waitFor({ state: 'visible', timeout: 30000 });
```

`networkidle` is intentionally avoided — the page's continuous polling means `networkidle` never resolves. `domcontentloaded` + an explicit element wait is the reliable pattern for this app.

---

## Nuanced Patterns & Tradeoffs

Not every pattern in this suite comes directly from the Playwright playbook. Some are pragmatic choices made to fit this specific app. This section documents those tradeoffs explicitly so future contributors understand the reasoning and can revisit them if the app changes.

---

### Prefix-Based CSS Selectors for Collections

**Why it's nuanced:** Playwright's official locator priority order is `getByRole` → `getByLabel` → `getByText` → `getByTestId`. CSS attribute selectors sit below all of these in the recommendation hierarchy.

**Why we used it anyway:** The dashboard renders repeated elements with numeric-suffixed testids (e.g. `transaction-row-tx-1`, `transaction-row-tx-2`). There is no ARIA role or label that identifies the full collection without coupling to a count. A prefix CSS selector (`[data-testid^="transaction-row-tx-"]`) is the only way to select the entire collection dynamically. This pattern is isolated to collection-level locators only — individual element helpers use `getByTestId` per Playwright guidance.

**If you want to change it:** If the app adds a `role="list"` or a container testid wrapping all rows, that could replace the prefix selector with `card.locator('[role="listitem"]')` or similar.

---

### `data-testid` as the Primary Anchor

**Why it's nuanced:** Playwright encourages user-facing locators (`getByRole`, `getByLabel`) because they reflect how real users perceive the UI and catch semantic regressions. `getByTestId` is listed as a last resort for elements that have no semantic role.

**Why we used it anyway:** The dashboard section cards (`vault-summary-card`, `transaction-history-card`, etc.) are layout containers — they have no meaningful ARIA role. `getByTestId` is the appropriate locator for structural scope anchors that have no user-facing semantics. The dual-locator strategy applies semantic locators (`getByRole`) where semantics exist (headings, buttons) and `getByTestId` only where they don't.

---

### Serial Test Mode

**Why it's nuanced:** Playwright defaults to `fullyParallel: true` for speed. Serial mode reduces throughput.

**Why we used it anyway:** The coverage spec (`dashboard-components.spec.ts`) shares a single page instance across all tests via `beforeEach`. Running tests in parallel against a client-rendered SPA with continuous data polling introduced intermittent timing failures during initial load. Serial mode (`test.describe.configure({ mode: 'serial' })`) eliminates that flakiness. If the spec is later split into independent test files that each manage their own page lifecycle, parallel mode can be re-enabled.

## Test Prioritization

## Bug Documentation
### Most Critical UX Bug
### Most Critical Functional Bug
### Additional Bugs for Consideration and Discussion

## AI Tooling
### AI Toolset
### AI Utilization

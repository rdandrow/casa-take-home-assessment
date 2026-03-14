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

## Test Prioritization

## Bug Documentation
### Most Critical UX Bug
### Most Critical Functional Bug
### Additional Bugs for Consideration and Discussion

## AI Tooling
### AI Toolset
### AI Utilization

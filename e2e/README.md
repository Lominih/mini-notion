# E2E Tests

End-to-end tests for mini-notion using [Playwright](https://playwright.dev/).

## Prerequisites

1. Install Playwright browsers (first time only):
   ```bash
   npx playwright install chromium
   ```

2. Make sure the development server is accessible. The Playwright config auto-starts `npm run dev` on `http://localhost:3000`, but you can override this by setting the `BASE_URL` environment variable.

3. Have a test user seeded in your database (email: `test@example.com`, password: `password123`). You can adjust credentials in each spec file's `beforeEach`.

## Running Tests

### Run all E2E tests

```bash
npm run test:e2e
```

### Run with interactive UI mode

```bash
npm run test:e2e:ui
```

This opens the Playwright UI where you can visually step through tests, see traces, and debug failures.

### Run a specific test file

```bash
npx playwright test e2e/editor.spec.ts
```

### Run tests matching a title

```bash
npx playwright test -g "should create a new document"
```

### Run in headed mode (visible browser)

```bash
npx playwright test --headed
```

### Run with debug mode

```bash
npx playwright test --debug
```

## Test Files

| File | Description |
|------|-------------|
| `editor.spec.ts` | Document creation, editing, formatting (bold, italic, headings, lists, task lists), persistence, and page settings |
| `collaboration.spec.ts` | WebSocket connection, real-time sync, awareness/cursor display, multi-user editing, and reconnection handling |
| `documents.spec.ts` | Document CRUD, sidebar navigation, search, tags, page tree hierarchy, favorites, and recent pages |

## Configuration

The Playwright config is in `playwright.config.ts`:

- **Browser**: Chromium (Desktop Chrome)
- **Base URL**: `http://localhost:3000` (override with `BASE_URL` env var)
- **Web server**: Auto-starts `npm run dev` and waits for it to be ready
- **Timeout**: 60 seconds per test
- **Retries**: 2 in CI, 0 locally
- **Artifacts**: Traces, screenshots, and videos captured on failure

## CI Integration

In CI environments, tests run with:
- `forbidOnly` enabled (no `.only` in CI)
- 1 worker to avoid resource contention
- 2 retries for flaky tests

Set the `CI` environment variable to enable these settings:
```bash
CI=true npm run test:e2e
```

## Writing New Tests

Follow these conventions:

1. Place all test files in the `e2e/` directory with the `.spec.ts` extension
2. Use `test.describe()` to group related tests
3. Use `test.beforeEach()` for common setup (login, navigation)
4. Use `[data-testid="..."]` selectors where possible for stable element targeting
5. Use `.catch(() => false)` for optional UI elements that may not exist yet
6. Always set reasonable timeouts for visibility checks
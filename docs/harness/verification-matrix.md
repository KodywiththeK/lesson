# Verification Matrix

Use the smallest sufficient set for the change, then broaden when shared behavior is touched.

| Surface | Required Checks | Evidence |
| --- | --- | --- |
| Domain utility | Unit tests, typecheck | Command output |
| React component | Unit/component tests, accessibility-oriented queries | Command output |
| Page or route | Component/integration tests, browser smoke check | Command output and screenshot when visual |
| Critical user flow | Playwright E2E | Trace or screenshot on failure |
| Styling/design system | Browser screenshot desktop and mobile, visual overlap check | Screenshot paths |
| Supabase schema | Migration dry run, generated types if applicable | Migration output |
| Supabase RLS | Role-based access tests | Query results per role |
| PDF ingestion | Text extraction, rendered page review, OCR fallback when needed | Extract paths and page image paths |
| Build config | Lint, typecheck, build | Command output |

## Default Commands

These commands become active after the app scaffold exists:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:components`
- `pnpm test:e2e`
- `pnpm build`

## Browser Verification

For visual or interactive UI changes:

- Start the dev server.
- Inspect desktop and mobile viewports.
- Check that text does not overlap, buttons remain stable, and primary workflows are reachable.
- Confirm shadcn components use semantic tokens and accessible labels.


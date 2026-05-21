<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Notes

- Use `npm`; this repo tracks `package-lock.json`.
- Keep database access server-side through `src/lib/db.ts`.
- Use Server Actions in `src/app/actions/` for form mutations.
- Use Route Handlers in `src/app/api/` for API and streaming work.
- Validate user input with the existing Zod schemas in `src/lib/validators.ts`.
- Do not commit `.env`, `dev.db`, `.next`, or `src/generated/prisma`.
- Verify with `npm run lint` and `npm run build` when the change touches runtime code.

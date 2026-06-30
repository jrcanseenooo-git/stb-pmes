# PMES Operating Rules

## Typography — Font Family

The system font is set **once** in `vue-frontend/src/assets/main.css` using two rules:

```css
/* Sets the Inter stack for the whole app */
html, body, #app {
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif;
}

/* Forces ALL elements — including button/input/select — to inherit it */
* {
  font-family: inherit;
}
```

These two rules together mean every element in the entire system automatically uses the correct font, including form elements that browsers normally do not inherit font on.

**Rules — apply to every new module, view, component, or feature:**

- **Never add `font-family` to any new CSS.** Not to page wrappers, modals, buttons, inputs, or anything. The global `* { font-family: inherit }` handles it automatically.
- **Monospace exception** — password fields, code snippets, and formula text may use `font-family: 'DM Mono', monospace` or `'SF Mono', 'Fira Mono', monospace`. These are intentional overrides.
- **Login module** (`LoginView.vue`) is exempt — it uses its own font design intentionally.
- **SVG `<text>` attributes** may keep a short inline stack (e.g. `font-family="Inter,system-ui,sans-serif"`) since SVG attributes bypass CSS cascade.

If you find yourself typing `-apple-system` or `BlinkMacSystemFont` anywhere outside `main.css`, **stop and delete it**.

## Apps Script Updates

- For every Apps Script change, run the appropriate clasp command before considering the change complete.
- Use the existing deployment ID connected to the system.
- Do not create a new Apps Script deployment unless explicitly requested.
- Deployment descriptions must use this format:

```text
PMES_v{version}
```

Example:

```text
PMES_v120
```

## Required Checks Before Deploy

- Run this from the repository root before every local or live deploy:

```bash
npm run deploy:check
```

- `deploy:check` runs:

```bash
npm audit --prefix vue-frontend --audit-level=high
npm run build --prefix vue-frontend
```

- Patch high-severity dependency issues before deploying.
- Keep dependencies current, especially Vercel/runtime dependencies.

## Error Handling

- Log detailed errors privately on the server side only.
- Show users generic error messages.
- Never expose stack traces, raw exception text, secrets, tokens, spreadsheet IDs, or deployment URLs in browser messages.
- Frontend messages should tell the user what to do next, not reveal internal implementation details.

## Secrets

- Move all secrets server-side.
- Use environment variables for secrets.
- Secrets must never touch the browser, `public/`, frontend JavaScript, HTML, or CSS.
- Keep `.env`, service account files, keys, and credentials out of git.
- Use `.env.example` only for empty or non-sensitive variable names.

## Redirects And URLs

- Redirect only to paths on an allowlist.
- Reject absolute URLs unless they are controlled by this project.
- Whitelist only owned or approved AMIS domains.
- Do not accept user-controlled redirect targets.

## CORS

- Never use wildcard CORS in local or production.
- Allow only approved origins/domains.

## Rate Limiting

- Add rate limiting middleware before public deployment.
- Auth routes must allow at most 5 attempts per minute per IP.
- Failed login/signup/password attempts should be logged privately.
- Do not reveal whether an email exists during auth failures.

## Deployment Decision Rule

- If smoke tests fail, do not deploy.
- If a module is not verified locally, treat it as not production-ready.

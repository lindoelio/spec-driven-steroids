# Frontend Checks

Web UI, browser applications, and client-side validation.

## Frontend Domain Signals

- `package.json` with UI frameworks (React, Vue, Svelte, Angular)
- `index.html` at root
- `src/` with components, pages, App.{js,ts,svelte}
- `.css` / `.scss` / Tailwind config files
- Next.js, Nuxt, SvelteKit, Gatsby directories

## Frontend-Specific Check Categories

### 1. Rendering & DOM

```
- No render-blocking resources
- Critical CSS inlined
- Images have width/height to prevent layout shift
- Fonts loaded with font-display: swap
- No console errors on load
- Error boundaries catch render errors
```

### 2. Accessibility (a11y)

```
- All images have alt text
- Interactive elements are keyboard accessible
- Color contrast meets WCAG AA
- Form inputs have labels
- ARIA attributes used correctly
- Focus is visible and managed
- Screen reader announcements for dynamic content
```

### 3. Performance

```
- Bundle size <200KB gzipped (initial)
- Code splitting for routes
- Lazy loading for below-fold content
- No duplicate dependencies
- Tree-shaking working
- Images optimized/compressed
```

### 4. Security

```
- No inline scripts (CSP compliant)
- No eval() usage
- XSS prevention (sanitize user input)
- HTTPS only for production
- Sensitive data not in localStorage
- CSRF tokens on forms
```

### 5. State Management

```
- No prop drilling beyond 2 levels
- State updates are batched
- Memory leaks from listeners fixed
- Loading states handled
- Error states handled
- No stale closures
```

### 6. Responsive Design

```
- Mobile-first CSS
- Breakpoints documented
- Touch targets ≥44px
- No horizontal scroll
- Viewport meta tag present
- Tested at common viewport sizes
```

## Quick Frontend Checks

Run these first (fast, high signal):

```bash
# Build check
npm run build 2>&1 | head -50

# Lint check
npm run lint

# Type check
npm run typecheck  # or tsc --noEmit

# Bundle size check
npm run build -- --analyze  # if available
```

## Frontend Check Examples

### Example: Svelte Component Check

```svelte
<script>
  let { name, onSubmit } = $props();
  let loading = $state(false);
  
  async function handleSubmit(e) {
    e.preventDefault();
    loading = true;
    try {
      await onSubmit({ name });
    } finally {
      loading = false;
    }
  }
</script>

<!-- Check: All images have alt -->
<!-- Check: Form has accessible label -->
<form onsubmit={handleSubmit}>
  <label for="name-input">Name</label>
  <input 
    id="name-input"
    type="text" 
    bind:value={name} 
    disabled={loading}
  />
  <button type="submit" disabled={loading}>
    {loading ? 'Submitting...' : 'Submit'}
  </button>
</form>

<style>
  button:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
```

**Check清单:**
- [ ] `alt` text for images
- [ ] `for`/`id` on label/input pairs
- [ ] `type="submit"` on submit button
- [ ] Disabled state with loading indicator
- [ ] Error handling with try/finally
- [ ] Button text changes during loading

### Example: React Form Check

```jsx
function LoginForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    try {
      await login({ email });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Check: htmlFor instead of for */}
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        aria-describedby={error ? 'email-error' : undefined}
      />
      {/* Check: Error announced to screen readers */}
      {error && <div id="email-error" role="alert">{error}</div>}
      <button type="submit">Login</button>
    </form>
  );
}
```

**Check清单:**
- [ ] `htmlFor` (not `for`) on label
- [ ] `type="email"` for email input
- [ ] `required` attribute present
- [ ] `aria-describedby` links error to input
- [ ] `role="alert"` for error messages (screen reader)
- [ ] Error doesn't disappear on re-render without user action

## Common Frontend Bugs

| Bug | Symptom | Check |
|-----|---------|-------|
| Memory leaks | Browser slows over time | All listeners cleaned up |
| CLS | Layout shifts | All images have dimensions |
| a11y violations | Screen reader fails | axe-core automated check |
| XSS | Code injection | Sanitize all user input |
| Console errors | Feature broken | No errors in production |
| Bundle bloat | Slow load | Bundle analyzer |

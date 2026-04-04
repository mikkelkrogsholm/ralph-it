# Issue Format Standard

## Why format matters

ralph-it assembles a prompt from the issue body and sends it to an AI agent. Structured issues give the agent:
- Clear understanding of what to do
- Defined boundaries (scope + constraints)
- Measurable completion criteria

Unstructured issues like "fix the thing" produce poor results. Follow this standard.

## Standard Issue Template

```markdown
## Context
[Brief background — what exists now, what's the problem or need. Include links to relevant code, docs, or previous issues if helpful.]

## Task
[Precise description of what the agent should do. Be specific and actionable. One clear objective per issue.]

## Acceptance Criteria
- [ ] [Specific, verifiable criterion]
- [ ] [Another criterion]
- [ ] Tests pass
- [ ] No new lint errors

## Scope
[Files and modules the agent should focus on. Be explicit.]
- `src/path/to/module/` — description
- `src/path/to/file.ts` — description

## Constraints
[What the agent should NOT do. Critical for preventing unintended changes.]
- Do not modify [specific thing]
- Do not change [specific thing]
- Keep backwards compatibility with [specific thing]
```

## Required Labels

Every issue for ralph-it must have:

1. **`ralph:queued`** — marks it for pickup
2. **One `type:` label** — categorizes the work
3. **One `priority:` label** — determines processing order

Example: `ralph:queued` + `type:bug` + `priority:high`

## Examples by Type

### Bug Fix

**Title:** Fix null pointer in user profile when avatar is missing

**Labels:** `ralph:queued`, `type:bug`, `priority:high`

```markdown
## Context
Users without an uploaded avatar see a crash on the profile page.
The error is `TypeError: Cannot read properties of null (reading 'url')` 
at `src/components/UserProfile.tsx:42`.

## Task
Add null-safe access for the avatar field and render a default placeholder 
when no avatar is set.

## Acceptance Criteria
- [ ] Profile page loads without crash when avatar is null
- [ ] Default placeholder avatar is displayed
- [ ] Existing avatars still render correctly
- [ ] Unit test covers the null avatar case
- [ ] No TypeScript errors

## Scope
- `src/components/UserProfile.tsx` — the crash location
- `src/components/__tests__/UserProfile.test.tsx` — add test

## Constraints
- Do not change the User type definition
- Do not modify the avatar upload flow
```

### Feature

**Title:** Add rate limiting to public API endpoints

**Labels:** `ralph:queued`, `type:feature`, `priority:medium`

```markdown
## Context
Our public API has no rate limiting. We've seen abuse patterns in logs 
where single IPs make >1000 requests/minute.

## Task
Implement IP-based rate limiting for all routes under `/api/v1/public/`.
Use a sliding window algorithm. Limit: 100 requests per minute per IP.
Return 429 Too Many Requests with a Retry-After header when exceeded.

## Acceptance Criteria
- [ ] Rate limiter middleware applied to /api/v1/public/* routes
- [ ] Returns 429 with Retry-After header when limit exceeded
- [ ] Rate limit is per-IP using sliding window
- [ ] Integration test verifies rate limiting behavior
- [ ] Existing authenticated endpoints are NOT affected
- [ ] Rate limit configuration is in environment variables

## Scope
- `src/middleware/` — new rate limiter middleware
- `src/routes/public.ts` — apply middleware
- `src/config.ts` — rate limit config values
- `test/integration/rate-limit.test.ts` — new test

## Constraints
- Do not add external dependencies (use in-memory store)
- Do not modify authenticated API routes
- Do not change existing middleware order for non-public routes
```

### Refactor

**Title:** Extract database queries from route handlers into repository layer

**Labels:** `ralph:queued`, `type:refactor`, `priority:low`

```markdown
## Context
Route handlers in `src/routes/users.ts` contain inline SQL queries.
This makes testing difficult and violates separation of concerns.
The pattern should match `src/repositories/posts.ts` which already 
uses the repository pattern.

## Task
Extract all database queries from `src/routes/users.ts` into a new
`src/repositories/users.ts` repository module. Follow the same pattern
used in `src/repositories/posts.ts`.

## Acceptance Criteria
- [ ] All SQL queries moved to src/repositories/users.ts
- [ ] Route handlers call repository methods instead of direct queries
- [ ] Repository follows the same interface pattern as posts.ts
- [ ] Existing tests still pass
- [ ] New unit tests for repository methods
- [ ] No behavior changes in API responses

## Scope
- `src/routes/users.ts` — remove inline queries
- `src/repositories/users.ts` — new file
- `src/repositories/posts.ts` — reference for pattern
- `test/repositories/users.test.ts` — new tests

## Constraints
- Do not change API response format
- Do not modify the database schema
- Do not touch other route files
- Follow the exact pattern in posts.ts
```

### Test Coverage

**Title:** Add unit tests for authentication middleware

**Labels:** `ralph:queued`, `type:test`, `priority:medium`

```markdown
## Context
`src/middleware/auth.ts` has 0% test coverage. It handles JWT validation,
role checking, and session refresh. It's critical security code.

## Task
Write comprehensive unit tests for the auth middleware covering:
- Valid JWT token → request passes through
- Expired JWT → 401 response
- Malformed JWT → 401 response
- Missing Authorization header → 401 response
- Valid token but insufficient role → 403 response
- Session refresh when token is near expiry

## Acceptance Criteria
- [ ] All 6 scenarios above have passing tests
- [ ] Edge cases covered (empty string token, wrong scheme)
- [ ] Mocks for JWT verification and database calls
- [ ] Coverage for auth.ts reaches >90%
- [ ] Tests run in <2 seconds

## Scope
- `src/middleware/auth.ts` — the code to test
- `test/middleware/auth.test.ts` — new test file

## Constraints
- Do not modify auth.ts (test-only changes)
- Use the existing test framework (vitest)
- Mock external calls, do not hit real database
```

## Tips for Writing Good Issues

1. **One task per issue.** If you have 5 things to do, create 5 issues.
2. **Be specific in Task.** "Improve performance" is bad. "Add database index on users.email column" is good.
3. **Scope is critical.** Tell the agent exactly which files to touch. Prevents it from wandering.
4. **Constraints prevent disasters.** Always list what should NOT change.
5. **Acceptance Criteria should be verifiable.** "Code is clean" is bad. "Tests pass" is good.
6. **Link to patterns.** If there's existing code the agent should follow, point to it in Context.
7. **Priority matters.** `priority:critical` is processed before `priority:low`.

## Batch Issue Creation

To create multiple issues efficiently from the CLI:

```bash
# Single issue
gh issue create \
  --title "Fix null pointer in user profile" \
  --label "ralph:queued,type:bug,priority:high" \
  --body-file issue-body.md

# From a script
for file in issues/*.md; do
  title=$(head -1 "$file" | sed 's/^# //')
  labels=$(sed -n '2p' "$file")
  body=$(tail -n +3 "$file")
  gh issue create --title "$title" --label "$labels" --body "$body"
done
```

## Converting Existing Issues

To add existing GitHub issues to the ralph-it queue:

```bash
# Add ralph:queued label to an existing issue
gh issue edit 42 --add-label ralph:queued

# Batch: add to all issues with a specific label
gh issue list --label "backlog" --json number --jq '.[].number' | \
  xargs -I{} gh issue edit {} --add-label ralph:queued
```

Make sure existing issues follow the standard format, or edit them first.

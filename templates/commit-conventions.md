# Commit Message Conventions

## Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

## Rules

- **type**: fix, feat, docs, test, refactor, deps, chore, ci, perf
- **scope**: optional, component or module name
- **description**: imperative mood, lowercase, no period at end
- Max 72 characters for subject line
- Body (optional): explain "why" not "what"
- Footer: `Fixes #<issue>` or `Refs #<issue>`

## Examples

```
fix(parser): handle null input in tokenizer

The tokenizer would throw a NullPointerException when given
null input. Now returns an empty token list instead.

Fixes #1234
```

```
docs(api): add missing rate limit section to REST docs

Refs #5678
```

```
test(auth): add edge cases for expired JWT tokens
```

## Branch Naming

```
Pattern: clawoss/<type>/<issue-number>-<short-description>

Types: fix/, feat/, docs/, test/, refactor/, deps/, chore/

Examples:
  clawoss/fix/1234-null-pointer-in-parser
  clawoss/docs/5678-update-api-reference
  clawoss/test/9012-add-missing-edge-cases
  clawoss/deps/3456-bump-lodash-to-4.17.21
```

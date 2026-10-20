# Code conventions

Use these conventions when writing and reviewing JavaScript or TypeScript, including
expressions in templates. Apply them to new and changed code.

## Conditional choices

Choose the form that makes the decision and its priority easy to follow:

| Decision                                                | Preferred form                          |
| ------------------------------------------------------- | --------------------------------------- |
| One simple condition selecting between two short values | A single ternary                        |
| Ordered conditions that return a value                  | Flat `if` statements with early returns |
| Ordered conditions followed by shared work              | An `if` / `else if` / `else` chain      |
| Several cases of one value                              | A `switch`                              |
| A direct key-to-value mapping with no conditional work  | A typed lookup table, when clearer      |

A ternary's condition and results must not contain another ternary. Splitting it
across lines or adding parentheses does not make the decision simpler. Keep simple
choices such as `paused ? 'Resume effect' : 'Pause effect'` inline.

Preserve condition priority and evaluate only the selected branch. Do not replace
ordered conditions with independent `if` statements that overwrite a prior result,
or eagerly evaluate every result in a lookup table. Use `??` for a null/undefined
fallback and `?.` for optional access when those are the intended semantics; `||`
also replaces valid falsy values.

Keep the decision local. Extract a named function when it expresses a cohesive
decision or removes meaningful repetition. A lookup table, helper layer or state
machine is not required just to avoid a ternary.

For example, the docs lab chooses its label before updating the button:

```ts
let label: string;
if (!hasGpu) {
  label = 'Effects unavailable';
} else if (reducedMotion.matches) {
  label = 'Reduced motion';
} else if (!handle || handle.lifecycle !== 'active') {
  label = 'Start effect';
} else {
  label = paused ? 'Resume effect' : 'Pause effect';
}
toggle.setAttribute('aria-label', label);
toggle.title = label;
```

This is a project readability preference, supported by the
[ESLint rule](https://eslint.org/docs/latest/rules/no-nested-ternary) and
[Oxlint's style rule](https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-nested-ternary.html).
[Guard clauses](https://refactoring.com/catalog/replaceNestedConditionalWithGuardClauses.html)
illustrate the flat-return form. The fallback distinction follows
[TypeScript's optional chaining and nullish coalescing semantics](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html).
These sources establish language behavior and style guidance, not a performance benefit.
TypeScript conditional types are a separate type-level construct.

## Final review

- [ ] Changed expressions use simple two-way ternaries or explicit control flow.
- [ ] Branch priority, fallbacks, selected-branch evaluation and shared cleanup remain correct.
- [ ] Helpers and tables clarify the decision without adding unnecessary indirection.

Review template expressions too. The existing lint configuration does not enforce
this preference; repository-wide cleanup and enabling `no-nested-ternary` are separate work.

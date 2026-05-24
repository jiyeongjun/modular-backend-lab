# Type Safety Policy

This repository prefers compile-time guarantees over runtime conventions whenever TypeScript can
model the constraint clearly.

The goal is not advanced type gymnastics. The goal is to make invalid states difficult or impossible
to represent.

## Non-Negotiable Rules

1. Keep TypeScript strict mode enabled.
2. Do not weaken `tsconfig.json`.
3. Keep or strengthen these compiler options unless there is a documented reason:
   - `strict`
   - `noUncheckedIndexedAccess`
   - `exactOptionalPropertyTypes`
   - `noImplicitOverride`
   - `noFallthroughCasesInSwitch`
   - `noImplicitReturns`
   - `useUnknownInCatchVariables`
   - `forceConsistentCasingInFileNames`
4. Do not introduce `any` unless the reason is documented and the scope is tightly contained.
5. Prefer `unknown` at untrusted boundaries, then validate and narrow.
6. Use Zod at boundaries to convert unknown input into typed commands.
7. Do not use type assertions to bypass the compiler.
8. Avoid `as SomeType` unless wrapping a well-contained boundary conversion.
9. Avoid `as any` entirely.
10. Avoid non-null assertions `!` unless the invariant is locally obvious and documented.
11. Prefer discriminated unions for state, errors, events, and command results.
12. Use exhaustive checks for discriminated unions.
13. Prefer literal unions over loosely typed strings.
14. Prefer branded or opaque types for important identifiers when useful.
15. Prefer explicit domain types over raw primitives for money, IDs, quantities, statuses, and versions.
16. Keep DB row types separate from domain types.
17. Keep HTTP DTOs separate from application commands.
18. Keep Zod schemas separate from domain models.
19. Exported functions should have explicit return types.
20. Avoid broad object shapes such as `Record<string, unknown>` in domain/application code unless justified.
21. Prefer `satisfies` when checking object conformance without widening.
22. Use `as const` for stable literal definitions where useful.
23. Use `assertNever` or equivalent exhaustive checking for impossible branches.
24. Do not silence the compiler to make code pass.
25. If type complexity becomes excessive, simplify the model rather than adding type tricks.
26. Type-level cleverness must serve domain clarity.
27. `pnpm typecheck` must pass before declaring completion.

## Preferred Modeling

Prefer discriminated unions:

```ts
export type OrderStatus = "PENDING" | "PAID" | "CANCELLED";

export type PayOrderError =
  | { type: "OrderNotFound"; orderId: OrderId }
  | { type: "OrderNotPayable"; status: OrderStatus }
  | { type: "EmptyOrder" };
```

Over stringly typed objects:

```ts
export type PayOrderError = {
  code: string;
  message: string;
};
```

Use exhaustive checks:

```ts
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

export function mapPayOrderError(error: PayOrderError): HttpError {
  switch (error.type) {
    case "OrderNotFound":
      return { status: 404, body: error };
    case "OrderNotPayable":
    case "EmptyOrder":
      return { status: 409, body: error };
    default:
      return assertNever(error);
  }
}
```

The compiler should fail when a new error variant is added but not handled.

## Branded Identifiers

For important identifiers, prefer branded types where the extra clarity is useful.

```ts
type Brand<T, B extends string> = T & { readonly __brand: B };

export type OrderId = Brand<string, "OrderId">;
export type ProductId = Brand<string, "ProductId">;
```

Do not overuse brands for every primitive. Use them where accidental mixing would be costly.

## Boundary Narrowing

Untrusted input should start as `unknown` or a boundary DTO, then be narrowed.

Good:

```ts
const body = schema.parse(await c.req.json());
const command: PayOrderCommand = {
  orderId: toOrderId(body.orderId),
};
```

Bad:

```ts
const command = (await c.req.json()) as PayOrderCommand;
```

## Type Tests

Do not add type-level tests mechanically. Type tests are useful only for shared primitives or helpers
where compile-time behavior is part of the API contract. Do not test TypeScript itself.

## AI Agent Instruction

When a type error appears, fix the model or boundary conversion. Do not paper over it with `as any`,
non-null assertions, broad casts, or weaker compiler settings.

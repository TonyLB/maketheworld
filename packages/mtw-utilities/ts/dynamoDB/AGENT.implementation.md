This file records **where to find behavior** in this area's source tree. Falsifiable rules: [`AGENT.contract.md`](./AGENT.contract.md).

## `transactWrite` and its transaction-request kinds

- [`mixins/transact.ts`](mixins/transact.ts) --- `withTransaction`'s `transactWrite` method: batch-fetches un-primed `Update`/`MultiKeyUpdate` keys in one `getItems` call, converts every `TransactionRequest` item into zero or more raw `TransactWriteItem`s, flattens them, and sends exactly one `TransactWriteItemsCommand`.
  - `TransactionRequest` union (`Put`, `Delete`, `Update`, `PrimitiveUpdate`, `SetOperation`, `ConditionCheck`, `MultiKeyUpdate`) is defined at the top of the file.
  - The `MultiKeyUpdate` branch (inside the big `items.map(...)` in `transactWrite`) builds a `priorRecord`/`nextRecord` pair via `produce`, then per key: `deepEqual` unchanged -> `_unchangedFieldConditions` -> `ConditionCheck`; changed -> `_optimisticUpdateFactory` (reused from `update.ts`, unmodified) -> `Update`.
  - `_marshalledKeyString` and `_unchangedFieldConditions` are private helper methods on `TransactionDBHandler`, both defined just above `transactWrite`.
- [`mixins/update.ts`](mixins/update.ts) --- `updateByReducer` and `_optimisticUpdateFactory`: the single-item optimistic-lock-by-reducer machinery that `MultiKeyUpdate`'s "changed" path reuses directly. `UpdateExtendedProps` is the single-item `Update` kind's full prop surface (not shared by `MultiKeyUpdate`, which has its own smaller prop type, `TransactionRequestMultiKeyUpdate`, in `transact.ts`).
- Tests: [`mixins/transact.test.ts`](mixins/transact.test.ts) (the other 6 kinds), [`mixins/transact.multiKeyUpdate.test.ts`](mixins/transact.multiKeyUpdate.test.ts) (`MultiKeyUpdate` specifically), [`mixins/update.test.ts`](mixins/update.test.ts) (single-item `Update`/`optimisticUpdate`).

## Not yet built

A generalized before/after cascade for `MultiKeyUpdate` (a callback seeing the reducer's actual `(prior, next)` output, returning arbitrary extra transact items merged into the same transaction) is planned but not implemented --- see [`taskPlanning/packages/mtw-utilities/ts/dynamoDB/AGENT.multiItemOptimisticUpdateTransact.planning.md`](../../../../taskPlanning/packages/mtw-utilities/ts/dynamoDB/AGENT.multiItemOptimisticUpdateTransact.planning.md).

# Unit Test Regressions - Categorized for GitHub Issues

## Summary
After fixing merge operation tests, we have **~18-20 remaining test failures** across **6 test files**, grouped into **6 distinct categories**.

---

## Issue 1: Schema Converter Missing for String Tags
**Status: ✅ RESOLVED** | **Priority: High** | **Files Affected: 3** | **Failures: 3**

### Problem
`converterMap` in `ts/schema/converters/index.ts` is missing an entry for `"String"` tags. Tests that parse `<String>` tags fail because `converterMap["String"]` is undefined.

### Error Pattern
```
TypeError: Cannot read properties of undefined (reading 'initialize')
at SchemaAggregator.acceptOpenTag (ts/schema/index.ts:159:42)
```

### Affected Tests
- `exitPayload.test.ts`: "should create from String tag schema" (2 tests)
- `markFacetPayload.test.ts`: "should create from String tag schema" (1 test)

### Root Cause
The schema parsing system needs a converter for `String` tags to handle WML parsing. This is likely a missing converter registration.

### Resolution
**Issue was a misunderstanding of WML schema structure.** WML does not use explicit `<String>` tags - plain text is automatically treated as `String` by the parser. All affected tests were updated to use plain text instead of explicit `<String>` tags:
- `exitPayload.test.ts`: Both tests now use plain text (`'North Exit'` and `''`)
- `markFacetPayload.test.ts`: Redundant test removed (was testing Match tags, not String tags)

No converter registration needed - the error was caused by incorrect test setup, not missing functionality.

---

## Issue 2: Invalid Constructor Arguments - StandardLiteralSimpleBase
**Priority: High** | **Files Affected: 3** | **Failures: 5**

### Problem
`payloadFactory` in `ts/standardize/literal/index.ts` receives arguments in a format it doesn't handle. The factory expects either:
- A string, OR
- A single-element GenericTree with a String tag

But it's receiving something else (possibly empty/undefined or a different schema structure).

### Error Pattern
```
Error: Invalid argument in StandardLiteralSimpleBase constructor
at Object.payloadFactory (ts/standardize/literal/index.ts:35:11)
```

### Affected Tests
- `integration.test.ts`: ExitPayload round-trip tests (3 tests)
- `example.test.ts`: "should handle Replace operations on Mark Facets" (1 test)
- `markFacetPayload.test.ts`: "should handle empty narrative string" (1 test - different error but related)

### Root Cause
The `payloadFactory` function needs to handle additional input formats, likely:
- Empty/undefined values
- Different schema structures from WML parsing
- Replace-wrapped structures

### Investigation Needed
- Check what format `createExitFacetPayload` receives when parsing from WML
- Verify if empty String tags need special handling
- Check if Replace operations need different parsing logic

---

## Issue 3: Invalid Constructor Arguments - StandardPositionPayloadBase
**Priority: Medium** | **Files Affected: 1** | **Failures: 1**

### Problem
The `payloadFactory` in `ts/standardize/keys/facets/position.ts` receives an unexpected format when parsing Remove-wrapped Remove structures (double-negative).

### Error Pattern
```
Error: Invalid argument in StandardPositionPayloadBase factory
at Object.payloadFactory (ts/standardize/keys/facets/position.ts:65:11)
```

### Affected Tests
- `facetFactory.test.ts`: "should handle double-negative (Remove-wrapped Remove)" (1 test)

### Root Cause
When parsing `<Remove><Remove><Position>...</Position></Remove></Remove>`, the factory receives a structure it can't parse. This might be a schema extraction issue in `facetFactory.ts` when handling nested Remove tags.

### Investigation Needed
- Check how `facetFactory.ts` extracts payload children from Remove-wrapped schemas
- Verify if double-negative parsing needs special handling
- Check if payload extraction logic needs to handle nested Remove tags

---

## Issue 4: Property Access on Payload Classes
**Priority: Medium** | **Files Affected: 3** | **Failures: 4**

### Problem
Payload class instances don't expose direct property access (`.x`, `.y`, `.description`), even though `toJSON()` works correctly. Tests expect direct property access but get `undefined`.

### Error Pattern
```
expect(received).toBe(expected)
Expected: 10 (or "A wooden door")
Received: undefined
```

### Affected Tests
- `facet.test.ts`: "should construct from StandardFacetData with ExitPayload" - `.description` access
- `integration.test.ts`: PositionPayload round-trip tests - `.x`, `.y` access (2 tests)
- `facetFactory.test.ts`: "should construct from GenericTree<SchemaTag>" - `.x`, `.y` access (1 test)

### Root Cause
Payload classes (like `PositionFacetPlainClass`, `ExitFacetPlainClass`) wrap the actual payload data but don't expose it as direct properties. The payload is stored internally and only accessible via `toJSON()`.

### Investigation Needed
- Check if payload classes should expose properties via getters
- Verify if tests should use `toJSON()` instead of direct property access
- Check if this is a design decision or a missing feature

### Potential Solutions
1. Add getter properties to payload classes (e.g., `get x()`, `get y()`, `get description()`)
2. Update tests to use `toJSON()` instead of direct property access
3. Add a `plain` getter that returns the underlying payload object

---

## Issue 5: Invert Operation Returns Wrong Payload Structure
**Priority: Medium** | **Files Affected: 2** | **Failures: 2**

### Problem
When calling `facet.invert()`, the `payload.toJSON()` returns a Remove-wrapped structure `{tag: "Remove", match: {...}}` instead of the plain payload data.

### Error Pattern
```
expect(received).toEqual(expected)
Expected: { x: 10, y: 20 }
Received: { tag: "Remove", match: { x: 10, y: 20 } }
```

### Affected Tests
- `facetFactory.test.ts`: "should invert reference" (1 test)
- `facet.test.ts`: "should invert when diffing from facet to nothing" (1 test)

### Root Cause
The `invert()` method calls `payload.invert()`, which returns a Remove-wrapped payload (correct for edit operations), but the test expects the plain payload data.

### Investigation Needed
- Check if `invert()` should return a Remove-wrapped payload (for edit semantics) or plain payload
- Verify if tests need to extract the payload from the Remove structure
- Check if there's a `plain` property that should be used instead

### Potential Solutions
1. Update tests to expect Remove-wrapped structure (if that's the correct behavior)
2. Update tests to extract payload from `inverted.payload.match` or use `inverted.payload.plain`
3. Change `invert()` behavior if it's incorrect

---

## Issue 6: Render Operation Issues
**Priority: Medium** | **Files Affected: 2** | **Failures: 2**

### Problem
1. `renderFacet()` returns `undefined` when it should return a node
2. Negative reference rendering produces wrong WML structure (missing nested Remove tags)

### Error Patterns
```
expect(received).toBeDefined()
Received: undefined

expect(received).toBe(expected)
Expected: <Remove><Room><Remove><Position/></Remove></Room></Remove>
Received: <Remove><Room><Position/></Room></Remove>
```

### Affected Tests
- `integration.test.ts`: "should handle Replace operations with Exit facet" (1 test)
- `facetFactory.test.ts`: "should invert payload when reference is negative (transitivity)" (1 test)

### Root Cause
1. `renderFacet()` may not be handling Replace operations correctly for Exit facets
2. When reference is negative, the payload inversion and rendering may not be creating the correct nested Remove structure

### Investigation Needed
- Check `renderFacet()` implementation in `facetFactory.ts` and payload classes
- Verify transitivity logic: when ref < 0, payload should be inverted before rendering
- Check if Exit facet rendering needs special handling for Replace operations
- Verify if nested Remove tags are being created correctly

---

## Recommended Issue Order

1. **Issue 1: Schema Converter Missing** - Blocks multiple tests, likely a simple registration fix
2. **Issue 2: StandardLiteralSimpleBase Constructor** - Blocks 5 tests, needs payload factory updates
3. **Issue 4: Property Access** - May be test expectations vs. design decision
4. **Issue 5: Invert Operation** - May be test expectations vs. correct behavior
5. **Issue 3: StandardPositionPayloadBase** - Single test, edge case
6. **Issue 6: Render Operations** - Complex rendering logic, may depend on other fixes

---

## Notes
- Some issues may resolve others (e.g., fixing Issue 1 might fix some Issue 2 cases)
- Issue 4 and 5 might be test expectation issues rather than code bugs
- Consider running tests after each issue to see cascading fixes

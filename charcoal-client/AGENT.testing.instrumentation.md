# Client instrumentation (testing & debugging)

This document describes the **patterns** and tools we use in the charcoal client to instrument behavior for debugging and diagnosis. It is updated as we adopt new patterns and add tools.

<!-- Stub: contents will be filled in progressively as we implement instrumentation. -->

## Conventions

- **Use `console.log` for instrumentation output.** Do not use `console.debug`. In browser DevTools, `console.debug` is treated as "Verbose" and is often hidden by default; instrumentation logs would not appear until the user enables Verbose level. Using `console.log` ensures logs are visible with default console settings.

## Patterns

*(Documented as we implement them.)*

### Removing instrumentation

When we remove instrumentation (e.g. after a bug is fixed), we must remove **both**:

1. **The logging** – the `console.log` (or other trace) at the instrumented site(s).
2. **The up-the-tree discrimination that activates it** – anything that gates or triggers that logging:
   - The activation key/constant (e.g. in `scopedInstrumentation.ts`) if it was only used for this flow.
   - Call sites that pass `options={{ instrumentation: ['that-key'] }}` into the pipeline.
   - Props like `instrumentationKey` passed into hooks/components that check `options?.instrumentation?.includes(instrumentationKey)` before logging.

Leaving the key or the options in place without the log means dead config and confusion when someone re-enables a key expecting logs. Remove the key and the options that referenced it so the pipeline is consistent.

## Available tools

*(None yet.)*

## Usage

*(To be added per pattern/tool.)*

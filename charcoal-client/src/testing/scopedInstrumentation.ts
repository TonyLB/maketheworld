/**
 * Types for scoped instrumentation (options threading).
 * See AGENT.testing.instrumentation.planning.md for the pattern.
 */

/**
 * Options argument threaded through components/functions that participate in
 * scoped instrumentation. Pass this from callers and extend it as needed.
 * First property is instrumentation so it's easy to spot and pass through.
 */
export interface ScopedInstrumentationOptions {
  /** Activation keys: when present, instrumented sites may emit logs/traces for matching keys. */
  instrumentation?: string[];
}

/** Instrumentation keys for discoverability and to avoid string typos. Add keys here when adding new scoped instrumentation. */
export const INSTRUMENTATION_KEYS = {
    WORKBENCH_COMPONENT_SESSION: 'workbench-component-session',
    WORKBENCH_ASSET_META_SESSION: 'workbench-asset-meta-session',
    WML_STREAM_SYNC: 'wml-stream-sync'
} as const

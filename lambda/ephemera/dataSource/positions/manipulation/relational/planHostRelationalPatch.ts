import type { HostRelationalPatch } from '../types'
import type { RelationalIngressArgs } from './types'

/**
 * Pure, synchronous builder (BD-15/16 slice 3, 2026-07-15) --- previously fetched
 * the host graph to precompute a `changed` hint, which `applyObjectRelationalChange.ts`
 * used to skip persistence entirely on an apparent no-op. That precompute could go
 * stale between this fetch and commit, silently skipping a command that should have
 * taken effect. `changed` is now determined live, inside `applyHostRelationalPatch`'s
 * commit-time reducer, against freshly-fetched state --- this function only builds
 * the patch structurally from already-resolved ingress args.
 */
export const planHostRelationalPatch = (args: RelationalIngressArgs): HostRelationalPatch => ({
    hostId: args.hostId,
    edge: {
        from: args.subjectId,
        to: args.targetId,
        kind: args.relationKind,
        ...(args.relationLabel !== undefined ? { relationLabel: args.relationLabel } : {}),
    },
    op: args.operation === 'establish' ? 'add' : 'remove',
})

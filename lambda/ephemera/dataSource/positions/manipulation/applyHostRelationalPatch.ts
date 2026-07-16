import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { ephemeraDB, exponentialBackoffWrapper } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { EphemeraPositionGraph, graphFromMeta, hostDataCategory } from '../positionGraph'
import type {
    ApplyHostRelationalPatchArgs,
    ApplyHostRelationalPatchResult,
    HostRelationalPatch,
} from './types'

export type ApplyHostRelationalPatchDependencies = {
    transactWrite?: typeof ephemeraDB.transactWrite
}

type HostRelationalPatchTransactItem = Parameters<typeof ephemeraDB.transactWrite>[0][number]

const affectedHostIds = (patches: HostRelationalPatch[]): EphemeraMembershipHostId[] =>
    [...new Set(patches.map((patch) => patch.hostId))]

/**
 * `MultiKeyUpdate`-based kernel primitive for `establishRelation`/`dissolveRelation`
 * (BD-15/16 slice 3, 2026-07-15) --- supersedes the earlier fetch-then-simulate-
 * then-separately-transact design, which had the exact same latent race Arc A
 * already fixed once for `transferMembership` (BD-13 slice 3): legality was
 * checked once against a snapshot (`validateAndSimulatePatches`), then the actual
 * commit-time reducer (formerly `hostRelationalPatchTransactItems.ts`) blindly
 * applied the precomputed edge to whatever the live draft contained, with no
 * re-validation. This version reruns `EphemeraPositionGraph.applyRelationalPatch`
 * itself --- the single shared legality authority, already host-agnostic (`bothObjectsOnGraph`,
 * duplicate-edge idempotency, `Custom`-label requirement) --- against freshly-fetched
 * graphs inside the reducer, and throws to abort the whole transact on any
 * staleness or illegality, rather than trusting an earlier snapshot. `transactWrite`'s
 * own internal `MultiKeyUpdate` fetch is the only fetch this function performs.
 *
 * A useful side effect of reusing `applyRelationalPatch` directly: a `sameHost`
 * (BD-15/16) violation discovered only at commit time (a concurrent write moved
 * one of the objects since selection) is caught here for free, via `bothObjectsOnGraph`,
 * and fails the transact with the same single generic error code every other
 * staleness/illegality case gets --- not a bespoke `sameHost`-specific check.
 * Self-healing an enum-kind violation (recomputing a fresh `transferMembership`
 * repair and bundling it atomically) is not attempted here --- that needs compound
 * atomic bundling (BD-9) and remains named-but-not-built future work (see BD-18).
 */
export const applyHostRelationalPatch = async (
    args: ApplyHostRelationalPatchArgs,
    deps?: ApplyHostRelationalPatchDependencies
): Promise<ApplyHostRelationalPatchResult> => {
    const { patches } = args

    if (patches.length === 0) {
        return { ok: true, persisted: false, changed: false }
    }

    const transactWrite = deps?.transactWrite ?? ephemeraDB.transactWrite.bind(ephemeraDB)

    const hostIds = affectedHostIds(patches)

    let anyChanged = false
    let postApplyGraphs: EphemeraPositionGraph[] | undefined

    const multiKeyItem: HostRelationalPatchTransactItem = {
        MultiKeyUpdate: {
            Keys: hostIds.map((hostId) => ({ EphemeraId: hostId, DataCategory: hostDataCategory(hostId) })),
            updateKeys: ['positionGraph'],
            reducer: (draft: Record<string, any>) => {
                const graphs: EphemeraPositionGraph[] = []
                for (const hostId of hostIds) {
                    const entry = Object.values(draft).find(
                        (item: any) => item.EphemeraId === hostId && item.DataCategory === hostDataCategory(hostId)
                    )
                    if (!entry) {
                        throw new Error('applyHostRelationalPatch: MultiKeyUpdate fetch missing an expected host item')
                    }

                    let graph = graphFromMeta(entry, hostId)
                    for (const patch of patches.filter((patch) => patch.hostId === hostId)) {
                        const prior = graph
                        graph = graph.applyRelationalPatch(patch)
                        if (!graph.equals(prior)) {
                            anyChanged = true
                        }
                    }

                    entry.positionGraph = graph.toStored()
                    graphs.push(graph)
                }
                postApplyGraphs = graphs
            },
        },
    } as HostRelationalPatchTransactItem

    // `exponentialBackoffWrapper` silently resolves (no throw) for a non-retryable
    // error outside DEVELOPER_MODE --- matching `applyObjectSetTransfer.ts`'s
    // convention, `persisted` is the only reliable signal that the transact
    // actually committed (a reducer throw from a stale/illegal patch is exactly
    // the kind of non-retryable failure this wrapper can swallow).
    let persisted = false
    try {
        await exponentialBackoffWrapper(
            async () => {
                await transactWrite([multiKeyItem])
                persisted = true
            },
            { retryErrors: ['TransactionCanceledException'] }
        )
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { ok: false, errorCode: 'HOST_RELATIONAL_PATCH_TRANSACT_FAILED', errorMessage: message }
    }

    if (!persisted || !postApplyGraphs) {
        return {
            ok: false,
            errorCode: 'HOST_RELATIONAL_PATCH_TRANSACT_FAILED',
            errorMessage: 'transactWrite did not persist (see logs)',
        }
    }

    if (!anyChanged) {
        return { ok: true, persisted: false, changed: false }
    }

    return {
        ok: true,
        persisted: true,
        changed: true,
        postApplyGraphs,
    }
}

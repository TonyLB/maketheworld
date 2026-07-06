import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { ephemeraDB, exponentialBackoffWrapper } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../../internalCache'
import { EphemeraPositionGraph } from '../positionGraph'
import type {
    ApplyHostRelationalPatchArgs,
    ApplyHostRelationalPatchResult,
    HostRelationalPatch,
} from './types'
import { buildHostRelationalPatchTransactItems } from './relational/hostRelationalPatchTransactItems'

export type ApplyHostRelationalPatchDependencies = {
    getPositionGraph?: (hostId: EphemeraRoomId) => Promise<EphemeraPositionGraph>
    transactWrite?: typeof ephemeraDB.transactWrite
}

const defaultGetPositionGraph = async (hostId: EphemeraRoomId): Promise<EphemeraPositionGraph> =>
    internalCache.Positions.getPositionGraph(hostId)

const affectedHostIds = (patches: HostRelationalPatch[]): EphemeraRoomId[] =>
    [...new Set(patches.map((patch) => patch.hostId))]

const validateAndSimulatePatches = (
    patches: HostRelationalPatch[],
    graphsByHost: Map<EphemeraRoomId, EphemeraPositionGraph>
):
    | { ok: true; changed: boolean; postApplyGraphs: EphemeraPositionGraph[] }
    | { ok: false; errorCode: string; errorMessage: string } => {
    let anyChanged = false
    const workingGraphs = new Map<EphemeraRoomId, EphemeraPositionGraph>()

    for (const patch of patches) {
        const prior = workingGraphs.get(patch.hostId) ?? graphsByHost.get(patch.hostId)
        if (!prior) {
            return {
                ok: false,
                errorCode: 'HOST_RELATIONAL_PATCH_VALIDATION_FAILED',
                errorMessage: `Missing graph for host ${patch.hostId}`,
            }
        }

        try {
            const next = prior.applyRelationalPatch(patch)
            if (!next.equals(prior)) {
                anyChanged = true
            }
            workingGraphs.set(patch.hostId, next)
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            return {
                ok: false,
                errorCode: 'HOST_RELATIONAL_PATCH_VALIDATION_FAILED',
                errorMessage: message,
            }
        }
    }

    return {
        ok: true,
        changed: anyChanged,
        postApplyGraphs: [...workingGraphs.values()],
    }
}

export const applyHostRelationalPatch = async (
    args: ApplyHostRelationalPatchArgs,
    deps?: ApplyHostRelationalPatchDependencies
): Promise<ApplyHostRelationalPatchResult> => {
    const { patches } = args

    if (patches.length === 0) {
        return { ok: true, persisted: false, changed: false }
    }

    const getPositionGraph = deps?.getPositionGraph ?? defaultGetPositionGraph
    const transactWrite = deps?.transactWrite ?? ephemeraDB.transactWrite.bind(ephemeraDB)

    const hostIds = affectedHostIds(patches)
    const graphsByHost = new Map<EphemeraRoomId, EphemeraPositionGraph>()

    await Promise.all(
        hostIds.map(async (hostId) => {
            const graph = await getPositionGraph(hostId)
            graphsByHost.set(hostId, graph)
        })
    )

    const simulation = validateAndSimulatePatches(patches, graphsByHost)
    if (!simulation.ok) {
        return simulation
    }

    if (!simulation.changed) {
        return { ok: true, persisted: false, changed: false }
    }

    const { postApplyGraphs } = simulation

    try {
        let persisted = false
        await exponentialBackoffWrapper(async () => {
            const transactItems = buildHostRelationalPatchTransactItems(patches)
            if (transactItems.length === 0) {
                return
            }
            await transactWrite(transactItems)
            persisted = true
        }, { retryErrors: ['TransactionCanceledException'] })

        if (!persisted) {
            return { ok: true, persisted: false, changed: false }
        }

        return {
            ok: true,
            persisted: true,
            changed: true,
            postApplyGraphs,
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
            ok: false,
            errorCode: 'HOST_RELATIONAL_PATCH_TRANSACT_FAILED',
            errorMessage: message,
        }
    }
}

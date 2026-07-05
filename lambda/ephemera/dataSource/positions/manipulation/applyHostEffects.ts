import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { EphemeraPositionGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ephemeraDB, exponentialBackoffWrapper } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../../internalCache'
import { buildCharacterRoomMembershipTransactItems } from '../membership/characterRoomMembershipTransactItems'
import { buildObjectPlacementTransactItems } from '../membership/objectPlacementTransactItems'
import {
    addCharacterToGraph,
    addObjectToGraph,
    graphCharacterIds,
    graphObjectIds,
    playPositionGraphToStoredTopology,
    removeCharacterFromGraph,
    removeObjectFromGraph,
} from '../membership/positionGraphMerge'
import type { MembershipDiff } from '../membership/types'
import { buildCharacterInventoryTransactItems } from './membership/characterInventoryTransactItems'
import type { CharacterInventoryDiff } from './membership/characterInventoryTransactItems'
import type { ApplyHostEffectsArgs, ApplyHostEffectsResult, HostEffect } from './types'

export type ApplyHostEffectsDependencies = {
    getPositionGraph?: (hostId: EphemeraMembershipHostId) => Promise<PlayPositionGraph>
    transactWrite?: typeof ephemeraDB.transactWrite
}

const defaultGetPositionGraph = async (hostId: EphemeraMembershipHostId): Promise<PlayPositionGraph> =>
    internalCache.Positions.getPositionGraph(hostId)

const affectedHostIds = (hostEffects: HostEffect[]): EphemeraMembershipHostId[] =>
    [...new Set(hostEffects.map((effect) => effect.hostId))]

const validateHostEffects = (
    hostEffects: HostEffect[],
    graphsByHost: Map<EphemeraMembershipHostId, EphemeraPositionGraphFieldPayload>
): { ok: true } | { ok: false; errorCode: string; errorMessage: string } => {
    for (const effect of hostEffects) {
        const graph = graphsByHost.get(effect.hostId)
        if (!graph) {
            return {
                ok: false,
                errorCode: 'HOST_EFFECT_VALIDATION_FAILED',
                errorMessage: `Missing graph for host ${effect.hostId}`,
            }
        }

        if (isEphemeraRoomId(effect.hostId)) {
            if (effect.op === 'remove') {
                const present = effect.identityId.startsWith('CHARACTER#')
                    ? graphCharacterIds(graph).has(effect.identityId as EphemeraCharacterId)
                    : graphObjectIds(graph).has(effect.identityId as EphemeraObjectId)
                if (!present) {
                    return {
                        ok: false,
                        errorCode: 'HOST_EFFECT_VALIDATION_FAILED',
                        errorMessage: `Cannot remove ${effect.identityId} from ${effect.hostId}: not present`,
                    }
                }
            }
            else {
                const present = effect.identityId.startsWith('CHARACTER#')
                    ? graphCharacterIds(graph).has(effect.identityId as EphemeraCharacterId)
                    : graphObjectIds(graph).has(effect.identityId as EphemeraObjectId)
                if (present) {
                    return {
                        ok: false,
                        errorCode: 'HOST_EFFECT_VALIDATION_FAILED',
                        errorMessage: `Cannot add ${effect.identityId} to ${effect.hostId}: already present`,
                    }
                }
            }
        }
        else if (isEphemeraCharacterId(effect.hostId)) {
            if (effect.op === 'remove') {
                if (!graphObjectIds(graph).has(effect.identityId as EphemeraObjectId)) {
                    return {
                        ok: false,
                        errorCode: 'HOST_EFFECT_VALIDATION_FAILED',
                        errorMessage: `Cannot remove ${effect.identityId} from ${effect.hostId}: not present`,
                    }
                }
            }
            else if (graphObjectIds(graph).has(effect.identityId as EphemeraObjectId)) {
                return {
                    ok: false,
                    errorCode: 'HOST_EFFECT_VALIDATION_FAILED',
                    errorMessage: `Cannot add ${effect.identityId} to ${effect.hostId}: already present`,
                }
            }
        }
    }

    return { ok: true }
}

const roomMembershipDiffFromEffects = (
    characterId: EphemeraCharacterId,
    effects: HostEffect[]
): MembershipDiff => {
    const froms: EphemeraRoomId[] = []
    let to: EphemeraRoomId | null = null

    for (const effect of effects) {
        if (!isEphemeraRoomId(effect.hostId) || effect.identityId !== characterId) {
            continue
        }
        if (effect.op === 'remove') {
            froms.push(effect.hostId)
        }
        else {
            to = effect.hostId
        }
    }

    return {
        froms,
        to,
        changed: froms.length > 0 || to !== null,
    }
}

const objectRoomMembershipDiffFromEffects = (
    objectId: EphemeraObjectId,
    effects: HostEffect[]
): MembershipDiff => {
    const froms: EphemeraRoomId[] = []
    let to: EphemeraRoomId | null = null

    for (const effect of effects) {
        if (!isEphemeraRoomId(effect.hostId) || effect.identityId !== objectId) {
            continue
        }
        if (effect.op === 'remove') {
            froms.push(effect.hostId)
        }
        else {
            to = effect.hostId
        }
    }

    return {
        froms,
        to,
        changed: froms.length > 0 || to !== null,
    }
}

const characterInventoryDiffFromEffects = (
    objectId: EphemeraObjectId,
    effects: HostEffect[]
): CharacterInventoryDiff => {
    const froms: EphemeraCharacterId[] = []
    let to: EphemeraCharacterId | null = null

    for (const effect of effects) {
        if (!isEphemeraCharacterId(effect.hostId) || effect.identityId !== objectId) {
            continue
        }
        if (effect.op === 'remove') {
            froms.push(effect.hostId)
        }
        else {
            to = effect.hostId
        }
    }

    return {
        froms,
        to,
        changed: froms.length > 0 || to !== null,
    }
}

const buildTransactItemsFromHostEffects = (
    hostEffects: HostEffect[]
) => {
    const transactItems: Parameters<typeof ephemeraDB.transactWrite>[0] = []

    const characterRoomEffects = new Map<EphemeraCharacterId, HostEffect[]>()
    const objectRoomEffects = new Map<EphemeraObjectId, HostEffect[]>()
    const objectCharacterEffects = new Map<EphemeraObjectId, HostEffect[]>()

    for (const effect of hostEffects) {
        if (isEphemeraRoomId(effect.hostId)) {
            if (effect.identityId.startsWith('CHARACTER#')) {
                const characterId = effect.identityId as EphemeraCharacterId
                const bucket = characterRoomEffects.get(characterId) ?? []
                bucket.push(effect)
                characterRoomEffects.set(characterId, bucket)
            }
            else {
                const objectId = effect.identityId as EphemeraObjectId
                const bucket = objectRoomEffects.get(objectId) ?? []
                bucket.push(effect)
                objectRoomEffects.set(objectId, bucket)
            }
        }
        else if (isEphemeraCharacterId(effect.hostId)) {
            const objectId = effect.identityId as EphemeraObjectId
            const bucket = objectCharacterEffects.get(objectId) ?? []
            bucket.push(effect)
            objectCharacterEffects.set(objectId, bucket)
        }
    }

    for (const [characterId, effects] of characterRoomEffects) {
        transactItems.push(
            ...buildCharacterRoomMembershipTransactItems({
                characterId,
                diff: roomMembershipDiffFromEffects(characterId, effects),
            })
        )
    }

    for (const [objectId, effects] of objectRoomEffects) {
        transactItems.push(
            ...buildObjectPlacementTransactItems({
                objectId,
                diff: objectRoomMembershipDiffFromEffects(objectId, effects),
            })
        )
    }

    for (const [objectId, effects] of objectCharacterEffects) {
        transactItems.push(
            ...buildCharacterInventoryTransactItems({
                objectId,
                diff: characterInventoryDiffFromEffects(objectId, effects),
            })
        )
    }

    return transactItems
}

const applyEffectToGraph = (
    graph: EphemeraPositionGraphFieldPayload,
    effect: HostEffect
): EphemeraPositionGraphFieldPayload => {
    if (isEphemeraRoomId(effect.hostId)) {
        if (effect.identityId.startsWith('CHARACTER#')) {
            return effect.op === 'remove'
                ? removeCharacterFromGraph(graph, effect.identityId as EphemeraCharacterId)
                : addCharacterToGraph(graph, effect.identityId as EphemeraCharacterId)
        }
        return effect.op === 'remove'
            ? removeObjectFromGraph(graph, effect.identityId as EphemeraObjectId)
            : addObjectToGraph(graph, effect.identityId as EphemeraObjectId)
    }

    return effect.op === 'remove'
        ? removeObjectFromGraph(graph, effect.identityId as EphemeraObjectId)
        : addObjectToGraph(graph, effect.identityId as EphemeraObjectId)
}

const computePostApplyGraphsFromEffects = (
    hostEffects: HostEffect[],
    graphsByHost: Map<EphemeraMembershipHostId, EphemeraPositionGraphFieldPayload>
): Partial<Record<EphemeraMembershipHostId, EphemeraPositionGraphFieldPayload>> => {
    const workingGraphs = new Map<EphemeraMembershipHostId, EphemeraPositionGraphFieldPayload>()

    for (const effect of hostEffects) {
        const prior = workingGraphs.get(effect.hostId) ?? graphsByHost.get(effect.hostId)
        if (!prior) {
            continue
        }
        workingGraphs.set(effect.hostId, applyEffectToGraph(prior, effect))
    }

    return Object.fromEntries(workingGraphs) as Partial<Record<EphemeraMembershipHostId, EphemeraPositionGraphFieldPayload>>
}

export const applyHostEffects = async (
    args: ApplyHostEffectsArgs,
    deps?: ApplyHostEffectsDependencies
): Promise<ApplyHostEffectsResult> => {
    const { hostEffects } = args

    if (hostEffects.length === 0) {
        return { ok: true, persisted: false, changed: false }
    }

    const getPositionGraph = deps?.getPositionGraph ?? defaultGetPositionGraph
    const transactWrite = deps?.transactWrite ?? ephemeraDB.transactWrite.bind(ephemeraDB)

    const hostIds = affectedHostIds(hostEffects)
    const graphsByHost = new Map<EphemeraMembershipHostId, EphemeraPositionGraphFieldPayload>()

    await Promise.all(
        hostIds.map(async (hostId) => {
            const graph = playPositionGraphToStoredTopology(await getPositionGraph(hostId))
            graphsByHost.set(hostId, graph)
        })
    )

    const validation = validateHostEffects(hostEffects, graphsByHost)
    if (!validation.ok) {
        return validation
    }

    const postApplyGraphs = computePostApplyGraphsFromEffects(hostEffects, graphsByHost)

    try {
        let persisted = false
        await exponentialBackoffWrapper(async () => {
            const transactItems = buildTransactItemsFromHostEffects(hostEffects)
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
            errorCode: 'HOST_EFFECTS_TRANSACT_FAILED',
            errorMessage: message,
        }
    }
}

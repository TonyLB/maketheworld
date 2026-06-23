import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { projectComponentGraphFromStoredPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { CoyoteTropeAffinity } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { isEphemeraMetaObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'
import { ephemeraDB, exponentialBackoffWrapper } from '@tonylb/mtw-utilities/ts/dynamoDB'

import getCurrentTimestamp from '../../internalUtils/dateUtil'
import internalCache from '../../internalCache'
import type { MessageBus } from '../../messageBus/baseClasses'
import { buildObjectMovedFact } from '../positions/membership/buildObjectMovedFact'
import { buildObjectPlacementTransactItems } from '../positions/membership/objectPlacementTransactItems'
import { computePostApplyObjectRoomGraphs } from '../positions/membership/updateObjectPositionGraphs'
import { streamObjectMembershipFact } from '../positions/membership/streamObjectMembershipFact'
import type { PositionsPublishedPayload } from '../positions/publishedEvents'
import {
    improvisationPairPutItem,
    metaObjectPutItem,
} from './persistImprovisationObject'
import { invalidateImprovisationObjectCaches } from './invalidateImprovisationObjectCaches'

export type SpawnAndPlaceImprovisationObjectArgs = {
    objectId: EphemeraObjectId;
    shortName: string;
    stableKey: string;
    targetRoomId: EphemeraRoomId;
    tropeAffinities?: CoyoteTropeAffinity[];
    tropeAffinitiesFailed?: boolean;
}

export type SpawnAndPlaceImprovisationObjectDependencies = {
    transactWrite?: typeof ephemeraDB.transactWrite;
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
    getRoomPositionGraph?: (roomId: EphemeraRoomId) => ReturnType<typeof internalCache.Positions.getPositionGraph>;
}

/**
 * Atomically create improvisation pair + Meta::Object rows and place the object in a room graph.
 */
export const spawnAndPlaceImprovisationObject = async (
    args: SpawnAndPlaceImprovisationObjectArgs,
    deps: SpawnAndPlaceImprovisationObjectDependencies
): Promise<{ ok: true; objectId: EphemeraObjectId } | { ok: false; errorMessage: string }> => {
    const transactWrite = deps.transactWrite ?? ephemeraDB.transactWrite.bind(ephemeraDB)
    const getRoomPositionGraph = deps.getRoomPositionGraph
        ?? ((roomId: EphemeraRoomId) => internalCache.Positions.getPositionGraph(roomId))

    const metaPut = metaObjectPutItem({
        objectId: args.objectId,
        stableKey: args.stableKey,
        tropeAffinities: args.tropeAffinities,
        tropeAffinitiesFailed: args.tropeAffinitiesFailed,
    })
    const metaRow = metaPut.Put

    if (!isEphemeraMetaObject(metaRow)) {
        return { ok: false, errorMessage: `Invalid Meta::Object payload for ${args.objectId}` }
    }

    const diff = {
        froms: [] as EphemeraRoomId[],
        to: args.targetRoomId,
        changed: true,
    }

    try {
        await exponentialBackoffWrapper(async () => {
            await transactWrite([
                improvisationPairPutItem(args.objectId, args.shortName),
                metaPut,
                ...buildObjectPlacementTransactItems({
                    objectId: args.objectId,
                    diff,
                }),
            ])
        }, { retryErrors: ['TransactionCanceledException'] })

        const component = new StandardObject({
            tag: 'Object',
            universalKey: args.objectId,
            shortName: args.shortName,
        })

        const postApplyRoomGraphs = await computePostApplyObjectRoomGraphs(
            args.objectId,
            diff,
            getRoomPositionGraph
        )

        invalidateImprovisationObjectCaches({
            objectId: args.objectId,
            affectedRoomIds: [args.targetRoomId],
            pairComponent: component,
            metaRow,
        })

        const storedGraph = postApplyRoomGraphs[args.targetRoomId]
        if (storedGraph) {
            internalCache.Positions.set({
                componentId: args.targetRoomId,
                graph: projectComponentGraphFromStoredPositionGraph(storedGraph),
            })
        }
        internalCache.Positions.setMembershipContainers({
            componentId: args.objectId,
            containers: [args.targetRoomId],
        })

        const beatAnchorTime = getCurrentTimestamp()
        const fact = buildObjectMovedFact({
            objectId: args.objectId,
            diff,
            beatAnchorTime,
        })
        if (fact) {
            await streamObjectMembershipFact(fact, { streamEvent: deps.streamEvent })
        }

        deps.messageBus.publish({
            type: 'RoomUpdate',
            roomId: args.targetRoomId,
        })

        return { ok: true, objectId: args.objectId }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { ok: false, errorMessage: message }
    }
}

import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'

import type { MessageBus } from '../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../positions/publishedEvents'
import {
    spawnAndPlaceImprovisationObject,
    type SpawnAndPlaceImprovisationObjectArgs,
} from './spawnAndPlaceImprovisationObject'

export type ApplyObjectsAddFailure = {
    objectId: EphemeraObjectId;
    stableKey: string;
    errorMessage: string;
}

export type SpawnImprovisationObjectsBatchResult = {
    createdIds: EphemeraObjectId[];
    addFailures: ApplyObjectsAddFailure[];
}

export type SpawnImprovisationObjectsBatchDependencies = {
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
    spawnAndPlaceImpl?: typeof spawnAndPlaceImprovisationObject;
}

/**
 * Per-object batch isolation (S3): continue on failure; collect createdIds and addFailures.
 */
export const spawnImprovisationObjectsBatch = async (
    rows: SpawnAndPlaceImprovisationObjectArgs[],
    deps: SpawnImprovisationObjectsBatchDependencies
): Promise<SpawnImprovisationObjectsBatchResult> => {
    const spawnAndPlace = deps.spawnAndPlaceImpl ?? spawnAndPlaceImprovisationObject

    const outcomes = await Promise.all(
        rows.map(async (row) => {
            const spawnResult = await spawnAndPlace(row, {
                messageBus: deps.messageBus,
                streamEvent: deps.streamEvent,
            })
            return { row, spawnResult }
        })
    )

    return outcomes.reduce<SpawnImprovisationObjectsBatchResult>(
        (acc, { row, spawnResult }) => {
            if (!spawnResult.ok) {
                return {
                    ...acc,
                    addFailures: [...acc.addFailures, {
                        objectId: row.objectId,
                        stableKey: row.stableKey,
                        errorMessage: spawnResult.errorMessage,
                    }],
                }
            }
            return {
                ...acc,
                createdIds: [...acc.createdIds, spawnResult.objectId],
            }
        },
        { createdIds: [], addFailures: [] }
    )
}

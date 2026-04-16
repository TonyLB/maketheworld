import { v4 as uuidv4 } from 'uuid'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { MessageBus } from '../../messageBus/baseClasses'
import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isAwaitRoadRunnerPublishedPayload } from '../actions/publishedEvents'
import getCurrentTimestamp from '../../internalUtils/dateUtil'
import internalCache from '../../internalCache'
import type { CoyoteGamePublishedPayload } from './publishedEvents'
import { collectActiveCharactersInCoyoteRooms } from './collectActiveCharactersInCoyoteRooms'

/**
 * On Await RoadRunner from actions, broadcast plan-outcome WorldMessages to all active characters
 * in Coyote demo rooms (shared messageId), with stream events keyed by the triggering character.
 */
export async function handleAwaitRoadRunnerForPlanOutcome(
    raw: unknown,
    deps: {
        streamEvent: StreamEventFunction<CoyoteGamePublishedPayload, StreamingEventHeader>;
        messageBus: Pick<MessageBus, 'send' | 'flush'>;
    }
): Promise<void> {
    if (!isAwaitRoadRunnerPublishedPayload(raw)) {
        return
    }
    const trigger = raw.characterId

    const targets = await collectActiveCharactersInCoyoteRooms()
    if (targets.length === 0) {
        return
    }

    const characterId: EphemeraCharacterId = trigger
    const outcomeId = `MESSAGE#${uuidv4()}`
    const t0 = getCurrentTimestamp()
    const stored = { outcomeId, t0 }

    const outcomeLaneId = `outcomeLane:${outcomeId}`

    deps.messageBus.send(
        {
            type: 'PublishMessage',
            targets,
            displayProtocol: 'WorldMessage',
            message: ['Outcome: Generating...'],
            messageId: stored.outcomeId,
            createdTime: stored.t0,
        },
        outcomeLaneId
    )

    const remainder = async (): Promise<void> => {
        await deps.streamEvent({
            streamKey: characterId,
            header: { type: 'Plan Outcome Generation Started' },
            update: {
                type: 'Plan Outcome Generation Started',
                outcomeId,
                characterId,
            },
        })

        await internalCache.CoyoteGame.invalidate('outcome')
        const renderTree = await internalCache.CoyoteGame.get('outcome')

        const t1 = Math.max(stored.t0 + 1, getCurrentTimestamp())

        await deps.streamEvent({
            streamKey: characterId,
            header: { type: 'Plan Outcome Generation Result' },
            update: {
                type: 'Plan Outcome Generation Result',
                outcomeId,
                characterId,
                renderTree,
            },
        })

        deps.messageBus.send({
            type: 'PublishMessage',
            targets,
            displayProtocol: 'WorldMessage',
            message: renderTree,
            messageId: stored.outcomeId,
            createdTime: t1,
        })
    }

    await Promise.all([deps.messageBus.flush(outcomeLaneId), remainder()])
}

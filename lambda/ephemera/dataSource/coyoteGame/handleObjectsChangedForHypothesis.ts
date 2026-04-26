import { v4 as uuidv4 } from 'uuid'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import type { MessageBus } from '../../messageBus/baseClasses'
import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isObjectsChangedPayload } from '../objects/events'
import getCurrentTimestamp from '../../internalUtils/dateUtil'
import internalCache from '../../internalCache'
import type { CoyoteGamePublishedPayload } from './publishedEvents'
import { COYOTE_RENDER_LINE_BREAK } from './coyoteRenderTree'
import { isCoyoteGameRoom } from './isCoyoteGameRoom'

const SCENE_ANALYSIS_HEADING = /^\s*##\s+Scene analysis\s*$/im

const userFacingWalkthrough = (walkthrough: string | undefined): string | undefined => {
    if (!walkthrough || walkthrough.trim().length === 0) {
        return undefined
    }
    if (SCENE_ANALYSIS_HEADING.test(walkthrough)) {
        return undefined
    }
    return walkthrough
}

/**
 * When objects are added in a Coyote demo room, emit hypothesis stream events and
 * WorldMessage placeholder + terminal rows (shared messageId) for connected occupants.
 */
export async function handleObjectsChangedForHypothesis(
    raw: unknown,
    deps: {
        streamEvent: StreamEventFunction<CoyoteGamePublishedPayload, StreamingEventHeader>;
        messageBus: Pick<MessageBus, 'send' | 'flush'>;
    }
): Promise<void> {
    if (!isObjectsChangedPayload(raw)) {
        return
    }
    const payload = raw
    if (payload.add.length === 0) {
        return
    }
    if (!(await isCoyoteGameRoom(payload.componentId))) {
        return
    }

    const occupants = await internalCache.RoomCharacterList.get(payload.componentId)
    /** Characters with at least one session are treated as active for delivery. */
    const active = (occupants ?? []).filter((o) => o.SessionIds.length > 0)
    if (active.length === 0) {
        return
    }

    const characterId: EphemeraCharacterId = active[0].EphemeraId
    const hypothesisId = `MESSAGE#${uuidv4()}`
    const t0 = getCurrentTimestamp()
    const stored = { hypothesisId, t0 }

    const targets = active.map((o) => o.EphemeraId)

    /** Drain this lane so the Generating WorldMessage runs through publishMessage while hypothesis work proceeds. */
    const hypothesisLaneId = `hypothesisLane:${hypothesisId}`

    deps.messageBus.send(
        {
            type: 'PublishMessage',
            targets,
            displayProtocol: 'CoyoteGameHypothesisMessage',
            message: ['Hypothesis: Generating...'],
            messageId: stored.hypothesisId,
            createdTime: stored.t0,
        },
        hypothesisLaneId
    )

    const remainder = async (): Promise<void> => {
        await deps.streamEvent({
            streamKey: payload.componentId,
            header: { type: 'Hypothesis Generation Started' },
            update: {
                type: 'Hypothesis Generation Started',
                hypothesisId,
                characterId,
            },
        })

        await internalCache.CoyoteGame.invalidate('intent')
        const intentRecord = await internalCache.CoyoteGame.get('intent')
        // NOTE: intentRecord.walkthrough currently maps hop-2 Scene Analysis prose.
        // That has drifted from the original "golden-path walkthrough" meaning.
        // We filter Scene Analysis from terminal publish for now; semantic realignment is deferred.
        const walkthrough = userFacingWalkthrough(intentRecord.walkthrough)
        const renderTree: RenderTree =
            walkthrough !== undefined
                ? [walkthrough, COYOTE_RENDER_LINE_BREAK, intentRecord.intent]
                : [intentRecord.intent]

        const t1 = Math.max(stored.t0 + 1, getCurrentTimestamp())

        await deps.streamEvent({
            streamKey: payload.componentId,
            header: { type: 'Hypothesis Generation Result' },
            update: {
                type: 'Hypothesis Generation Result',
                hypothesisId,
                characterId,
                renderTree,
            },
        })

        deps.messageBus.send({
            type: 'PublishMessage',
            targets,
            displayProtocol: 'CoyoteGameHypothesisMessage',
            message: renderTree,
            messageId: stored.hypothesisId,
            createdTime: t1,
        })
    }

    await Promise.all([deps.messageBus.flush(hypothesisLaneId), remainder()])
}

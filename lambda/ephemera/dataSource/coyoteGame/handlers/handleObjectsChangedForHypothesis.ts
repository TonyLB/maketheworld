import { v4 as uuidv4 } from 'uuid'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import type { MessageBus } from '../../../messageBus/baseClasses'
import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isObjectsChangedPayload } from '../../objects/events'
import getCurrentTimestamp from '../../../internalUtils/dateUtil'
import internalCache from '../../../internalCache'
import type { CoyoteGamePublishedPayload } from '../publishedEvents'
import { COYOTE_RENDER_LINE_BREAK } from '../utilities/coyoteRenderTree'
import { isCoyoteGameRoom } from '../utilities/isCoyoteGameRoom'
import { hypothesisDebugLog } from '../utilities/hypothesisDebug'

/** Hop-2 internal walkthrough heading: strip from terminal publish (canonical only; Dynamo load normalizes legacy Scene analysis). */
const INTERNAL_WALKTHROUGH_HEADING = /^\s*##\s+Cartoon play-by-play\s*$/im

const userFacingWalkthrough = (walkthrough: string | undefined): string | undefined => {
    if (!walkthrough || walkthrough.trim().length === 0) {
        return undefined
    }
    if (INTERNAL_WALKTHROUGH_HEADING.test(walkthrough)) {
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
        messageBus: Pick<MessageBus, 'publish'>;
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

    hypothesisDebugLog('objects changed hypothesis trigger', {
        componentId: payload.componentId,
        addCount: payload.add.length,
        activeTargetsCount: targets.length,
        hypothesisId,
    })

    deps.messageBus.publish({
        type: 'PublishMessage',
        targets,
        displayProtocol: 'CoyoteGameHypothesisMessage',
        message: ['Hypothesis: Generating...'],
        messageId: stored.hypothesisId,
        createdTime: stored.t0,
    })

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
    // NOTE: intentRecord.walkthrough maps hop-2 internal prose (## Cartoon play-by-play).
    // We filter those headings from terminal publish for now; semantic realignment is deferred.
    const walkthrough = userFacingWalkthrough(intentRecord.walkthrough)
    const renderTree: RenderTree =
        walkthrough !== undefined
            ? [walkthrough, COYOTE_RENDER_LINE_BREAK, intentRecord.intent]
            : [intentRecord.intent]
    hypothesisDebugLog('objects changed hypothesis final intent', {
        hypothesisId,
        intent: intentRecord.intent,
        hadStoredWalkthrough: intentRecord.walkthrough !== undefined,
        includedWalkthrough: walkthrough !== undefined,
        walkthroughFiltered: intentRecord.walkthrough !== undefined && walkthrough === undefined,
        hasNarrativeBeatsStructured: intentRecord.narrativeBeatsStructured !== undefined,
    })

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

    deps.messageBus.publish({
        type: 'PublishMessage',
        targets,
        displayProtocol: 'CoyoteGameHypothesisMessage',
        message: renderTree,
        messageId: stored.hypothesisId,
        createdTime: t1,
    })
}

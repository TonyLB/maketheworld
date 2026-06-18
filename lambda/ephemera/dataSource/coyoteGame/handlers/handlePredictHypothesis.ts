import { v4 as uuidv4 } from 'uuid'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import type { MessageBus } from '../../../messageBus/baseClasses'
import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isPredictHypothesisPublishedPayload } from '../../actions/publishedEvents'
import getCurrentTimestamp from '../../../internalUtils/dateUtil'
import internalCache from '../../../internalCache'
import type { CoyoteGamePublishedPayload } from '../publishedEvents'
import { COYOTE_RENDER_LINE_BREAK } from '../utilities/coyoteRenderTree'
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
 * On explicit Predict Hypothesis from actions, emit hypothesis stream events and
 * CoyoteGameHypothesisMessage placeholder + terminal rows (shared messageId) to the requester only.
 */
export async function handlePredictHypothesis(
    raw: unknown,
    deps: {
        streamEvent: StreamEventFunction<CoyoteGamePublishedPayload, StreamingEventHeader>;
        messageBus: Pick<MessageBus, 'publish'>;
    }
): Promise<void> {
    if (!isPredictHypothesisPublishedPayload(raw)) {
        return
    }
    const payload = raw
    const characterId: EphemeraCharacterId = payload.characterId
    const targets = [characterId]
    const hypothesisId = `MESSAGE#${uuidv4()}`
    const t0 = getCurrentTimestamp()
    const stored = { hypothesisId, t0 }

    hypothesisDebugLog('predict hypothesis trigger', {
        characterId,
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
        streamKey: characterId,
        header: { type: 'Hypothesis Generation Started' },
        update: {
            type: 'Hypothesis Generation Started',
            hypothesisId,
            characterId,
        },
    })

    await internalCache.CoyoteGame.invalidate('intent')
    const intentRecord = await internalCache.CoyoteGame.get('intent')
    const walkthrough = userFacingWalkthrough(intentRecord.walkthrough)
    const renderTree: RenderTree =
        walkthrough !== undefined
            ? [walkthrough, COYOTE_RENDER_LINE_BREAK, intentRecord.intent]
            : [intentRecord.intent]
    hypothesisDebugLog('predict hypothesis final intent', {
        hypothesisId,
        intent: intentRecord.intent,
        hadStoredWalkthrough: intentRecord.walkthrough !== undefined,
        includedWalkthrough: walkthrough !== undefined,
        walkthroughFiltered: intentRecord.walkthrough !== undefined && walkthrough === undefined,
        hasNarrativeBeatsStructured: intentRecord.narrativeBeatsStructured !== undefined,
    })

    const t1 = Math.max(stored.t0 + 1, getCurrentTimestamp())

    await deps.streamEvent({
        streamKey: characterId,
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

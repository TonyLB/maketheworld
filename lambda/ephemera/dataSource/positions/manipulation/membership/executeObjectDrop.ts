import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import internalCache from '../../../../internalCache'
import {
    actingCharacterRef,
    currentHostRef,
    objectSpanRef,
} from '../../../actions/enrich/objectManipulation/plan/ungroundedPrimitive'
import type { GroundingContext } from '../../../actions/enrich/objectManipulation/synthesize/groundReferent'
import { createExpansionEnvironment } from '../../../actions/enrich/objectManipulation/synthesize/expansionEnvironment'
import { runExecutor, seedTransferMembership } from '../../../actions/enrich/objectManipulation/synthesize/executor'
import { fromExecutorStep } from '../kernel/kernelStep'
import { commitStepSequence } from '../kernel/commitStepSequence'
import type { EphemeraPositionGraph } from '../../positionGraph'

export type ExecuteObjectDropArgs = {
    characterId: EphemeraCharacterId;
    objectIds: EphemeraObjectId[];
    roomId: EphemeraRoomId;
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
}

/**
 * Single call site for every drop command, regardless of transfer-set size
 * (Migrate slice, 2026-07-23) --- mirrors `executeObjectTakeHold.ts`'s
 * character -> room direction. Supersedes `applyObjectSetDrop.ts`/
 * `applyObjectSetTransfer.ts`, which are retired.
 */
export const executeObjectDrop = async (args: ExecuteObjectDropArgs): Promise<void> => {
    const [primaryObjectId] = args.objectIds
    if (primaryObjectId === undefined) {
        return
    }

    const stableRefKey = 'executeObjectDrop/object'
    const groundingContext: GroundingContext = {
        actingCharacterId: args.characterId,
        resolvedSpans: new Map([[stableRefKey, { verdict: 'resolved', candidateIds: [primaryObjectId] }]]),
        getCurrentHost: (componentId) => (componentId === args.characterId ? args.roomId : undefined),
    }
    const seed = seedTransferMembership({
        kind: 'change',
        primitive: 'transferMembership',
        object: objectSpanRef('object', stableRefKey),
        from: actingCharacterRef,
        to: currentHostRef(actingCharacterRef),
    })

    const roomGraph = await internalCache.Positions.getPositionGraph(args.roomId)
    const characterGraph = await internalCache.Positions.getPositionGraph(args.characterId)
    const graphsByHost = new Map<string, EphemeraPositionGraph>([
        [args.roomId, roomGraph],
        [args.characterId, characterGraph],
    ])
    const env = createExpansionEnvironment(
        (hostId) => graphsByHost.get(hostId),
        () => args.characterId
    )

    const outcome = runExecutor(seed, env, groundingContext)
    if (outcome.verdict !== 'legal') {
        return
    }

    await commitStepSequence(
        { steps: outcome.steps.map(fromExecutorStep) },
        {
            messageBus: args.messageBus,
            streamEvent: args.streamEvent,
            getCurrentHost: () => args.characterId,
        }
    )
}

/**
 * `mtw.ephemera.positions` DataSource
 *
 * General-purpose ephemera lane for **positions in play** -- the home for any
 * "where is X right now" projection ephemera owns. Membership authority is
 * `Meta::Room.ludicGraph` + adjacency index (S2-6).
 *
 * External ingress: `mtw.connections.characters` (presence), `mtw.ephemera.actions`
 * (`Character Navigate`, `Character Home`, `Object Take Hold`, `Object Drop`,
 * `Object Establish Relation`, `Object Dissolve Relation`), `mtw.diagnostics` (`Room Occupancy Drift Finding`,
 * `Ludic Graph Stale Structure Finding`). Additional
 * position-affecting subscriptions can be added here without inventing another one-off
 * DataSource module.
 *
 * Future iterations may extend the lane with new entity kinds and richer
 * position semantics; the wiring above (`dataSourceKey: 'mtw.ephemera.positions'`,
 * folder layout, guard registry in `subscribedEvents.ts`) is intentionally
 * named generally so that growth is additive.
 */
import EphemeraDataSource from '../abstract'
import internalCache from '../../internalCache'
import messageBus from '../../messageBus'
import {
    ConnectionsCharactersConnectedEvent,
    ConnectionsCharactersDisconnectedEvent,
    ConnectionsCharactersEventUpdate
} from '@tonylb/mtw-interfaces/ts/eventBridge/connections/characters'
import type { CharacterHomePublishedPayload, CharacterNavigatePublishedPayload } from '../actions/publishedEvents'
import { isCharacterHomePublishedPayload, isObjectDissolveRelationPublishedPayload, isObjectDropPublishedPayload, isObjectEstablishRelationPublishedPayload, isObjectRehostPublishedPayload, isObjectTakeHoldPublishedPayload } from '../actions/publishedEvents'
import {
    isEphemeraPositionsActionsCharacterHomeEnvelope,
    isEphemeraPositionsActionsCharacterNavigateEnvelope,
    isEphemeraPositionsActionsObjectDissolveRelationEnvelope,
    isEphemeraPositionsActionsObjectDropEnvelope,
    isEphemeraPositionsActionsObjectEstablishRelationEnvelope,
    isEphemeraPositionsActionsObjectRehostEnvelope,
    isEphemeraPositionsActionsObjectTakeHoldEnvelope,
    isEphemeraPositionsConnectionsCharactersEnvelope,
    isEphemeraPositionsDiagnosticsLudicGraphStaleStructureFindingEnvelope,
    isEphemeraPositionsDiagnosticsLudicGraphPortMismatchFindingEnvelope,
    isEphemeraPositionsDiagnosticsRoomOccupancyDriftFindingEnvelope,
    isEphemeraPositionsSubscribedEnvelope,
    type EphemeraPositionsSubscribedContent
} from './subscribedEvents'
import {
    handleCharacterConnected,
    handleCharacterDisconnected
} from './handleConnectionsCharactersPresence'
import { executeCharacterNavigate } from './navigate/executeCharacterNavigate'
import { orchestrateObjectMove } from './manipulation/membership/orchestrateObjectMove'
import { executeEstablishEdgeChain } from './manipulation/relational/executeObjectEstablishRelation'
import { repairRoomOccupancyDrift } from './membership/repairRoomOccupancyDrift'
import { healLudicGraphStructure } from './ludicGraph/healLudicGraphStructure'
import { healLudicGraphPortMismatch } from './ludicGraph/healLudicGraphPortMismatch'
import type { PositionsPublishedPayload } from './publishedEvents'

export const ephemeraPositionsDataSource = new EphemeraDataSource<
    never,
    PositionsPublishedPayload,
    EphemeraPositionsSubscribedContent
>({
    dataSourceKey: 'mtw.ephemera.positions',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isEphemeraPositionsSubscribedEnvelope,
    receiveEvents: async ({ events, streamEvent }) => {
        await Promise.all(events.map(async (envelope) => {
            if (isEphemeraPositionsDiagnosticsRoomOccupancyDriftFindingEnvelope(envelope)) {
                const content = await envelope.getContent()
                if (!content?.roomId) {
                    return
                }
                await repairRoomOccupancyDrift({
                    roomId: content.roomId,
                    messageBus,
                    streamEvent,
                })
                return
            }
            if (isEphemeraPositionsDiagnosticsLudicGraphStaleStructureFindingEnvelope(envelope)) {
                const content = await envelope.getContent()
                if (!content?.ephemeraId) {
                    return
                }
                await healLudicGraphStructure(content.ephemeraId, { dryRun: false })
                return
            }
            if (isEphemeraPositionsDiagnosticsLudicGraphPortMismatchFindingEnvelope(envelope)) {
                const content = await envelope.getContent()
                if (!content?.ephemeraId || !content?.portId) {
                    return
                }
                await healLudicGraphPortMismatch(content.ephemeraId, content.portId, { dryRun: false })
                return
            }
            if (isEphemeraPositionsActionsObjectDropEnvelope(envelope)) {
                const content = await envelope.getContent()
                if (!content || !isObjectDropPublishedPayload(content)) {
                    return
                }
                await orchestrateObjectMove({
                    objectIds: content.objectIds,
                    fromHostId: content.characterId,
                    toHostId: content.roomId,
                    roomId: content.roomId,
                    characterId: content.characterId,
                    messageBus,
                    streamEvent,
                })
                return
            }
            if (isEphemeraPositionsActionsObjectDissolveRelationEnvelope(envelope)) {
                const content = await envelope.getContent()
                if (!content || !isObjectDissolveRelationPublishedPayload(content)) {
                    return
                }
                // `executeEstablishEdgeChain` is operationKind-agnostic (it filters
                // `transferMembership` and treats every `establishRelation`/`dissolveRelation`/
                // `addCrossingPort`/`removeCrossingPort` step symmetrically), so it is the one
                // commit path for `Object Dissolve Relation` too, mirroring the establish branch
                // above --- the old single-host `executeObjectDissolveRelation` is retired.
                await executeEstablishEdgeChain({
                    steps: content.steps,
                    messageBus,
                    streamEvent,
                })
                return
            }
            if (isEphemeraPositionsActionsObjectEstablishRelationEnvelope(envelope)) {
                const content = await envelope.getContent()
                if (!content || !isObjectEstablishRelationPublishedPayload(content)) {
                    return
                }
                // `executeEstablishEdgeChain` subsumes the single-host case (a
                // portless/same-host candidate's `steps` is a one-entry array), so it is the
                // one commit path for every `Object Establish Relation` now, not just crossings.
                // Fire-and-forget, matching every other branch here --- `ok: false` is already
                // logged inside `executeEstablishEdgeChain`; surfacing it to the player is an
                // unresolved UX/copy question, not this row's job.
                await executeEstablishEdgeChain({
                    steps: content.steps,
                    messageBus,
                    streamEvent,
                })
                return
            }
            if (isEphemeraPositionsActionsObjectRehostEnvelope(envelope)) {
                const content = await envelope.getContent()
                if (!content || !isObjectRehostPublishedPayload(content)) {
                    return
                }
                // `fromHostId` is read fresh here, not published at parse time --- the
                // subject's current host can have changed between parse and this handler
                // running, and `orchestrateObjectMove` needs the real one to strip the right
                // containment edge. Zero or multiple current containers is a drift/race
                // condition this slice does not attempt to repair --- no-op rather than guess.
                const fromHostIds = await internalCache.Positions.getMembershipContainers(content.subjectId)
                if (fromHostIds.length !== 1) {
                    return
                }
                await orchestrateObjectMove({
                    objectIds: [content.subjectId],
                    fromHostId: fromHostIds[0],
                    toHostId: content.targetId,
                    roomId: content.roomId,
                    characterId: content.characterId,
                    containment: content.containment,
                    messageBus,
                    streamEvent,
                })
                return
            }
            if (isEphemeraPositionsActionsObjectTakeHoldEnvelope(envelope)) {
                const content = await envelope.getContent()
                if (!content || !isObjectTakeHoldPublishedPayload(content)) {
                    return
                }
                const [primaryObjectId] = content.objectIds
                if (primaryObjectId === undefined) {
                    return
                }
                // PV1-2 follow-up: `fromHostId` is read fresh here rather than trusted as
                // `content.roomId` --- a take-hold's object no longer has to sit directly in the
                // room now that objects can nest inside other objects (a cup left on a table).
                // Zero or multiple current containers is a drift/race condition this slice does
                // not attempt to repair --- no-op rather than guess, same as `Object Rehost`.
                const fromHostIds = await internalCache.Positions.getMembershipContainers(primaryObjectId)
                if (fromHostIds.length !== 1) {
                    return
                }
                await orchestrateObjectMove({
                    objectIds: content.objectIds,
                    fromHostId: fromHostIds[0],
                    toHostId: content.characterId,
                    roomId: content.roomId,
                    characterId: content.characterId,
                    messageBus,
                    streamEvent,
                })
                return
            }
            if (isEphemeraPositionsActionsCharacterNavigateEnvelope(envelope)) {
                const content = await envelope.getContent() as CharacterNavigatePublishedPayload
                if (!content || typeof content !== 'object') {
                    return
                }
                await executeCharacterNavigate({
                    characterId: content.characterId,
                    targetRoomId: content.toRoomId,
                    bundleId: content.bundleId,
                    intentKind: 'navigate',
                    intentFromRoomId: content.fromRoomId,
                    exitName: content.exitName,
                    messageBus,
                    streamEvent,
                })
                return
            }
            if (isEphemeraPositionsActionsCharacterHomeEnvelope(envelope)) {
                const content = await envelope.getContent() as CharacterHomePublishedPayload
                if (!content || !isCharacterHomePublishedPayload(content)) {
                    return
                }
                await executeCharacterNavigate({
                    characterId: content.characterId,
                    targetRoomId: content.toRoomId,
                    bundleId: content.bundleId,
                    intentKind: 'home',
                    intentFromRoomId: content.fromRoomId,
                    messageBus,
                    streamEvent,
                })
                return
            }
            if (!isEphemeraPositionsConnectionsCharactersEnvelope(envelope)) {
                return
            }
            const content = await envelope.getContent() as ConnectionsCharactersEventUpdate
            if (!content || typeof content !== 'object') {
                return
            }
            if (envelope.header.type === 'Character Connected') {
                await handleCharacterConnected(content as ConnectionsCharactersConnectedEvent, {
                    messageBus,
                    streamEvent,
                })
                return
            }
            if (envelope.header.type === 'Character Disconnected') {
                await handleCharacterDisconnected(content as ConnectionsCharactersDisconnectedEvent, {
                    messageBus,
                    streamEvent,
                })
                return
            }
        }))
    }
})

ephemeraPositionsDataSource.subscribe()

export default ephemeraPositionsDataSource

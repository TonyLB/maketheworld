/**
 * `mtw.ephemera.positions` DataSource
 *
 * General-purpose ephemera lane for **positions in play** -- the home for any
 * "where is X right now" projection ephemera owns. Membership authority is
 * `Meta::Room.ludicGraph` + adjacency index (S2-6).
 *
 * External ingress: `mtw.connections.characters` (presence), `mtw.ephemera.actions`
 * (`Character Navigate`, `Character Home`, `Ludic Network Change Requested` (AP-9: the
 * generalized hand-off for membership/relational attempts), `Object Containment`),
 * `mtw.diagnostics` (`Room Occupancy Drift Finding`, `Ludic Graph Stale Structure Finding`). Additional
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
import { isCharacterHomePublishedPayload, isLudicNetworkChangeRequestedPublishedPayload, isObjectContainmentPublishedPayload } from '../actions/publishedEvents'
import {
    isEphemeraPositionsActionsCharacterHomeEnvelope,
    isEphemeraPositionsActionsCharacterNavigateEnvelope,
    isEphemeraPositionsActionsLudicNetworkChangeRequestedEnvelope,
    isEphemeraPositionsActionsObjectContainmentEnvelope,
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
import { orchestrateCharacterMove } from './navigate/orchestrateCharacterMove'
import { orchestrateObjectMove } from './manipulation/membership/orchestrateObjectMove'
import { commitAttempt } from './manipulation/commitAttempt'
import { CommandAttempt, type CommandAttemptData } from '../actions/commandAttempt'
import { repairRoomOccupancyDrift } from './manipulation/membership/repairRoomOccupancyDrift'
import { healLudicGraphStructure } from './ludicGraph/healLudicGraphStructure'
import { healLudicGraphPortMismatch } from './ludicGraph/healLudicGraphPortMismatch'
import type { PositionsPublishedPayload } from './publishedEvents'

/**
 * The one bus-crossing reconstruction point for a published attempt, shared by every route
 * below. Reconstructs it (if any --- most routes today carry one only on the
 * object-manipulation families) and hands it to the commit-side orchestrator. It does not
 * adjudicate: Adjudicate runs actions-side, per candidate, and the attempt arrives with its
 * verdicts recorded. The commit side honors them (`orchestrateObjectMove` passes the met edges
 * on) and never judges.
 */
const reconstructAttempt = (data: CommandAttemptData | undefined): CommandAttempt | undefined =>
    data === undefined ? undefined : CommandAttempt.fromJSON(data)

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
            if (isEphemeraPositionsActionsLudicNetworkChangeRequestedEnvelope(envelope)) {
                const content = await envelope.getContent()
                if (!content || !isLudicNetworkChangeRequestedPublishedPayload(content)) {
                    return
                }
                // AP-9 (slice 3a): the generalized hand-off, replacing `Object Take Hold`/
                // `Object Drop`/`Object Establish Relation`/`Object Dissolve Relation` (retired
                // 3a-iv). `commitAttempt` dispatches per action and commits the whole attempt
                // as one sequence --- see its own doc comment. `Object Containment` still publishes
                // on its own until containment joins this event (slice 3c).
                await commitAttempt({
                    attempt: CommandAttempt.fromJSON(content.attempt),
                    characterId: content.characterId,
                    messageBus,
                    streamEvent,
                })
                return
            }
            if (isEphemeraPositionsActionsObjectContainmentEnvelope(envelope)) {
                const content = await envelope.getContent()
                if (!content || !isObjectContainmentPublishedPayload(content)) {
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
                    attempt: reconstructAttempt(content.attempt),
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
                await orchestrateCharacterMove({
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
                await orchestrateCharacterMove({
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

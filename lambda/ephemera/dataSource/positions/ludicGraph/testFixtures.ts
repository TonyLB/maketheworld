import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphFieldPayload, EphemeraLudicGraphStructureNode, EphemeraPresenceCover, EphemeraPresenceParentPointer } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { BASE_PRESENCE_ID, remainderCover } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'
import type { PlayLudicGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions/types'

import { EphemeraLudicGraph } from './index'

/**
 * Test helper: host-bound graph from field payload shape. `rootId` defaults to `hostId`
 * (a fresh test fixture's own root) but can be overridden for closure-shaped fixtures.
 */
export const testLudicGraph = (
    hostId: EphemeraMembershipHostId,
    payload: Partial<EphemeraLudicGraphFieldPayload> = {}
): EphemeraLudicGraph => EphemeraLudicGraph.fromFieldPayload(hostId, { nodes: [], rootId: hostId, ports: [], ...payload })

/** Test helper: host-bound graph from play read envelope (supports Exit edges). */
export const testLudicGraphFromEnvelope = (
    hostId: EphemeraMembershipHostId,
    envelope: PlayLudicGraph = { nodes: [] }
): EphemeraLudicGraph => EphemeraLudicGraph.fromPlayEnvelope(hostId, envelope)

/** Test convention: a parent host's root binding id, when a fixture names only the host. Every whole's is `PRESENCE#Base` (monotoneCovers MC-2). */
export const parentRemainderKey = (_host: EphemeraMembershipHostId): EphemeraPresenceNodeId => BASE_PRESENCE_ID

/**
 * Test helper: a presence binding. `parent` is a `{ host, presence }` pointer, a bare host (pointing
 * at that host's conventional remainder, `parentRemainderKey`), or `undefined` for a hostless remainder.
 * `name` mints the binding's own id unless a full `universalKey` is passed.
 */
export const presenceBindingNode = (
    name: string | EphemeraPresenceNodeId,
    parent?: EphemeraMembershipHostId | EphemeraPresenceParentPointer,
    cover: EphemeraPresenceCover = remainderCover()
): EphemeraLudicGraphStructureNode => ({
    tag: 'Presence',
    universalKey: name.startsWith('PRESENCE#') ? name as EphemeraPresenceNodeId : PresenceKey(name) as EphemeraPresenceNodeId,
    ...(parent
        ? { fromHostPresence: typeof parent === 'string' ? { host: parent, presence: parentRemainderKey(parent) } : parent }
        : {}),
    cover,
})

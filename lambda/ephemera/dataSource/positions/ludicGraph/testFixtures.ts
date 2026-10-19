import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphFieldPayload, EphemeraLudicGraphStructureNode, EphemeraPresenceCover, EphemeraPresenceParentPointer } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { BASE_PRESENCE_ID } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'
import type { PlayLudicGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions/types'

import { EphemeraLudicGraph } from './index'

/**
 * A fixture's stand-in for what the producers write: every component node a graph holds is listed by
 * some binding (the coverage invariant). A fixture that names its nodes and its root binding but not
 * the entries between them gets the missing entries appended to `PRESENCE#Base` (else the one
 * hostless binding, else the one binding), each naming the member's own `PRESENCE#Base`. A fixture that lists a cover
 * itself, or holds no root binding, is left as written.
 */
const withRootCover = (hostId: EphemeraMembershipHostId, nodes: EphemeraLudicGraphFieldPayload['nodes']): EphemeraLudicGraphFieldPayload['nodes'] => {
    const bindings = nodes.filter((node): node is EphemeraLudicGraphStructureNode => typeof node !== 'string' && node.tag === 'Presence')
    const root = bindings.find((node) => node.universalKey === BASE_PRESENCE_ID)
        ?? (bindings.filter((node) => !node.fromHostPresence).length === 1 ? bindings.find((node) => !node.fromHostPresence) : undefined)
        ?? (bindings.length === 1 ? bindings[0] : undefined)
    if (!root) {
        return nodes
    }
    const listed = new Set(bindings.flatMap((node) => node.cover.members.map((entry) => entry.host as string)))
    const uncovered = nodes.flatMap((node) => (
        typeof node !== 'string' && node.tag !== 'Presence' && node.universalKey !== hostId && !listed.has(node.universalKey) ? [node.universalKey] : []
    ))
    return uncovered.length === 0 ? nodes : nodes.map((node) => node === root
        ? { ...root, cover: { members: [...root.cover.members, ...uncovered.map((host) => ({ host, presence: BASE_PRESENCE_ID })) as EphemeraPresenceCover['members']] } }
        : node
    )
}

/**
 * Test helper: host-bound graph from field payload shape. `rootId` defaults to `hostId`
 * (a fresh test fixture's own root) but can be overridden for closure-shaped fixtures.
 */
export const testLudicGraph = (
    hostId: EphemeraMembershipHostId,
    payload: Partial<EphemeraLudicGraphFieldPayload> = {}
): EphemeraLudicGraph => EphemeraLudicGraph.fromFieldPayload(hostId, {
    nodes: [], rootId: hostId, ports: [], ...payload,
    ...(payload.nodes ? { nodes: withRootCover(hostId, payload.nodes) } : {}),
})

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
    cover: EphemeraPresenceCover = { members: [] }
): EphemeraLudicGraphStructureNode => ({
    tag: 'Presence',
    universalKey: name.startsWith('PRESENCE#') ? name as EphemeraPresenceNodeId : PresenceKey(name) as EphemeraPresenceNodeId,
    ...(parent
        ? { fromHostPresence: typeof parent === 'string' ? { host: parent, presence: parentRemainderKey(parent) } : parent }
        : {}),
    cover,
})

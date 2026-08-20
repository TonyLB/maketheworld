import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { PlayLudicGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions/types'

import { EphemeraLudicGraph } from './index'

/**
 * Test helper: host-bound graph from field payload shape. `rootId` defaults to `hostId`
 * (a fresh test fixture's own root, per LP4a) but can be overridden for closure-shaped fixtures.
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

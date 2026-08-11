import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { PlayLudicGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions/types'

import { EphemeraLudicGraph } from './index'

/** Test helper: host-bound graph from field payload shape. */
export const testPositionGraph = (
    hostId: EphemeraMembershipHostId,
    payload: EphemeraLudicGraphFieldPayload = { nodes: [] }
): EphemeraLudicGraph => EphemeraLudicGraph.fromFieldPayload(hostId, payload)

/** Test helper: host-bound graph from play read envelope (supports Exit edges). */
export const testPositionGraphFromEnvelope = (
    hostId: EphemeraMembershipHostId,
    envelope: PlayLudicGraph = { nodes: [] }
): EphemeraLudicGraph => EphemeraLudicGraph.fromPlayEnvelope(hostId, envelope)

import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraPositionGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions/types'

import { EphemeraPositionGraph } from './index'

/** Test helper: host-bound graph from field payload shape. */
export const testPositionGraph = (
    hostId: EphemeraMembershipHostId,
    payload: EphemeraPositionGraphFieldPayload = { nodes: [] }
): EphemeraPositionGraph => EphemeraPositionGraph.fromFieldPayload(hostId, payload)

/** Test helper: host-bound graph from play read envelope (supports Exit edges). */
export const testPositionGraphFromEnvelope = (
    hostId: EphemeraMembershipHostId,
    envelope: PlayPositionGraph = { nodes: [] }
): EphemeraPositionGraph => EphemeraPositionGraph.fromPlayEnvelope(hostId, envelope)

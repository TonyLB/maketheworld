import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import { fromRoomMeta, type HostRelationalEdge } from '../../positionGraph'
import type { HostRelationalPatch } from '../types'

export type HostRelationalPatchTransactItem = Parameters<typeof ephemeraDB.transactWrite>[0][number]

const toHostRelationalEdge = (patch: HostRelationalPatch): HostRelationalEdge => ({
    from: patch.edge.from,
    to: patch.edge.to,
    kind: patch.edge.kind,
    ...(patch.edge.relationLabel !== undefined ? { relationLabel: patch.edge.relationLabel } : {}),
})

export const buildHostRelationalPatchTransactItems = (
    patches: HostRelationalPatch[]
): HostRelationalPatchTransactItem[] => {
    const transactItems: HostRelationalPatchTransactItem[] = []

    for (const patch of patches) {
        const edge = toHostRelationalEdge(patch)

        transactItems.push({
            Update: {
                Key: {
                    EphemeraId: patch.hostId,
                    DataCategory: 'Meta::Room',
                },
                updateKeys: ['positionGraph'],
                updateReducer: (draft) => {
                    const graph = fromRoomMeta(draft, patch.hostId)
                    draft.positionGraph = patch.op === 'add'
                        ? graph.addRelationalEdge(edge).toStored()
                        : graph.removeRelationalEdge(edge).toStored()
                },
            },
        })
    }

    return transactItems
}

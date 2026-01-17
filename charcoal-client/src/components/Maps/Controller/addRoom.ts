import { UpdateStandardPayload } from "../../../slices/personalAssets/reducers"
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { StandardPositionFacet } from "@tonylb/mtw-wml/ts/standardize/keys/facets/position"
import StandardMap from "@tonylb/mtw-wml/ts/standardize/components/map"
import { v4 as uuidv4 } from 'uuid'
import { enforceTypedKey } from '@tonylb/mtw-utilities/ts/types'

export const addRoomFactory = ({
    mapId,
    standard,
    updateStandard
}: {
    mapId: `MAP#${string}`,
    standard: StandardForm,
    updateStandard: (action: UpdateStandardPayload) => void
}) => ({ roomId, x, y }: { roomId?: `ROOM#${string}`; x?: number; y?: number }) => {
    // Generate UUID and construct universalKey using enforceTypedKey
    const RoomKey = enforceTypedKey('ROOM')
    const uuid = uuidv4()
    const defaultedRoomId = roomId ?? RoomKey(uuid) as `ROOM#${string}`

    updateStandard({
        type: 'update',
        update: (draft) => {
            const returnValue = draft._clone()
            // Create room without local key - only universalKey
            returnValue.byUniversalId[defaultedRoomId] = new StandardRoom({
                tag: 'Room',
                universalKey: defaultedRoomId
            })
            const mapComponent = returnValue.byUniversalId[mapId]
            if (mapComponent && mapComponent instanceof StandardMap) {
                const newFacet = new StandardPositionFacet({
                    reference: { universalKey: defaultedRoomId, tag: 'Room' },
                    payload: { x: x ?? 0, y: y ?? 0 }
                })
                mapComponent.positions.items.push(newFacet)
            }
            return returnValue
        }
    })

}

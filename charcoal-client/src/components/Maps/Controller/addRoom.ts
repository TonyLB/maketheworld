import { UpdateStandardPayload } from "../../../slices/personalAssets/reducers"
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import StandardPosition from "@tonylb/mtw-wml/ts/standardize/components/position"
import StandardMap from "@tonylb/mtw-wml/ts/standardize/components/map"
import { v4 as uuidv4 } from 'uuid'

export const addRoomFactory = ({
    mapId,
    standard,
    updateStandard
}: {
    mapId: `MAP#${string}`,
    standard: StandardForm,
    updateStandard: (action: UpdateStandardPayload) => void
}) => ({ roomId, x, y }: { roomId?: `ROOM#${string}`; x?: number; y?: number }) => {
    //
    // Create a next synthetic key that doesn't conflict with the existing standardForm
    //
    let nextIndex = 1
    while (`Room${nextIndex}` in standard.byId) { nextIndex++ }
    const roomKey = `Room${nextIndex}`
    const defaultedRoomId = roomId ?? `ROOM#${uuidv4()}`

    updateStandard({
        type: 'update',
        update: (draft) => {
            const returnValue = draft._clone()
            returnValue.byId[roomKey] = new StandardRoom({
                tag: 'Room',
                key: roomKey,
                universalKey: defaultedRoomId
            })
            const mapComponent = returnValue.byUniversalId[mapId]
            if (mapComponent && mapComponent instanceof StandardMap) {
                mapComponent.positions.push(new StandardPosition({
                    room: defaultedRoomId,
                    x: x ?? 0,
                    y: y ?? 0
                }))
            }
            return returnValue
        }
    })

}

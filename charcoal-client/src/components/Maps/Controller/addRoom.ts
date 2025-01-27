import { GenericTree } from "@tonylb/mtw-base/ts/genericTree";
import { UpdateStandardPayload } from "../../../slices/personalAssets/reducers"
import { StandardFormData } from "@tonylb/mtw-wml/ts/standardize/components/dataTypes";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room";

export const addRoomFactory = ({ standard, updateStandard, updateSelected, selectedPositions }: { standard: StandardFormData, updateStandard: (action: UpdateStandardPayload) => void, updateSelected: (newTree: GenericTree<SchemaTag>) => void, selectedPositions: GenericTree<SchemaTag> }) => ({ roomId, x, y }: { roomId?: string; x?: number; y?: number }) => {
    //
    // Create a next synthetic key that doesn't conflict with the existing standardForm
    //
    let nextIndex = 1
    while (`Room${nextIndex}` in standard.byId) { nextIndex++ }
    const defaultedRoomId = roomId ?? `Room${nextIndex}`

    updateStandard({
        type: 'update',
        update: (draft) => {
            if (!(defaultedRoomId in draft.byId)) {
                draft.byId[defaultedRoomId] = new StandardRoom(defaultedRoomId)
            }
            return draft
        }
    })

    //
    // TODO: ISS-4347: Create updateSelection function in mapContext which allows updates localized to the
    // place in the ancestor-hierarchy of the selection (as recorded in mapTree) that is legal
    // for the action in question
    //
    // TODO: Use updateSelection in place of updateStandard to make the update to the appropriate
    // place in the mapTree hierarchy automatically.
    //

    updateSelected([
        ...selectedPositions,
        {
            data: { tag: 'Room', key: defaultedRoomId },
            children: []
        }
    ])
}

import { UpdateStandardPayload } from "../../../slices/personalAssets/reducers"
import { StandardForm } from "@tonylb/mtw-wml/dist/standardize/baseClasses"

export const addRoomFactory = ({ parentId, standard, updateStandard }: { parentId: string; standard: StandardForm, updateStandard: (action: UpdateStandardPayload) => void }) => ({ roomId, x, y }: { roomId?: string; x: number; y: number }) => {
    //
    // Create a next synthetic key that doesn't conflict with the existing standardForm
    //
    const keysByTag = Object.entries(standard.byId).filter(([_, node]) => (node.tag === 'Room')).map(([key]) => (key))
    let nextIndex = 1
    while (keysByTag.includes(`Room${nextIndex}`)) { nextIndex++ }

    const defaultedRoomId = roomId || `Room${nextIndex}`
    if (!(defaultedRoomId in standard.byId)) {
        updateStandard({
            type: 'addComponent',
            tag: 'Room',
            key: defaultedRoomId
        })
    }
    //
    // TODO: ISS-4347: Create updateSelection function in mapContext which allows updates localized to the
    // place in the ancestor-hierarchy of the selection (as recorded in mapTree) that is legal
    // for the action in question
    //
    // TODO: Use updateSelection in place of updateStandard to make the update to the appropriate
    // place in the mapTree hierarchy automatically.
    //

    // updateSchema({
    //     type: 'addChild',
    //     id: parentId,
    //     item: {
    //         data: { tag: 'Room', key: defaultedRoomId },
    //         children: [{ data: { tag: 'Position', x, y }, children: [] }]
    //     }
    // })
}

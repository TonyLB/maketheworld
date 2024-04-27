import { UpdateSchemaPayload, nextSyntheticKey } from "../../../slices/personalAssets/reducers"
import { GenericTree, TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"

export const addRoomFactory = ({ parentId, schema, updateSchema }: { parentId: string; schema: GenericTree<SchemaTag, TreeId>, updateSchema: (action: UpdateSchemaPayload) => void }) => ({ roomId, x, y }: { roomId?: string; x: number; y: number }) => {
    const assetNodeId = schema[0].id
    const defaultedRoomId = roomId || nextSyntheticKey({ schema, tag: 'Room' })
    if (parentId) {
        updateSchema({
            type: 'addChild',
            id: assetNodeId,
            item: {
                data: { tag: 'Room', key: defaultedRoomId },
                children: []
            }
        })
        updateSchema({
            type: 'addChild',
            id: parentId,
            item: {
                data: { tag: 'Room', key: defaultedRoomId },
                children: [{ data: { tag: 'Position', x, y }, children: [] }]
            }
        })
    }
}

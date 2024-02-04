import { UpdateSchemaPayload } from "../../../slices/personalAssets/reducers"
import { GenericTree, TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { SchemaTag, isSchemaCondition, isSchemaMap } from "@tonylb/mtw-wml/dist/simpleSchema/baseClasses"
import dfsWalk from "@tonylb/mtw-wml/dist/tree/dfsWalk"

export const addRoomFactory = ({ mapId, schema, updateSchema }: { mapId: string; schema: GenericTree<SchemaTag, TreeId>, updateSchema: (action: UpdateSchemaPayload) => void }) => ({ roomId, x, y }: { roomId?: string; x: number; y: number }) => {
    const mapNodeId = dfsWalk({
        default: { output: '', state: { conditioned: false } },
        callback: (previous, data, { id }: TreeId) => {
            if (!previous.state.conditioned && !previous.output && isSchemaMap(data) && data.key === mapId) {
                return { output: id, state: {} }
            }
            return previous
        },
        nest: ({ state, data }) => ({ conditioned: state.conditioned || isSchemaCondition(data) }),
        unNest: ({ previous }) => (previous)
    })(schema)
    if (mapNodeId) {
        updateSchema({
            type: 'addChild',
            id: mapNodeId,
            item: {
                data: { tag: 'Room', key: roomId ?? '', x, y },
                children: []
            }
        })
    }
}

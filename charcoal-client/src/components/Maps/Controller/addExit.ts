import { UpdateSchemaPayload } from "../../../slices/personalAssets/reducers"
import { GenericTree, TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses";
import { SchemaTag } from "@tonylb/mtw-wml/dist/simpleSchema/baseClasses";

export const addExitFactory = ({ schema, updateSchema }: { schema: GenericTree<SchemaTag, TreeId>, updateSchema: (action: UpdateSchemaPayload) => void }) => ({ to, from }: { to: string; from: string }) => {
    updateSchema({
        type: 'addChild',
        id: schema[0].id,
        item: {
            data: { tag: 'Room', key: from },
            children: [
                { data: { tag: 'Exit', key: `${from}#${to}`, from, to, name: '' }, children: [] }
            ]
        }
    })
}

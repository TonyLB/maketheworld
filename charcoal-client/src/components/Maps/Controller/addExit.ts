import { UpdateSchemaPayload } from "../../../slices/personalAssets/reducers"
import { GenericTree, TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses";
import { SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses";

export const addExitFactory = ({ schema, updateSchema, parentId }: { schema: GenericTree<SchemaTag, TreeId>, updateSchema: (action: UpdateSchemaPayload) => void, parentId: string }) => ({ to, from }: { to: string; from: string }) => {
    updateSchema({
        type: 'addChild',
        id: parentId,
        item: {
            data: { tag: 'Room', key: from },
            children: [
                { data: { tag: 'Exit', key: `${from}#${to}`, from, to }, children: [] }
            ]
        }
    })
}

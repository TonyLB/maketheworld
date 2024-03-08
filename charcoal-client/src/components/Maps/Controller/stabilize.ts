import { SchemaTag, isSchemaPosition } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { UpdateSchemaPayload } from "../../../slices/personalAssets/reducers"
import { SimNode } from "../Edit/MapDThree/baseClasses"
import { GenericTree, TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses";
import { treeFindByID } from "@tonylb/mtw-wml/dist/tree/genericIDTree";

export const stabilizeFactory = (props: { schema: GenericTree<SchemaTag, TreeId>; updateSchema: (action: UpdateSchemaPayload) => void }) => (values: SimNode[]) => {
    const { schema, updateSchema } = props
    values.forEach(({ id, x, y }) => {
        const previousNode = treeFindByID(schema, id)
        if (typeof previousNode !== 'undefined') {
            const { data: previousSchema } = previousNode
            if (isSchemaPosition(previousSchema) && (previousSchema.x !== Math.round(x) || previousSchema.y !== Math.round(y))) {
                updateSchema({
                    type: 'updateNode',
                    id,
                    item: {
                        ...previousSchema,
                        x: Math.round(x),
                        y: Math.round(y)
                    }
                })
            }
        }
    })
}
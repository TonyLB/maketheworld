import { GenericTree, GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";

export const standardFieldToOutputNode = (field: GenericTreeNode<SchemaTag>): GenericTree<SchemaTag> => (
    field ? [field] : []
)

export { defaultedEquals } from "./defaultedEquals"

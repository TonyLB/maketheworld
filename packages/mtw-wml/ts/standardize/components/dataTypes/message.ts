import { SchemaDescriptionTag, SchemaOutputTag, SchemaTag } from "../../../schema/baseClasses"
import { GenericTree } from "../../../tree/baseClasses"
import { EditWrappedStandardNode, StandardBaseData } from "./abstract"

export type StandardMessageData = {
    tag: 'Message';
    description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    rooms: GenericTree<SchemaTag>;
} & StandardBaseData

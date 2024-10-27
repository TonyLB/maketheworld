import { SchemaDescriptionTag, SchemaOutputTag } from "../../../schema/baseClasses"
import { EditWrappedStandardNode, StandardBaseData } from "./abstract"

export type StandardBookmarkData = {
    tag: 'Bookmark';
    description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
} & StandardBaseData

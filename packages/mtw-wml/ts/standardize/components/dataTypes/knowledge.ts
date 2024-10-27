import { SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag } from "../../../schema/baseClasses"
import { EditWrappedStandardNode, StandardBaseData } from "./abstract"

export type StandardKnowledgeData = {
    tag: 'Knowledge';
    name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
} & StandardBaseData

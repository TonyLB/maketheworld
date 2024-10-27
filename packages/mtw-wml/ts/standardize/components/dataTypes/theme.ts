import { SchemaNameTag, SchemaOutputTag, SchemaPromptTag, SchemaTag } from "../../../schema/baseClasses"
import { GenericTree, GenericTreeFiltered } from "../../../tree/baseClasses"
import { EditWrappedStandardNode, StandardBaseData } from "./abstract"

export type StandardThemeData = {
    tag: 'Theme';
    name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    prompts: GenericTreeFiltered<SchemaPromptTag, SchemaTag>;
    rooms: GenericTree<SchemaTag>;
    maps: GenericTree<SchemaTag>;
} & StandardBaseData

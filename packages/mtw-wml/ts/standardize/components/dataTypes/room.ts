import { SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag, SchemaShortNameTag, SchemaSummaryTag, SchemaTag, SchemaThemeTag } from "../../../schema/baseClasses"
import { GenericTree, GenericTreeFiltered } from "../../../tree/baseClasses"
import { EditWrappedStandardNode, StandardBaseData } from "./abstract"

export type StandardRoomData = {
    tag: 'Room';
    shortName?: EditWrappedStandardNode<SchemaShortNameTag, SchemaOutputTag>;
    name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    summary?: EditWrappedStandardNode<SchemaSummaryTag, SchemaOutputTag>;
    description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    exits: GenericTree<SchemaTag>;
    themes: GenericTreeFiltered<SchemaThemeTag, SchemaTag>;
} & StandardBaseData

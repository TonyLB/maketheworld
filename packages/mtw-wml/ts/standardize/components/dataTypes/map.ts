import { SchemaNameTag, SchemaOutputTag, SchemaTag, SchemaThemeTag } from "../../../schema/baseClasses"
import { GenericTree, GenericTreeFiltered } from "../../../tree/baseClasses"
import { EditWrappedStandardNode, StandardBaseData } from "./abstract"

export type StandardMapData = {
    tag: 'Map';
    name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    images: GenericTree<SchemaTag>;
    positions: GenericTree<SchemaTag>;
    themes: GenericTreeFiltered<SchemaThemeTag, SchemaTag>;
} & StandardBaseData

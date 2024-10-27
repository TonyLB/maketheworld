import { SchemaFirstImpressionTag, SchemaImageTag, SchemaNameTag, SchemaOneCoolThingTag, SchemaOutfitTag, SchemaOutputTag, SchemaPronounsTag, SchemaTag } from "../../../schema/baseClasses"
import { EditWrappedStandardNode, StandardBaseData } from "./abstract"

export type StandardCharacterData = {
    tag: 'Character';
    name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    firstImpression?: EditWrappedStandardNode<SchemaFirstImpressionTag, SchemaTag>;
    oneCoolThing?: EditWrappedStandardNode<SchemaOneCoolThingTag, SchemaTag>;
    outfit?: EditWrappedStandardNode<SchemaOutfitTag, SchemaTag>;
    pronouns?: EditWrappedStandardNode<SchemaPronounsTag, SchemaTag>;
    image?: EditWrappedStandardNode<SchemaImageTag, SchemaTag>;
} & StandardBaseData

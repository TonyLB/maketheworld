import { SchemaFirstImpressionTag, SchemaImageTag, SchemaNameTag, SchemaOneCoolThingTag, SchemaOutfitTag, SchemaOutputTag, SchemaPronounsTag, SchemaTag } from "../../../schema/baseClasses"
import { EditWrappedStandardNode, StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";

export type StandardCharacterData = {
    tag: 'Character';
    name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    firstImpression?: EditWrappedStandardNode<SchemaFirstImpressionTag, SchemaTag>;
    oneCoolThing?: EditWrappedStandardNode<SchemaOneCoolThingTag, SchemaTag>;
    outfit?: EditWrappedStandardNode<SchemaOutfitTag, SchemaTag>;
    pronouns?: EditWrappedStandardNode<SchemaPronounsTag, SchemaTag>;
    image?: EditWrappedStandardNode<SchemaImageTag, SchemaTag>;
} & StandardBaseData

export const isStandardCharacter = (arg: any): arg is StandardCharacterData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Action'),
        checkTypes(arg, {
            key: 'string',
        },
        {
            name: 'node',
            firstImpression: 'node',
            oneCoolThing: 'node',
            outfit: 'node',
            image: 'node'
        })
    )
}
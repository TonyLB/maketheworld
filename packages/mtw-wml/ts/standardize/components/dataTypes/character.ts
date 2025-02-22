import { SchemaNameTag } from "@tonylb/mtw-base/ts/schema/example";
import { EditWrappedStandardNode, StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";
import { SchemaOneCoolThingTag, SchemaPronounsTag } from "@tonylb/mtw-base/ts/schema/character";
import { SchemaImageTag } from "@tonylb/mtw-base/ts/schema/image";
import { SchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema";

export type StandardCharacterData = {
    tag: 'Character';
    name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    oneCoolThing?: EditWrappedStandardNode<SchemaOneCoolThingTag, SchemaTag>;
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
            oneCoolThing: 'node',
            image: 'node'
        })
    )
}
import { SchemaNameTag } from "@tonylb/mtw-base/ts/schema/example";
import { EditWrappedStandardNode, StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";
import { SchemaPronounsTag } from "@tonylb/mtw-base/ts/schema/character";
import { SchemaImageTag } from "@tonylb/mtw-base/ts/schema/image";
import { SchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";

export type StandardCharacterData = {
    tag: 'Character';
    shortName?: StandardEditableData<string>;
    name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
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
            image: 'node'
        })
    )
}
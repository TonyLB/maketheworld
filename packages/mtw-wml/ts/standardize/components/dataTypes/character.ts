import { EditWrappedStandardNode, StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";
import { SchemaImageTag } from "@tonylb/mtw-base/ts/schema/image";
import { SchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";
import { RenderTree } from "@tonylb/mtw-base/ts/renderTree";

export type StandardCharacterData = {
    tag: 'Character';
    shortName?: StandardEditableData<string>;
    pronouns?: StandardEditableData<string>;
    displayName?: StandardEditableData<RenderTree>;
    image?: EditWrappedStandardNode<SchemaImageTag, SchemaTag>;
} & StandardBaseData

export const isStandardCharacterData = (arg: any): arg is StandardCharacterData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Character'),
        checkTypes(arg, {},
        {
            key: 'key',
            universalKey: 'string',
            shortName: 'literal',
            pronouns: 'literal',
            displayName: 'renderTree',
            image: 'node'
        })
    )
}
import { EditWrappedStandardNode, StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";
import { SchemaDescriptionTag } from "@tonylb/mtw-base/ts/schema/prose";
import { SchemaOutputTag } from "@tonylb/mtw-base/ts/schema";
import { ReferenceListData } from "./reference";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";

/** Ephemera does not consume this shape for live play; WML Message is authoring and tooling only at runtime. */
export type StandardMessageData = {
    tag: 'Message';
    shortName?: StandardEditableData<string>;
    description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    rooms?: ReferenceListData;
} & StandardBaseData

export const isStandardMessageData = (arg: any): arg is StandardMessageData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Message'),
        checkTypes(arg, {
            key: 'key',
            rooms: 'referenceList'
        },
        {
            shortName: 'literal',
            description: 'node'
        })
    )
}

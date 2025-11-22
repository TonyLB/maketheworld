import { EditWrappedStandardNode, StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";
import { SchemaDescriptionTag } from "@tonylb/mtw-base/ts/schema/example";
import { SchemaOutputTag } from "@tonylb/mtw-base/ts/schema";
import { ReferenceListData } from "./reference";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";

export type StandardMessageData = {
    tag: 'Message';
    description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    rooms?: ReferenceListData;
} & StandardBaseData

export const isStandardMessage = (arg: any): arg is StandardMessageData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Message'),
        checkTypes(arg, {
            key: 'string',
            rooms: 'referenceList'
        },
        {
            description: 'node'
        })
    )
}

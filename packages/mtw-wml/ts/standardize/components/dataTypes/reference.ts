import checkTypes, { CheckTypes } from "@tonylb/mtw-base/ts/utils/checkTypes";
import { ComponentTag } from "./abstract";
import { ComponentUUID, isSchemaComponentTag, isSchemaComponentUUID } from "@tonylb/mtw-base/ts/schema";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";

export type StandardReferenceData = string | ({
    key?: string;
    universalKey?: ComponentUUID;
    tag: ComponentTag;
})

/**
 * Serialization format for ReferenceList.
 * This is the serialized representation of a ReferenceList instance.
 */
export type ReferenceListData = StandardEditableData<StandardReferenceData>[]

export const isStandardReferencePayloadData = (arg: any): arg is StandardReferenceData => {
    return (typeof arg === 'string' && isSchemaComponentUUID(arg)) ||
        (
            checkTypes({
                required: { tag: CheckTypes.STRING },
                optional: { key: CheckTypes.STRING, universalKey: CheckTypes.STRING }
            })(arg) &&
            isSchemaComponentTag(arg.tag) &&
            (!arg.universalKey || isSchemaComponentUUID(arg.universalKey))
        )
}
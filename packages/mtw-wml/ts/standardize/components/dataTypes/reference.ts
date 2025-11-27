import checkTypes, { CheckTypes } from "@tonylb/mtw-base/ts/utils/checkTypes";
import { ComponentUUID, isSchemaComponentUUID } from "@tonylb/mtw-base/ts/schema";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";

export type StandardReferenceData = string | ({
    key?: string;
    universalKey?: ComponentUUID;
    // tag is no longer stored; it is derived from universalKey when needed
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
                required: {},
                optional: { key: CheckTypes.STRING, universalKey: CheckTypes.STRING }
            })(arg) &&
            (!arg.universalKey || isSchemaComponentUUID(arg.universalKey))
        )
}
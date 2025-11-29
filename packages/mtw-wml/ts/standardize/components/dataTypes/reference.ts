import checkTypes, { CheckTypes } from "@tonylb/mtw-base/ts/utils/checkTypes";
import { ComponentUUID, isSchemaComponentUUID } from "@tonylb/mtw-base/ts/schema";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";
import { ComponentTag } from "./abstract";

/**
 * StandardKeyData: Minimal identifier serialization format
 * Used for StandardKey serialization - no tag stored
 */
export type StandardKeyData = ComponentUUID | ({
    key: string;
    universalKey?: ComponentUUID;
})

/**
 * StandardReferenceData: Standalone reference serialization format
 * Used for StandardReference serialization - includes tag for standalone functionality
 */
export type StandardReferenceData = ComponentUUID | ({
    key: string;  // Required in object form - if missing, use ComponentUUID form instead
    universalKey?: ComponentUUID;
    tag: ComponentTag;  // Required - stored in StandardReference for standalone functionality
})

/**
 * Serialization format for ReferenceList.
 * This is the serialized representation of a ReferenceList instance.
 */
export type ReferenceListData = StandardEditableData<StandardReferenceData>[]

export const isStandardKeyData = (arg: any): arg is StandardKeyData => {
    // ComponentUUID form (string)
    if (typeof arg === 'string' && isSchemaComponentUUID(arg)) {
        return true
    }
    // Object form: requires key, no tag
    if (checkTypes({
        required: { key: CheckTypes.STRING },
        optional: { universalKey: CheckTypes.STRING }
    })(arg)) {
        if (arg.universalKey && !isSchemaComponentUUID(arg.universalKey)) {
            return false
        }
        // Ensure tag is not present (StandardKeyData doesn't have tag)
        if ('tag' in arg) {
            return false
        }
        return true
    }
    return false
}

export const isStandardReferencePayloadData = (arg: any): arg is StandardReferenceData => {
    // ComponentUUID form (string)
    if (typeof arg === 'string') {
        return isSchemaComponentUUID(arg)
    }
    // Object form: requires key and tag
    if (checkTypes({
        required: { },
        optional: { universalKey: CheckTypes.STRING, tag: CheckTypes.STRING, key: CheckTypes.STRING }
    })(arg)) {
        if (arg.universalKey && !isSchemaComponentUUID(arg.universalKey)) {
            return false
        }
        if (!arg.tag && !arg.universalKey) {
            return false
        }
        if (!arg.key && !arg.universalKey) {
            return false
        }
        return true
    }
    return false
}
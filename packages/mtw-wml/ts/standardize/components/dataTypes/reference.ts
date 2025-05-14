import checkTypes, { CheckTypes } from "@tonylb/mtw-base/ts/utils/checkTypes";
import { ComponentTag } from "./abstract";
import { ComponentUUID, isSchemaComponentUUID } from "@tonylb/mtw-base/ts/schema";

export type StandardReferenceData = string | ({
    key?: string;
    universalKey?: ComponentUUID;
    tag: ComponentTag;
    global?: boolean;
})

export const isStandardReferencePayloadData = (arg: any): arg is StandardReferenceData => (
    (typeof arg === 'string' && isSchemaComponentUUID(arg)) ||
    checkTypes({
        required: { tag: CheckTypes.STRING },
        optional: { global: CheckTypes.BOOLEAN, key: CheckTypes.STRING, universalKey: CheckTypes.STRING }
    })(arg)
)
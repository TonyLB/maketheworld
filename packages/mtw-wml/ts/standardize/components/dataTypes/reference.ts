import checkTypes, { CheckTypes } from "@tonylb/mtw-base/ts/utils/checkTypes";
import { ComponentTag, StandardBaseData } from "./abstract";
import { SerializeNDJSONMixin } from "../../baseClasses";

export type StandardReferenceData = string | ({
    key?: string;
    universalKey?: string;
    tag: ComponentTag;
    global?: boolean;
})

export const isStandardReferencePayloadData = (arg: any): arg is StandardReferenceData => (
    typeof arg === 'string' ||
    checkTypes({
        required: { tag: CheckTypes.STRING },
        optional: { global: CheckTypes.BOOLEAN, key: CheckTypes.STRING, universalKey: CheckTypes.STRING }
    })(arg)
)
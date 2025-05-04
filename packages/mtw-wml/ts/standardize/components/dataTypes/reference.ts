import checkTypes, { CheckTypes } from "@tonylb/mtw-base/ts/utils/checkTypes";
import { ComponentTag, StandardBaseData } from "./abstract";
import { SerializeNDJSONMixin } from "../../baseClasses";

export type StandardReferenceData = string | ({
    tag: ComponentTag;
    global?: boolean;
} & StandardBaseData & SerializeNDJSONMixin)

export const isStandardReferenceData = (arg: any): arg is StandardReferenceData => (
    typeof arg === 'string' ||
    checkTypes({
        required: { tag: CheckTypes.STRING },
        optional: { global: CheckTypes.BOOLEAN, key: CheckTypes.STRING }
    })(arg)
)
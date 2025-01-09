import checkTypes, { CheckTypes } from "@tonylb/mtw-base/ts/utils/checkTypes";
import { ComponentTag, StandardBaseData } from "./abstract";
import { SerializeNDJSONMixin } from "../../baseClasses";

export type StandardReferenceData = {
    tag: ComponentTag;
    global?: boolean;
} & StandardBaseData & SerializeNDJSONMixin

export const isStandardReferenceData = (arg: any): arg is StandardReferenceData => (
    checkTypes({
        required: { tag: CheckTypes.STRING, key: CheckTypes.STRING },
        optional: { global: CheckTypes.BOOLEAN }
    })(arg)
)
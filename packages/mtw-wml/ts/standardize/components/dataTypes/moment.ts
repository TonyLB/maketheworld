import { StandardBaseData } from "./abstract"
import { checkAll } from "./typeguards";
import { isStandardReferencePayloadData, StandardReferenceData } from "./reference";
import checkTypes, { CheckTypes } from "@tonylb/mtw-base/ts/utils/checkTypes";

export type StandardMomentData = {
    tag: 'Moment';
    messages: StandardReferenceData[];
} & StandardBaseData

export const isStandardMoment = (arg: any): arg is StandardMomentData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkTypes({
        required: { tag: CheckTypes.STRING },
        optional: { key: CheckTypes.STRING, universalKey: CheckTypes.STRING },
        values: {
            tag: (tag: any) => (tag === 'Moment'),
            messages: (messages: any) => (Array.isArray(messages) && messages.every(isStandardReferencePayloadData))
        }
    })(arg)
}

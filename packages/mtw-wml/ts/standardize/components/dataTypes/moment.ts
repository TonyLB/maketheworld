import { StandardBaseData } from "./abstract"
import { checkAll } from "./typeguards";
import { isStandardReferenceData, StandardReferenceData } from "./reference";
import checkTypes, { CheckTypes } from "@tonylb/mtw-base/ts/utils/checkTypes";

export type StandardMomentData = {
    tag: 'Moment';
    messages: StandardReferenceData[];
} & StandardBaseData

export const isStandardMoment = (arg: any): arg is StandardMomentData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Moment'),
        checkTypes({
            required: { tag: CheckTypes.STRING },
            values: {
                messages: (messages) => (Array.isArray(messages) && messages.every(isStandardReferenceData))
            }
        })(arg)
    )
}

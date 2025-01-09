import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";
import { StandardReferenceData } from ".";

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
        checkTypes(arg, {
            key: 'string',
            messages: 'tree'
        },
        {})
    )
}

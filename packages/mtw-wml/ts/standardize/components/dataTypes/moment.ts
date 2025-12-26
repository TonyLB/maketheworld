import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";
import { isStandardReferenceData, ReferenceListData } from "./reference";

export type StandardMomentData = {
    tag: 'Moment';
    messages?: ReferenceListData;
} & StandardBaseData

export const isStandardMomentData = (arg: any): arg is StandardMomentData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Moment'),
        (!('messages' in arg) || (Array.isArray(arg.messages) && arg.messages.every(isStandardReferenceData))),
        checkTypes(arg, { },
        {
            key: 'string',
            universalKey: 'string'
        })
    )
}

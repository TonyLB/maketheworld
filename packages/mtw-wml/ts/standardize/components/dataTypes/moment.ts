import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";
import { isStandardReferenceData, ReferenceListData } from "./reference";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";

export type StandardMomentData = {
    tag: 'Moment';
    shortName?: StandardEditableData<string>;
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
            key: 'key',
            universalKey: 'string',
            shortName: 'literal'
        })
    )
}

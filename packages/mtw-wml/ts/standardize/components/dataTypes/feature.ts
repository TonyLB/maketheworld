import { ReferenceListData } from "./reference";
import { StandardBaseData } from "./abstract";
import { checkAll, checkTypes } from "./typeguards";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";

export type StandardFeatureData = {
    tag: 'Feature';
    shortName?: StandardEditableData<string>;
    examples?: ReferenceListData;
} & StandardBaseData

export const isStandardFeatureData = (arg: any): arg is StandardFeatureData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Feature'),
        checkTypes(arg, {},
        {
            key: 'key',
            universalKey: 'string',
            shortName: 'literal'
        })
    )
}
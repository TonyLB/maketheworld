import { StandardReferenceData } from "./reference";
import { StandardBaseData } from "./abstract";
import { checkAll, checkTypes } from "./typeguards";
import { StandardRemoveData } from ".";

export type StandardFeatureData = {
    tag: 'Feature';
    examples?: (StandardReferenceData | StandardRemoveData)[];
} & StandardBaseData

export const isStandardFeature = (arg: any): arg is StandardFeatureData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Feature'),
        checkTypes(arg, {},
        {
            key: 'string',
            universalKey: 'string'
        })
    )
}
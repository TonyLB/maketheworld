import { StandardBaseData } from './abstract'
import { StandardEditableData } from '@tonylb/mtw-base/ts/editable'
import { FacetListData } from '../../keys/abstract'
import { checkAll, checkTypes } from './typeguards'

export type StandardGuidanceData = {
    tag: 'Guidance';
    instructions?: StandardEditableData<string>;
    marks?: FacetListData<string>;
    shortName?: StandardEditableData<string>;
} & StandardBaseData

export type StandardGuidanceNDJSONData = StandardGuidanceData

export const isStandardGuidanceData = (arg: any): arg is StandardGuidanceData => {
    if (typeof arg !== 'object') {
        return false
    }
    return checkAll(
        ('tag' in arg && arg.tag === 'Guidance'),
        checkTypes(arg, {}, {
            key: 'key',
            universalKey: 'string',
            instructions: 'literal',
            marks: 'facetList',
            shortName: 'literal'
        })
    )
}

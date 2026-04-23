import { StandardBaseData } from './abstract'
import { StandardEditableData } from '@tonylb/mtw-base/ts/editable'
import { FacetListData, FacetListInputData } from '../../keys/abstract'
import { checkAll, checkTypes } from './typeguards'
import { Override } from '../../types'

export type StandardGuidanceData = {
    tag: 'Guidance';
    instructions?: StandardEditableData<string>;
    marks?: FacetListData<string>;
    shortName?: StandardEditableData<string>;
} & StandardBaseData

export type StandardGuidanceInputData = Override<StandardGuidanceData, {
    marks?: FacetListInputData<string>;
}>

export type StandardGuidanceNDJSONData = StandardGuidanceData
export type StandardGuidanceNDJSONInputData = StandardGuidanceInputData

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

export const isStandardGuidanceInputData = (arg: any): arg is StandardGuidanceInputData => {
    if (typeof arg !== 'object') {
        return false
    }
    return checkAll(
        ('tag' in arg && arg.tag === 'Guidance'),
        checkTypes(arg, {}, {
            key: 'key',
            universalKey: 'string',
            instructions: 'literal',
            marks: 'facetListInput',
            shortName: 'literal'
        })
    )
}

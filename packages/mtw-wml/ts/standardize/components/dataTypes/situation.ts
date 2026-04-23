import { StandardBaseData } from './abstract'
import type { StandardEditableData } from '@tonylb/mtw-base/ts/editable'
import { FacetListData, FacetListInputData } from '../../keys/abstract'
import { checkAll, checkTypes } from './typeguards'
import { Override } from '../../types'

export type StandardSituationData = {
    tag: 'Situation';
    shortName?: StandardEditableData<string>;
    marks?: FacetListData<string>;
} & StandardBaseData

export type StandardSituationInputData = Override<StandardSituationData, {
    marks?: FacetListInputData<string>;
}>

export const isStandardSituationData = (arg: any): arg is StandardSituationData => {
    if (typeof arg !== 'object') {
        return false
    }
    return checkAll(
        ('tag' in arg && arg.tag === 'Situation'),
        checkTypes(arg, {}, {
            key: 'key',
            universalKey: 'string',
            shortName: 'literal',
            marks: 'facetList'
        })
    )
}

export const isStandardSituationInputData = (arg: any): arg is StandardSituationInputData => {
    if (typeof arg !== 'object') {
        return false
    }
    return checkAll(
        ('tag' in arg && arg.tag === 'Situation'),
        checkTypes(arg, {}, {
            key: 'key',
            universalKey: 'string',
            shortName: 'literal',
            marks: 'facetListInput'
        })
    )
}

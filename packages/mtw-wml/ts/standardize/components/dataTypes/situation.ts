import { StandardBaseData } from './abstract'
import type { StandardEditableData } from '@tonylb/mtw-base/ts/editable'
import { FacetListData } from '../../keys/abstract'
import { checkAll, checkTypes } from './typeguards'

export type StandardSituationData = {
    tag: 'Situation';
    shortName?: StandardEditableData<string>;
    marks?: FacetListData<string>;
} & StandardBaseData

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

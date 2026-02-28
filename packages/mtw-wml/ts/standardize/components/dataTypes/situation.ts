import { StandardBaseData } from './abstract'
import { FacetListData } from '../../keys/abstract'
import { checkAll, checkTypes } from './typeguards'

export type StandardSituationData = {
    tag: 'Situation';
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
            marks: 'facetList'
        })
    )
}

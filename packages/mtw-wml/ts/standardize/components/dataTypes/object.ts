import { StandardBaseData } from './abstract'
import type { StandardEditableData } from '@tonylb/mtw-base/ts/editable'
import { checkAll, checkTypes } from './typeguards'

export type StandardObjectData = {
    tag: 'Object';
    shortName?: StandardEditableData<string>;
} & StandardBaseData

export const isStandardObjectData = (arg: any): arg is StandardObjectData => {
    if (typeof arg !== 'object') {
        return false
    }
    return checkAll(
        ('tag' in arg && arg.tag === 'Object'),
        checkTypes(arg, {}, {
            key: 'key',
            universalKey: 'string',
            shortName: 'literal',
        })
    )
}

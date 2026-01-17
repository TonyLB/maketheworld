import { RenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"

export type StandardMarkData = {
    tag: 'Mark';
    shortName?: StandardEditableData<string>;
    description?: StandardEditableData<RenderTree>;
} & StandardBaseData

export const isStandardMarkData = (arg: any): arg is StandardMarkData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Mark'),
        checkTypes(arg, {},
        {
            key: 'key',
            universalKey: 'string',
            shortName: 'literal',
            description: 'renderTree'
        })
    )
}

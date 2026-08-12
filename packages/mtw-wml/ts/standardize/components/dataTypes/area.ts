import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { isStandardLudicGraphData, StandardLudicGraphData } from "./ludicGraph"

export type StandardAreaData = {
    tag: 'Area';
    shortName?: StandardEditableData<string>;
    ludicGraph?: StandardLudicGraphData;
} & StandardBaseData

export const isStandardAreaData = (arg: unknown): arg is StandardAreaData => {
    if (typeof arg !== 'object' || arg === null) {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Area'),
        (!('ludicGraph' in arg) || isStandardLudicGraphData(arg.ludicGraph)),
        checkTypes(arg, {},
        {
            key: 'key',
            universalKey: 'string',
            shortName: 'literal',
        })
    )
}

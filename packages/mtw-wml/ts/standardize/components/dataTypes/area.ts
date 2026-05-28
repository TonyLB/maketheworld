import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { isStandardPositionGraphData, StandardPositionGraphData } from "./positionGraph"

export type StandardAreaData = {
    tag: 'Area';
    shortName?: StandardEditableData<string>;
    positionGraph?: StandardPositionGraphData;
} & StandardBaseData

export const isStandardAreaData = (arg: unknown): arg is StandardAreaData => {
    if (typeof arg !== 'object' || arg === null) {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Area'),
        (!('positionGraph' in arg) || isStandardPositionGraphData(arg.positionGraph)),
        checkTypes(arg, {},
        {
            key: 'key',
            universalKey: 'string',
            shortName: 'literal',
        })
    )
}

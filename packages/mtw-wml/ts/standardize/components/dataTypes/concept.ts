import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { isStandardLudicGraphData, StandardLudicGraphData } from "./ludicGraph"

/** A Concept has no render and no situations: a Concept is not addressable, so it has no render path. */
export type StandardConceptData = {
    tag: 'Concept';
    shortName?: StandardEditableData<string>;
    gloss?: StandardEditableData<string>;
    ludicGraph?: StandardLudicGraphData;
} & StandardBaseData

export const isStandardConceptData = (arg: unknown): arg is StandardConceptData => {
    if (typeof arg !== 'object' || arg === null) {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Concept'),
        (!('ludicGraph' in arg) || isStandardLudicGraphData(arg.ludicGraph)),
        checkTypes(arg, {},
        {
            key: 'key',
            universalKey: 'string',
            shortName: 'literal',
            gloss: 'literal',
        })
    )
}

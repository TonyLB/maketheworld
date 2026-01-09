import { RenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { ReferenceListData } from "./reference"
import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"

export type StandardLensData = {
    tag: 'Lens';
    shortName?: StandardEditableData<string>;
    description?: RenderTree;
    marks?: ReferenceListData;
} & StandardBaseData

export const isStandardLensData = (arg: any): arg is StandardLensData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Lens'),
        checkTypes(arg, {},
        {
            key: 'key',
            universalKey: 'string',
            shortName: 'literal',
            description: 'renderTree',
            marks: 'referenceList'
        })
    )
}

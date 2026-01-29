import { RenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards"
import { FacetListData } from "../../keys/abstract"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"

export type StandardExampleData = {
    tag: 'Example';
    name?: StandardEditableData<RenderTree>;
    summary?: StandardEditableData<RenderTree>;
    description?: StandardEditableData<RenderTree>;
    marks?: FacetListData<string>;  // MarkFacet uses string payload (Remove/Replace handled via StandardFacetData)
    shortName?: StandardEditableData<string>;
} & StandardBaseData

export type StandardExampleNDJSONData = {
    tag: 'Example';
    name?: StandardEditableData<RenderTree>;
    summary?: StandardEditableData<RenderTree>;
    description?: StandardEditableData<RenderTree>;
    marks?: FacetListData<string>;  // MarkFacet uses string payload (Remove/Replace handled via StandardFacetData)
    shortName?: StandardEditableData<string>;
} & StandardBaseData

export const isStandardExampleData = (arg: any): arg is StandardExampleData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Example'),
        checkTypes(arg, {},
        {
            key: 'key',
            universalKey: 'string',
            name: 'renderTree',
            summary: 'renderTree',
            description: 'renderTree',
            marks: 'facetList',
            shortName: 'literal'
        })
    )
}

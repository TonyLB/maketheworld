import { RenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards"
import { FacetListData, FacetListInputData } from "../../keys/abstract"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { Override } from "../../types"

export type StandardExampleData = {
    tag: 'Example';
    displayName?: StandardEditableData<string>;
    summary?: StandardEditableData<RenderTree>;
    description?: StandardEditableData<RenderTree>;
    marks?: FacetListData<string>;  // MarkFacet uses string payload (Remove/Replace handled via StandardFacetData)
    shortName?: StandardEditableData<string>;
} & StandardBaseData

export type StandardExampleInputData = Override<StandardExampleData, {
    marks?: FacetListInputData<string>;
}>

export type StandardExampleNDJSONData = StandardExampleData
export type StandardExampleNDJSONInputData = StandardExampleInputData

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
            displayName: 'literal',
            summary: 'renderTree',
            description: 'renderTree',
            marks: 'facetList',
            shortName: 'literal'
        })
    )
}

export const isStandardExampleInputData = (arg: any): arg is StandardExampleInputData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Example'),
        checkTypes(arg, {},
        {
            key: 'key',
            universalKey: 'string',
            displayName: 'literal',
            summary: 'renderTree',
            description: 'renderTree',
            marks: 'facetListInput',
            shortName: 'literal'
        })
    )
}

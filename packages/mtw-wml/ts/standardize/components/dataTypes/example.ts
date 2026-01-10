import { RenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards"
import { FacetListData } from "../../keys/abstract"

export type StandardExampleData = {
    tag: 'Example';
    name?: RenderTree;
    summary?: RenderTree;
    description?: RenderTree;
    marks?: FacetListData<string>;  // MarkFacet uses string payload
} & StandardBaseData

export type StandardExampleNDJSONData = {
    tag: 'Example';
    name?: RenderTree;
    summary?: RenderTree;
    description?: RenderTree;
    marks?: FacetListData<string>;  // MarkFacet uses string payload
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
            marks: 'facetList'
        })
    )
}

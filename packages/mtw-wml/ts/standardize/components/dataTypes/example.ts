import { RenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards"
import { FacetListData } from "../../keys/abstract"
import { MarkFacetPayload } from "../../keys/facets/dataTypes/facet"

export type StandardExampleData = {
    tag: 'Example';
    name?: RenderTree;
    summary?: RenderTree;
    description?: RenderTree;
    marks?: FacetListData<MarkFacetPayload>;
} & StandardBaseData

export type StandardExampleNDJSONData = {
    tag: 'Example';
    name?: RenderTree;
    summary?: RenderTree;
    description?: RenderTree;
    marks?: FacetListData<MarkFacetPayload>;
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

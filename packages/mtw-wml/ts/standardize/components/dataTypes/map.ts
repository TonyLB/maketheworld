import { GenericTree } from "@tonylb/mtw-base/ts/genericTree";
import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { FacetListData } from "../../keys/abstract";
import { PositionPayload } from "../../keys/facets/dataTypes/facet";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";

export type StandardMapData = {
    tag: 'Map';
    shortName?: StandardEditableData<string>;
    images?: GenericTree<SchemaTag>;
    positions?: FacetListData<PositionPayload>;
} & StandardBaseData

export const isStandardMapData = (arg: any): arg is StandardMapData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Map'),
        checkTypes(arg, {},
        {
            key: 'key',
            universalKey: 'string',
            shortName: 'literal',
            images: 'tree',
            positions: 'facetList'
        })
    )
}
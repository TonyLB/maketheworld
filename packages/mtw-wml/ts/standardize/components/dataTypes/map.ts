import { GenericTree } from "@tonylb/mtw-base/ts/genericTree";
import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { FacetListData, FacetListInputData } from "../../keys/abstract";
import { PositionPayload } from "../../keys/facets/dataTypes/facet";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";
import { Override } from "../../types";

export type StandardMapData = {
    tag: 'Map';
    shortName?: StandardEditableData<string>;
    images?: GenericTree<SchemaTag>;
    positions?: FacetListData<PositionPayload>;
} & StandardBaseData

export type StandardMapInputData = Override<StandardMapData, {
    positions?: FacetListInputData<PositionPayload>;
}>

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

export const isStandardMapInputData = (arg: any): arg is StandardMapInputData => {
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
            positions: 'facetListInput'
        })
    )
}
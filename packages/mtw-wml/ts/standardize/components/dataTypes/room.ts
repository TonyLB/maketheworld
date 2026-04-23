import { ReferenceListData } from "./reference"
import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { FacetListData, FacetListInputData } from "../../keys/abstract"
import { ExitPayload } from "../../keys/facets/dataTypes/facet"
import { isSituationRoomFacetPayload, type SituationRoomFacetPayloadType } from "../../keys/facets/situationRoom"
import { Override } from "../../types"

export type StandardRoomObjectData = {
    uuid: string;
    shortName: string;
}

/** Ephemera wire: prose from `<Render>`; same JSON shape as Situation room facet payload (literal + RenderTree fields). */
export type StandardRoomRenderData = SituationRoomFacetPayloadType

export type StandardRoomData = {
    tag: 'Room';
    shortName?: StandardEditableData<string>;
    exits?: FacetListData<ExitPayload>;
    situations?: FacetListData<SituationRoomFacetPayloadType>;
    lens?: ReferenceListData;
    features?: ReferenceListData;
    guidance?: ReferenceListData;
    characters?: ReferenceListData;
    /** Ephemera wire: runtime objects (OBJECT# + ShortName); same JSON shape as ephemera Meta::Room.objects. */
    objects?: StandardRoomObjectData[];
    /** Ephemera wire: resolved DisplayName / Summary / Description from `<Render>`. */
    render?: StandardRoomRenderData;
} & StandardBaseData

export type StandardRoomInputData = Override<StandardRoomData, {
    exits?: FacetListInputData<ExitPayload>;
    situations?: FacetListInputData<SituationRoomFacetPayloadType>;
}>

const isStandardRoomObjectData = (x: unknown): x is StandardRoomObjectData => (
    typeof x === 'object'
    && x !== null
    && 'uuid' in x
    && 'shortName' in x
    && typeof (x as StandardRoomObjectData).uuid === 'string'
    && typeof (x as StandardRoomObjectData).shortName === 'string'
)

const isStandardRoomRenderData = (x: unknown): x is StandardRoomRenderData => (
    typeof x === 'object'
    && x !== null
    && isSituationRoomFacetPayload(x)
    && checkTypes(x as Record<string, unknown>, {}, {
        displayName: 'literal',
        summary: 'renderTree',
        description: 'renderTree',
    })
)

export const isStandardRoomData = (arg: any): arg is StandardRoomData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Room'),
        checkTypes(arg, { },
        {
            key: 'key',
            universalKey: 'string',
            shortName: 'literal',
            exits: 'facetList',
            situations: 'facetList',
            lens: 'referenceList',
            features: 'referenceList',
            guidance: 'referenceList',
            characters: 'referenceList'
        }),
        !('objects' in arg) ||
            (Array.isArray(arg.objects) && (arg.objects as unknown[]).every(isStandardRoomObjectData)),
        !('render' in arg) ||
            isStandardRoomRenderData(arg.render)
    )
}

export const isStandardRoomInputData = (arg: any): arg is StandardRoomInputData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Room'),
        checkTypes(arg, { },
        {
            key: 'key',
            universalKey: 'string',
            shortName: 'literal',
            exits: 'facetListInput',
            situations: 'facetListInput',
            lens: 'referenceList',
            features: 'referenceList',
            guidance: 'referenceList',
            characters: 'referenceList'
        }),
        !('objects' in arg) ||
            (Array.isArray(arg.objects) && (arg.objects as unknown[]).every(isStandardRoomObjectData)),
        !('render' in arg) ||
            isStandardRoomRenderData(arg.render)
    )
}

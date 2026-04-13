import { ReferenceListData } from "./reference"
import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { FacetListData } from "../../keys/abstract"
import { ExitPayload } from "../../keys/facets/dataTypes/facet"
import type { SituationRoomFacetPayloadType } from "../../keys/facets/situationRoom"

export type StandardRoomObjectData = {
    uuid: string;
    shortName: string;
}

export type StandardRoomData = {
    tag: 'Room';
    shortName?: StandardEditableData<string>;
    exits?: FacetListData<ExitPayload>;
    situations?: FacetListData<SituationRoomFacetPayloadType>;
    lens?: ReferenceListData;
    features?: ReferenceListData;
    examples?: ReferenceListData;
    guidance?: ReferenceListData;
    characters?: ReferenceListData;
    /** Ephemera wire: runtime objects (OBJECT# handle + ShortName label); project those handles for Meta::Room.objects. */
    objects?: StandardRoomObjectData[];
} & StandardBaseData

const isStandardRoomObjectData = (x: unknown): x is StandardRoomObjectData => (
    typeof x === 'object'
    && x !== null
    && 'uuid' in x
    && 'shortName' in x
    && typeof (x as StandardRoomObjectData).uuid === 'string'
    && typeof (x as StandardRoomObjectData).shortName === 'string'
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
            examples: 'referenceList',
            guidance: 'referenceList',
            characters: 'referenceList'
        }),
        !('objects' in arg) ||
            (Array.isArray(arg.objects) && (arg.objects as unknown[]).every(isStandardRoomObjectData))
    )
}

import { EditWrappedStandardNode, StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";
import { SchemaImageTag } from "@tonylb/mtw-base/ts/schema/image";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";
import { FacetListData } from "../../keys/abstract";
import { isSituationProseFacetPayload, type SituationProseFacetPayloadType } from "../../keys/facets/situationRoom";

/** Ephemera wire: prose from `<Render>`; same JSON shape as Situation prose facet payload. */
export type StandardCharacterRenderData = SituationProseFacetPayloadType

export type StandardCharacterData = {
    tag: 'Character';
    shortName?: StandardEditableData<string>;
    pronouns?: StandardEditableData<string>;
    displayName?: StandardEditableData<string>;
    image?: EditWrappedStandardNode<SchemaImageTag, SchemaTag>;
    situations?: FacetListData<SituationProseFacetPayloadType>;
    /** Ephemera wire: resolved DisplayName / Summary / Description from `<Render>`. */
    render?: StandardCharacterRenderData;
} & StandardBaseData

const isStandardCharacterRenderData = (x: unknown): x is StandardCharacterRenderData => (
    typeof x === 'object'
    && x !== null
    && isSituationProseFacetPayload(x)
    && checkTypes(x as Record<string, unknown>, {}, {
        displayName: 'literal',
        summary: 'renderTree',
        description: 'renderTree',
    })
)

export const isStandardCharacterData = (arg: any): arg is StandardCharacterData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Character'),
        checkTypes(arg, {},
        {
            key: 'key',
            universalKey: 'string',
            shortName: 'literal',
            pronouns: 'literal',
            displayName: 'literal',
            image: 'node',
            situations: 'facetList',
        }),
        !('render' in arg) ||
            isStandardCharacterRenderData(arg.render)
    )
}
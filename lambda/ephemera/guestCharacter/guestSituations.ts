import type { FacetListData } from '@tonylb/mtw-wml/ts/standardize/keys/abstract'
import type { SituationProseFacetPayloadType } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import { DEFAULT_SITUATION_EPHEMERA_ID } from '../dataSource/renderCache/selectDefaultSituationCacheRecord'

/** Shared coyote prose. `displayName` is per-guest, so the facet is built rather than a constant. */
const GUEST_COYOTE_SUMMARY = 'A scraggly coyote.'
const GUEST_COYOTE_DESCRIPTION = 'A scraggly coyote with a hungry, cunning look in their eye.'

/**
 * `SITUATION#DEFAULT` prose facet for a guest character.
 *
 * All three of displayName/summary/description are supplied deliberately: `<Render>`'s content
 * model requires exactly the DisplayName/Summary/Description triplet with a non-empty DisplayName
 * (enforced in `schema/converters/components.ts`'s `finalize` and again in Character's and Room's
 * standardize consumers), and `toProseTripletChildren` emits only the fields that are present ---
 * so a description-only payload round-trips into a one-child `<Render>` that fails to reparse.
 * `displayName` is also the only source of the character's name on the render channel:
 * `characterRenderWmlFromCacheRecord` puts no `displayName` on the Character row itself, so
 * without it the client falls back to "Unknown".
 */
export const guestCoyoteSituations = (guestName: string): FacetListData<SituationProseFacetPayloadType> => [{
    reference: DEFAULT_SITUATION_EPHEMERA_ID,
    payload: {
        displayName: guestName,
        summary: [GUEST_COYOTE_SUMMARY],
        description: [GUEST_COYOTE_DESCRIPTION],
    },
}]

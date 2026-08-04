import type { FacetListData } from '@tonylb/mtw-wml/ts/standardize/keys/abstract'
import type { SituationProseFacetPayloadType } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import { DEFAULT_SITUATION_EPHEMERA_ID } from '../dataSource/renderCache/selectDefaultSituationCacheRecord'

export const GUEST_COYOTE_SITUATIONS: FacetListData<SituationProseFacetPayloadType> = [{
    reference: DEFAULT_SITUATION_EPHEMERA_ID,
    payload: {
        description: ['A scraggly coyote with a hungry, cunning look in their eye.'],
    },
}]

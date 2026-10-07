import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ObjectManipulationCatalogEntry } from '../catalogMerge'
import { planSkeleton } from '../plan/planSkeleton'
import { buildIdentityOnlyFallbackPrompt } from './buildIdentityOnlyFallbackPrompt'

describe('buildIdentityOnlyFallbackPrompt', () => {
    const catalog: ObjectManipulationCatalogEntry[] = [
        { objectId: 'OBJECT#Bag' as EphemeraObjectId, normalizedShortName: 'bag', catalogScope: 'room' },
    ]

    const takeAttempt = () => {
        const result = planSkeleton(
            [{ type: 'text', text: 'take' }, { type: 'objectSpan', span: 'the bag', stableRefKey: 'bagRef' }],
            'take the bag'
        )
        return result.attempts[0]
    }

    it('names the ranked-candidates schema in the invariant prefix', () => {
        const { invariantPrefix } = buildIdentityOnlyFallbackPrompt('take the bag', {
            rawObjectSpan: 'the bag',
            catalog,
            attempt: takeAttempt(),
        })
        expect(invariantPrefix).toContain('"candidates"')
        expect(invariantPrefix).toContain('confidence')
    })

    it('includes the span, catalog, and the resolved operation in the dynamic suffix', () => {
        const { dynamicSuffix } = buildIdentityOnlyFallbackPrompt('take the bag', {
            rawObjectSpan: 'the bag',
            catalog,
            attempt: takeAttempt(),
        })
        expect(dynamicSuffix).toContain('take the bag')
        expect(dynamicSuffix).toContain('"the bag"')
        expect(dynamicSuffix).toContain('OBJECT#Bag')
        expect(dynamicSuffix).toContain('transferMembership')
    })
})

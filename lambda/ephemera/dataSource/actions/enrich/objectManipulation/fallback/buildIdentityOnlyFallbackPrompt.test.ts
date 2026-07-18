import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ObjectManipulationCatalogEntry } from '../catalogMerge'
import { buildIdentityOnlyFallbackPrompt } from './buildIdentityOnlyFallbackPrompt'

describe('buildIdentityOnlyFallbackPrompt', () => {
    const catalog: ObjectManipulationCatalogEntry[] = [
        { objectId: 'OBJECT#Bag' as EphemeraObjectId, normalizedShortName: 'bag', catalogScope: 'room' },
    ]

    it('names the ranked-candidates schema in the invariant prefix', () => {
        const { invariantPrefix } = buildIdentityOnlyFallbackPrompt('take the bag', {
            rawObjectSpan: 'the bag',
            catalog,
            operationKind: 'takeHold',
        })
        expect(invariantPrefix).toContain('"candidates"')
        expect(invariantPrefix).toContain('confidence')
    })

    it('includes the span, catalog, and operationKind in the dynamic suffix', () => {
        const { dynamicSuffix } = buildIdentityOnlyFallbackPrompt('take the bag', {
            rawObjectSpan: 'the bag',
            catalog,
            operationKind: 'takeHold',
        })
        expect(dynamicSuffix).toContain('take the bag')
        expect(dynamicSuffix).toContain('"the bag"')
        expect(dynamicSuffix).toContain('OBJECT#Bag')
        expect(dynamicSuffix).toContain('takeHold')
    })
})

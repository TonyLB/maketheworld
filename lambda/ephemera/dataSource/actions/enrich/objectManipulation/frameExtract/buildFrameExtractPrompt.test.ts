import { buildManipulationFrameExtractPrompt } from './buildFrameExtractPrompt'

describe('buildManipulationFrameExtractPrompt', () => {
    it('includes command, spans, and catalog in dynamic suffix', () => {
        const parts = buildManipulationFrameExtractPrompt({
            command: 'put broom on table',
            rawObjectSpans: ['broom'],
            verbClass: 'release',
            roomObjectCatalog: [{ objectId: 'OBJECT#Broom', normalizedShortName: 'broom' }],
        })

        expect(parts.invariantPrefix).toContain('subjectSpan')
        expect(parts.invariantPrefix).toContain('Forbidden fields')
        expect(parts.invariantPrefix).toContain('objectId')
        expect(parts.dynamicSuffix).toContain('put broom on table')
        expect(parts.dynamicSuffix).toContain('["broom"]')
        expect(parts.dynamicSuffix).toContain('OBJECT#Broom')
    })
})

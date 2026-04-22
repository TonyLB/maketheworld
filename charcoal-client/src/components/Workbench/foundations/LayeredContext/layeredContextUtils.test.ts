import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { getLayeredContext, isReferenceListChild } from './layeredContextUtils'

describe('layeredContextUtils Room Example refactor slice', () => {
    const standardForm = new StandardForm(deIndentWML(`
        <Asset uuid=(test)>
            <Room key=(room1) uuid=(ROOM#room1)>
                <Situation key=(bright) uuid=(SITUATION#bright) />
                <Guidance key=(guide1) uuid=(GUIDANCE#guide1) />
                <Example key=(roomExample) uuid=(EXAMPLE#roomExample) />
            </Room>
            <Feature key=(feature1) uuid=(FEATURE#feature1)>
                <Example key=(featureExample) uuid=(EXAMPLE#featureExample) />
            </Feature>
            <Knowledge key=(knowledge1) uuid=(KNOWLEDGE#knowledge1)>
                <Example key=(knowledgeExample) uuid=(EXAMPLE#knowledgeExample) />
            </Knowledge>
            <Situation key=(bright) uuid=(SITUATION#bright) />
            <Guidance key=(guide1) uuid=(GUIDANCE#guide1) />
            <Example key=(roomExample) uuid=(EXAMPLE#roomExample) />
            <Example key=(featureExample) uuid=(EXAMPLE#featureExample) />
            <Example key=(knowledgeExample) uuid=(EXAMPLE#knowledgeExample) />
        </Asset>
    `))

    it('keeps Room Situation facet path layered', () => {
        const layered = getLayeredContext(standardForm, [
            { id: 'ROOM#room1', kind: 'component', componentId: 'ROOM#room1' },
            { id: 'SITUATION#bright', kind: 'component', componentId: 'SITUATION#bright' }
        ])
        expect(layered?.tag).toBe('SituationFacet')
    })

    it('keeps Room Guidance path layered', () => {
        const layered = getLayeredContext(standardForm, [
            { id: 'ROOM#room1', kind: 'component', componentId: 'ROOM#room1' },
            { id: 'GUIDANCE#guide1', kind: 'component', componentId: 'GUIDANCE#guide1' }
        ])
        expect(layered?.tag).toBe('Guidance')
        expect(isReferenceListChild(standardForm, 'ROOM#room1', 'GUIDANCE#guide1')).toBe(true)
    })

    it('removes Room Example path from layered membership', () => {
        const layered = getLayeredContext(standardForm, [
            { id: 'ROOM#room1', kind: 'component', componentId: 'ROOM#room1' },
            { id: 'EXAMPLE#roomExample', kind: 'component', componentId: 'EXAMPLE#roomExample' }
        ])
        expect(layered).toBeNull()
        expect(isReferenceListChild(standardForm, 'ROOM#room1', 'EXAMPLE#roomExample')).toBe(false)
    })

    it('preserves Feature and Knowledge Example membership', () => {
        expect(isReferenceListChild(standardForm, 'FEATURE#feature1', 'EXAMPLE#featureExample')).toBe(true)
        expect(isReferenceListChild(standardForm, 'KNOWLEDGE#knowledge1', 'EXAMPLE#knowledgeExample')).toBe(true)
    })
})

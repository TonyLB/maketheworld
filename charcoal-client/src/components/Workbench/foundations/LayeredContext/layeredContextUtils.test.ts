import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { getLayeredContext, isReferenceListChild } from './layeredContextUtils'

describe('layeredContextUtils Room Example refactor slice', () => {
    const standardForm = new StandardForm(deIndentWML(`
        <Asset uuid=(test)>
            <Room key=(room1) uuid=(ROOM#room1)>
                <Situation key=(bright) uuid=(SITUATION#bright) />
                <Guidance key=(guide1) uuid=(GUIDANCE#guide1) />
            </Room>
            <Feature key=(feature1) uuid=(FEATURE#feature1)>
                <Situation uuid=(DEFAULT) />
            </Feature>
            <Knowledge key=(knowledge1) uuid=(KNOWLEDGE#knowledge1)>
                <Situation uuid=(DEFAULT) />
            </Knowledge>
            <Situation key=(bright) uuid=(SITUATION#bright) />
            <Situation uuid=(DEFAULT) />
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

    it('removes Feature and Knowledge Example membership', () => {
        expect(isReferenceListChild(standardForm, 'FEATURE#feature1', 'EXAMPLE#featureExample')).toBe(false)
        expect(isReferenceListChild(standardForm, 'KNOWLEDGE#knowledge1', 'EXAMPLE#knowledgeExample')).toBe(false)
        expect(getLayeredContext(standardForm, [
            { id: 'FEATURE#feature1', kind: 'component', componentId: 'FEATURE#feature1' },
            { id: 'EXAMPLE#featureExample', kind: 'component', componentId: 'EXAMPLE#featureExample' }
        ])).toBeNull()
        expect(getLayeredContext(standardForm, [
            { id: 'KNOWLEDGE#knowledge1', kind: 'component', componentId: 'KNOWLEDGE#knowledge1' },
            { id: 'EXAMPLE#knowledgeExample', kind: 'component', componentId: 'EXAMPLE#knowledgeExample' }
        ])).toBeNull()
    })

    it('does not layer Feature or Knowledge Situation facets', () => {
        expect(getLayeredContext(standardForm, [
            { id: 'FEATURE#feature1', kind: 'component', componentId: 'FEATURE#feature1' },
            { id: 'SITUATION#DEFAULT', kind: 'component', componentId: 'SITUATION#DEFAULT' }
        ])).toBeNull()
        expect(getLayeredContext(standardForm, [
            { id: 'KNOWLEDGE#knowledge1', kind: 'component', componentId: 'KNOWLEDGE#knowledge1' },
            { id: 'SITUATION#DEFAULT', kind: 'component', componentId: 'SITUATION#DEFAULT' }
        ])).toBeNull()
    })
})

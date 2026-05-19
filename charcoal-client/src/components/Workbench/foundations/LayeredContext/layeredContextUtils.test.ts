import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { getLayeredContext, isReferenceListChild } from './layeredContextUtils'

describe('layeredContextUtils situation facet slice', () => {
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

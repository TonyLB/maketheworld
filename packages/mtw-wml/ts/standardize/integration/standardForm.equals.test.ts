import { Schema, schemaToWML, treeFromWML } from '../../schema'
import { StandardForm } from '..'
import { deIndentWML } from '../../schema/utils'
import { GenericTreeNode } from '@tonylb/mtw-base/ts/genericTree'
import { SchemaTag } from '@tonylb/mtw-base/ts/schema'
import StandardRoom from '../components/room'
import StandardKnowledge from '../components/knowledge'
import StandardCharacter from '../components/character'
import { ReferenceList } from '../keys/referenceList'
import StandardReference from '../keys/reference'
import { StandardKey } from '../keys/key'
import StandardFeature from '../components/feature'
import StandardSituation from '../components/situation'
import { StandardLiteral } from '../literal'
import StandardMap from '../components/map'
import StandardMark, { StandardLens } from '../components/worldState'
import { StandardMarkFacet } from '../keys/facets/mark'
import { StandardExplicitKey } from '../explicit/key'
import { isStandardForm, isStandardFormInput, StandardFormData } from '../components/dataTypes'

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})


describe('StandardForm', () => {
    describe('equals()', () => {
        it('returns true for identical forms', () => {
            const left = new StandardForm(deIndentWML(`
                <Asset uuid=(TestAsset)>
                    <Room uuid=(room1) key=(room1)>
                        <ShortName>Room One</ShortName>
                    </Room>
                </Asset>
            `))
            const right = new StandardForm(deIndentWML(`
                <Asset uuid=(TestAsset)>
                    <Room uuid=(room1) key=(room1)>
                        <ShortName>Room One</ShortName>
                    </Room>
                </Asset>
            `))
            expect(left.equals(right)).toBe(true)
        })

        it('returns false when an unrelated component differs', () => {
            const left = new StandardForm(deIndentWML(`
                <Asset uuid=(TestAsset)>
                    <Room uuid=(room1) key=(room1) />
                    <Feature uuid=(feature1) key=(feature1)>
                        <ShortName>Base Feature</ShortName>
                    </Feature>
                </Asset>
            `))
            const right = new StandardForm(deIndentWML(`
                <Asset uuid=(TestAsset)>
                    <Room uuid=(room1) key=(room1) />
                    <Feature uuid=(feature1) key=(feature1)>
                        <ShortName>Changed Feature</ShortName>
                    </Feature>
                </Asset>
            `))
            expect(left.equals(right)).toBe(false)
        })

        it('treats vacuous optional metadata as equal', () => {
            const left = new StandardForm({
                universalKey: 'ASSET#TestAsset',
                metaData: [],
                components: [],
                shortName: '',
                summary: [],
                topLevel: []
            })
            const right = new StandardForm({
                universalKey: 'ASSET#TestAsset',
                metaData: [],
                components: []
            })
            expect(left.equals(right)).toBe(true)
        })

        it('treats metadata ordering as non-semantic', () => {
            const left = new StandardForm('ASSET#TestAsset')
            const right = new StandardForm('ASSET#TestAsset')
            ;(left as any)._metaData = [
                { data: { tag: 'Import', from: 'ASSET#alpha' }, children: [] },
                { data: { tag: 'Import', from: 'ASSET#beta' }, children: [] }
            ]
            ;(right as any)._metaData = [
                { data: { tag: 'Import', from: 'ASSET#beta' }, children: [] },
                { data: { tag: 'Import', from: 'ASSET#alpha' }, children: [] }
            ]
            expect(left.equals(right)).toBe(true)
        })

        it('supports optimizeByUniversalKey with parity to default comparison', () => {
            const left = new StandardForm(deIndentWML(`
                <Asset uuid=(TestAsset)>
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) />
                    </Room>
                    <Feature uuid=(feature1) key=(feature1) />
                </Asset>
            `))
            const right = new StandardForm(deIndentWML(`
                <Asset uuid=(TestAsset)>
                    <Feature uuid=(feature1) key=(feature1) />
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) />
                    </Room>
                </Asset>
            `))
            expect(left.equals(right)).toBe(true)
            expect(left.equals(right, { optimizeByUniversalKey: true })).toBe(true)
        })

        it('falls back to full comparison when optimizeByUniversalKey preconditions fail', () => {
            const left = new StandardForm(deIndentWML(`
                <Asset uuid=(TestAsset)>
                    <Room key=(room1)>
                        <ShortName>Room One</ShortName>
                    </Room>
                </Asset>
            `))
            const right = new StandardForm(deIndentWML(`
                <Asset uuid=(TestAsset)>
                    <Room key=(room1)>
                        <ShortName>Room Two</ShortName>
                    </Room>
                </Asset>
            `))
            expect(left.equals(right)).toBe(false)
            expect(left.equals(right, { optimizeByUniversalKey: true })).toBe(false)
        })
    })
})

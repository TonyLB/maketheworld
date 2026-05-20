import { Schema, schemaToWML, treeFromWML } from '../../schema'
import { StandardForm, hasShortName } from '..'
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
    describe('isEmpty()', () => {
        it('returns true for empty asset with only universalKey', () => {
            const sf = new StandardForm('ASSET#TestAsset')
            expect(sf.isEmpty()).toBe(true)
        })

        it('returns false when components are present', () => {
            const sf = new StandardForm(`<Asset uuid=(TestAsset)>
                <Room key=(MAIN) />
            </Asset>`)
            expect(sf.isEmpty()).toBe(false)
        })

        it('returns false when ShortName is present without components', () => {
            const sf = new StandardForm(`<Asset uuid=(TestAsset)>
                <ShortName>My Draft</ShortName>
            </Asset>`)
            expect(sf.isEmpty()).toBe(false)
        })

        it('returns false when Summary is present without components', () => {
            const sf = new StandardForm(`<Asset uuid=(TestAsset)>
                <Summary>Some description</Summary>
            </Asset>`)
            expect(sf.isEmpty()).toBe(false)
        })

        it('returns true when Summary is semantically empty', () => {
            const sf = new StandardForm({
                universalKey: 'ASSET#TestAsset',
                metaData: [],
                components: [],
                summary: []
            })
            expect(sf.summary?.isEmpty()).toBe(true)
            expect(sf.isEmpty()).toBe(true)
        })

        it('returns false when Summary is non-empty from data input', () => {
            const sf = new StandardForm({
                universalKey: 'ASSET#TestAsset',
                metaData: [],
                components: [],
                summary: ['Some description']
            })
            expect(sf.summary?.isEmpty()).toBe(false)
            expect(sf.isEmpty()).toBe(false)
        })

        it('returns true when ShortName is semantically empty', () => {
            const sf = new StandardForm('ASSET#TestAsset')
            ;(sf as any)._shortName = new StandardLiteral('', { tag: 'ShortName' })
            expect(sf.shortName?.isEmpty()).toBe(true)
            expect(sf.isEmpty()).toBe(true)
        })

        it('returns true with explicitly empty topLevel reference list', () => {
            const sf = new StandardForm('ASSET#TestAsset')
            ;(sf as any)._topLevel = new ReferenceList([])
            expect(sf.isEmpty()).toBe(true)
        })

        it('returns false with non-empty topLevel reference list', () => {
            const sf = new StandardForm('ASSET#TestAsset')
            ;(sf as any)._topLevel = new ReferenceList([
                new StandardReference({ tag: 'Room', universalKey: 'ROOM#main' })
            ])
            expect(sf.isEmpty()).toBe(false)
        })

        it('returns true when all components are semantically empty', () => {
            const sf = new StandardForm('ASSET#TestAsset')
            ;(sf as any)._components = [{ isEmpty: () => true }]
            expect(sf.isEmpty()).toBe(true)
        })

        it('returns false when at least one component is non-empty', () => {
            const sf = new StandardForm('ASSET#TestAsset')
            ;(sf as any)._components = [{ isEmpty: () => true }, { isEmpty: () => false }]
            expect(sf.isEmpty()).toBe(false)
        })

        it('returns true when metadata and components are all vacuous', () => {
            const sf = new StandardForm({
                universalKey: 'ASSET#TestAsset',
                metaData: [],
                components: [],
                summary: []
            })
            ;(sf as any)._shortName = new StandardLiteral('', { tag: 'ShortName' })
            ;(sf as any)._topLevel = new ReferenceList([])
            ;(sf as any)._components = [{ isEmpty: () => true }]
            expect(sf.isEmpty()).toBe(true)
        })
    })
})

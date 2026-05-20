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
    describe('referencedBy', () => {
        it('returns empty array when component has no referrers', () => {
            const form = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                </Asset>
            `))

            const room1Ref = new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' })
            const result = form.referencedBy(room1Ref)

            expect(result).toEqual([])
        })

        it('returns referrers for Direct references', () => {
            const form = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Feature uuid=(feature1) key=(feature1) />
                    <Room uuid=(room1) key=(room1)>
                        <Feature key=(feature1) />
                    </Room>
                </Asset>
            `))

            const feature1Ref = new StandardReference({ tag: 'Feature', key: 'feature1', universalKey: 'FEATURE#feature1' })
            const result = form.referencedBy(feature1Ref)

            expect(result.length).toBe(1)
            expect(result[0].sameKey(new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' }))).toBe(true)
        })

        it('returns multiple referrers when component is shared', () => {
            const form = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Feature uuid=(feature1) key=(feature1) />
                    <Room uuid=(room1) key=(room1)>
                        <Feature key=(feature1) />
                    </Room>
                    <Room uuid=(room2) key=(room2)>
                        <Feature key=(feature1) />
                    </Room>
                </Asset>
            `))

            const feature1Ref = new StandardReference({ tag: 'Feature', key: 'feature1', universalKey: 'FEATURE#feature1' })
            const result = form.referencedBy(feature1Ref)

            expect(result.length).toBe(2)
            expect(result.some(r => r.sameKey(new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' })))).toBe(true)
            expect(result.some(r => r.sameKey(new StandardReference({ tag: 'Room', key: 'room2', universalKey: 'ROOM#room2' })))).toBe(true)
        })

        it('returns empty array when target is not in form', () => {
            const form = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(room1) key=(room1) />
                    <Room uuid=(room2) key=(room2) />
                </Asset>
            `))

            const nonExistentRef = new StandardReference({ tag: 'Feature', key: 'nonexistent', universalKey: 'FEATURE#nonexistent' })
            const result = form.referencedBy(nonExistentRef)

            expect(result).toEqual([])
        })

        it('matches by universalKey when key differs', () => {
            const form = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Feature uuid=(feature1) />
                    <Room uuid=(room1) key=(room1)>
                        <Feature uuid=(feature1) />
                    </Room>
                </Asset>
            `))

            const feature1RefByUniversalKey = new StandardReference({ tag: 'Feature', universalKey: 'FEATURE#feature1' })
            const result = form.referencedBy(feature1RefByUniversalKey)

            expect(result.length).toBe(1)
            expect(result[0].sameKey(new StandardReference({ tag: 'Room', key: 'room1', universalKey: 'ROOM#room1' }))).toBe(true)
        })
    })
})

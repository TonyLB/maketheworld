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
    describe('assureComponents method', () => {
        it('should add missing referenced components as empty components', () => {
            const form = new StandardForm(`<Asset uuid=(test)><Room uuid=(room1) key=(room1) /></Asset>`)
            const references = new ReferenceList([
                new StandardReference({ tag: 'Feature', key: 'feature1', universalKey: 'FEATURE#feature1' })
            ])
            const result = form.assureComponents(references)
            const feature = result._lookup('FEATURE#feature1')
            expect(feature).toBeDefined()
            expect(feature?.universalKey).toBe('FEATURE#feature1')
            expect(feature?.key).toBe('feature1')
        })

        it('should not duplicate components that already exist', () => {
            const form = new StandardForm(`<Asset uuid=(test)><Room uuid=(room1) key=(room1) /><Feature uuid=(feature1) key=(feature1) /></Asset>`)
            const originalComponentCount = form._components.length
            const references = new ReferenceList([
                new StandardReference({ tag: 'Feature', key: 'feature1', universalKey: 'FEATURE#feature1' })
            ])
            const result = form.assureComponents(references)
            expect(result._components.length).toBe(originalComponentCount)
            const feature = result._lookup('FEATURE#feature1')
            expect(feature).toBeDefined()
        })

        it('should handle references with both key and universalKey', () => {
            const form = new StandardForm(`<Asset uuid=(test)><Room uuid=(room1) key=(room1) /></Asset>`)
            const references = new ReferenceList([
                new StandardReference({ tag: 'Feature', key: 'feature1', universalKey: 'FEATURE#feature1' })
            ])
            const result = form.assureComponents(references)
            const feature = result._lookup('FEATURE#feature1')
            expect(feature).toBeDefined()
            expect(feature?.key).toBe('feature1')
            expect(feature?.universalKey).toBe('FEATURE#feature1')
        })

        it('should handle references with only universalKey', () => {
            const form = new StandardForm(`<Asset uuid=(test)><Room uuid=(room1) key=(room1) /></Asset>`)
            const references = new ReferenceList([
                new StandardReference({ tag: 'Feature', universalKey: 'FEATURE#feature1' })
            ])
            const result = form.assureComponents(references)
            const feature = result._lookup('FEATURE#feature1')
            expect(feature).toBeDefined()
            expect(feature?.universalKey).toBe('FEATURE#feature1')
        })

        it('should handle references with only key', () => {
            const form = new StandardForm(`<Asset uuid=(test)><Room uuid=(room1) key=(room1) /></Asset>`)
            const references = new ReferenceList([
                new StandardReference({ tag: 'Feature', key: 'feature1' })
            ])
            const result = form.assureComponents(references)
            const feature = result._lookup({ key: 'feature1' })
            expect(feature).toBeDefined()
            expect(feature?.key).toBe('feature1')
        })

        it('should return a new StandardForm and not mutate the original', () => {
            const form = new StandardForm(`<Asset uuid=(test)><Room uuid=(room1) key=(room1) /></Asset>`)
            const originalComponentCount = form._components.length
            const references = new ReferenceList([
                new StandardReference({ tag: 'Feature', key: 'feature1', universalKey: 'FEATURE#feature1' })
            ])
            const result = form.assureComponents(references)
            expect(result).not.toBe(form)
            expect(form._components.length).toBe(originalComponentCount)
            expect(result._components.length).toBe(originalComponentCount + 1)
        })

        it('should handle multiple references in a ReferenceList', () => {
            const form = new StandardForm(`<Asset uuid=(test)><Room uuid=(room1) key=(room1) /></Asset>`)
            const references = new ReferenceList([
                new StandardReference({ tag: 'Feature', key: 'feature1', universalKey: 'FEATURE#feature1' }),
                new StandardReference({ tag: 'Character', key: 'char1', universalKey: 'CHARACTER#char1' })
            ])
            const result = form.assureComponents(references)
            expect(result._components.length).toBe(3) // room1, feature1, char1
            const feature = result._lookup('FEATURE#feature1')
            const character = result._lookup('CHARACTER#char1')
            expect(feature).toBeDefined()
            expect(character).toBeDefined()
        })
    })
})

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
    describe('finalize', () => {
        it('should add UUID on finalize', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Room key=(testRoom) />
                </Asset>
            `)
            expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)><Room key=(testRoom) /></Asset>
            `))
            const finalized = test.finalize()
            expect(schemaToWML([finalized.schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)><Room uuid=(mock-uuid-1) key=(testRoom) /></Asset>
            `))
            expect(finalized.byId.testRoom.universalKey).toEqual('ROOM#mock-uuid-1')
        })

        it('should remap references to UUIDs on finalize', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Feature uuid=(testFeature) key=(testFeature) />
                    <Room uuid=(testRoom) key=(testRoom)>
                        <Feature key=(testFeature) />
                    </Room>
                </Asset>
            `)
            const test = new StandardForm(testWML).finalize()
            const findRoom = test._lookup('ROOM#testRoom')
            expect(findRoom).toBeInstanceOf(StandardRoom)
            expect((findRoom as StandardRoom).features?.toJSON()).toEqual([
                'FEATURE#testFeature'
            ])
        })

        it('should return correct instance types from _lookup', () => {
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(testRoom) key=(testRoom)>
                        <Situation ref={0} uuid=(testExample) key=(testExample)>
                            <DisplayName>Test Room</DisplayName>
                            <Description>Test room description</Description>
                        </Situation>
                    </Room>
                </Asset>
            `)
            const test = new StandardForm(testWML).finalize()
            
            // Test that _lookup returns the correct instance types
            const foundRoom = test._lookup('ROOM#testRoom')
            expect(foundRoom).toBeInstanceOf(StandardRoom)
            
            const foundSituation = test._lookup('SITUATION#testExample')
            expect(foundSituation).toBeInstanceOf(StandardSituation)
        })

    })
})

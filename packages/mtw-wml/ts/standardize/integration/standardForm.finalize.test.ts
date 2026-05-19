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

        it('should integrate characters with rooms in StandardForm.schema scenarios', () => {
            // Create a complex scenario with characters defined both as separate components
            // and as sub-components of rooms
            const testWML = deIndentWML(`
                <Asset uuid=(test)>
                    <Character uuid=(char1) key=(char1)>
                        <ShortName>Alice</ShortName>
                        <DisplayName>Alice</DisplayName>
                    </Character>
                    <Character uuid=(char2) key=(char2)>
                        <ShortName>Bob</ShortName>
                        <DisplayName>Bob</DisplayName>
                    </Character>
                    <Room uuid=(room1) key=(room1)>
                        <Character key=(char3)>
                            <ShortName>Charlie</ShortName>
                            <DisplayName>Charlie</DisplayName>
                        </Character>
                        <Character uuid=(char1) />
                    </Room>
                    <Room uuid=(room2) key=(room2)>
                        <Character uuid=(char2) />
                        <Character key=(char4)>
                            <ShortName>David</ShortName>
                            <DisplayName>David</DisplayName>
                        </Character>
                    </Room>
                </Asset>
            `)
            const test = new StandardForm(testWML).finalize()
            
            // Test that characters are correctly parsed and stored
            const room1 = test._lookup('ROOM#room1') as StandardRoom
            const room2 = test._lookup('ROOM#room2') as StandardRoom
            const char1 = test._lookup('CHARACTER#char1') as StandardCharacter
            const char2 = test._lookup('CHARACTER#char2') as StandardCharacter
            
            expect(room1).toBeInstanceOf(StandardRoom)
            expect(room2).toBeInstanceOf(StandardRoom)
            expect(char1).toBeInstanceOf(StandardCharacter)
            expect(char2).toBeInstanceOf(StandardCharacter)
            
            // Test that rooms have the correct character references
            expect(room1.characters).toBeDefined()
            expect(room1.characters!.payload.length).toBe(2)
            expect(room2.characters).toBeDefined()
            expect(room2.characters!.payload.length).toBe(2)
            
            // Test that character references include both local and universal keys
            const room1CharKeys = room1.characters!.payload.map(ref => ref.key || ref.universalKey)
            const room2CharKeys = room2.characters!.payload.map(ref => ref.key || ref.universalKey)
            
            expect(room1CharKeys).toContain('char3') // Local character in room1
            expect(room1CharKeys).toContain('CHARACTER#char1') // Universal character reference in room1
            expect(room2CharKeys).toContain('CHARACTER#char2') // Universal character reference in room2
            expect(room2CharKeys).toContain('char4') // Local character in room2
            
            // Test that StandardForm.schema includes character references in room contexts
            const schemaWML = schemaToWML([test.schema])
            
            // Verify that the schema includes character references within room contexts
            // Note: StandardForm.schema includes full character content, not just references
            expect(schemaWML).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Character uuid=(char1) key=(char1)>
                        <ShortName>Alice</ShortName>
                        <DisplayName>Alice</DisplayName>
                    </Character>
                    <Character uuid=(char2) key=(char2)>
                        <ShortName>Bob</ShortName>
                        <DisplayName>Bob</DisplayName>
                    </Character>
                    <Room uuid=(room1) key=(room1)>
                        <Character key=(char1) />
                        <Character uuid=(mock-uuid-1) key=(char3)>
                            <ShortName>Charlie</ShortName>
                            <DisplayName>Charlie</DisplayName>
                        </Character>
                    </Room>
                    <Room uuid=(room2) key=(room2)>
                        <Character key=(char2) />
                        <Character uuid=(mock-uuid-2) key=(char4)>
                            <ShortName>David</ShortName>
                            <DisplayName>David</DisplayName>
                        </Character>
                    </Room>
                </Asset>
            `))
            
        })
    })
})

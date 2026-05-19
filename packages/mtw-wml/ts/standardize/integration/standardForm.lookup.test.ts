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
    describe('byId', () => {
        it('should update a component byId', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Room key=(testRoom) />
                </Asset>
            `)
            expect(test.byId.testRoom).toBeInstanceOf(StandardRoom)
            const room = test.byId.testRoom.clone() as StandardRoom
            room._payload._shortName = new StandardLiteral('Updated Room', { tag: 'ShortName' })
            test.byId.testRoom = room
            expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Room key=(testRoom)><ShortName>Updated Room</ShortName></Room>
                </Asset>
            `))
        })

        it('should add a component byId', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Room key=(testRoom) />
                </Asset>
            `)
            test.byId.testFeature = new StandardFeature(`<Feature uuid=(testFeature) key=(testFeature) />`)
            expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Feature uuid=(testFeature) key=(testFeature) ref={0} />
                    <Room key=(testRoom) />
                </Asset>
            `))
        })
    })

    describe('byUniversalId', () => {
        it('should update a component byUniversalId', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Room uuid=(testRoom) key=(testRoom) />
                </Asset>
            `)
            expect(test.byUniversalId[`ROOM#testRoom`]).toBeInstanceOf(StandardRoom)
            const room = test.byUniversalId[`ROOM#testRoom`].clone() as StandardRoom
            room._payload._shortName = new StandardLiteral('Updated Room', { tag: 'ShortName' })
            test.byUniversalId[`ROOM#testRoom`] = room
            expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Room uuid=(testRoom) key=(testRoom)>
                        <ShortName>Updated Room</ShortName>
                    </Room>
                </Asset>
            `))
        })

        it('should add a component byUniversalId', () => {
            const test = new StandardForm(`
                <Asset uuid=(test)>
                    <Room uuid=(testRoom) key=(testRoom) />
                </Asset>
            `)
            test.byUniversalId[`FEATURE#testFeature`] = new StandardFeature(`<Feature uuid=(testFeature) key=(testFeature) />`)
            expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                <Asset uuid=(test)>
                    <Feature uuid=(testFeature) key=(testFeature) ref={0} />
                    <Room uuid=(testRoom) key=(testRoom) />
                </Asset>
            `))
        })
    })
})

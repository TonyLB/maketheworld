import { Schema, schemaToWML } from ".."
import { deIndentWML } from "../utils"
import { selectMapRooms } from './mapRooms'

describe('render selector', () => {
    it('should select a rooms from a map', () => {
        const testSchema = new Schema()
        testSchema.loadWML(`
            <Asset key=(testOne)>
                <Room key=(room1)>
                    <Name>Test room</Name>
                    <Description>
                        TestZero
                    </Description>
                </Room>
                <Room key=(room2) />
                <Map key=(testMap)>
                    <Name>Test Map</Name>
                    <Room key=(room1)><Position x="0" y="0" /></Room>
                </Map>
                <If {true}>
                    <Map key=(testMap)>
                        <Room key=(room2)><Position x="100" y="0" /></Room>
                    </Map>
                </If>
            </Asset>
        `)
        expect(schemaToWML(selectMapRooms(testSchema.schema, { tag: 'Map', key: 'testMap' }))).toEqual(deIndentWML(`
            <Room key=(room1)><Position x="0" y="0" /></Room>
            <If {true}><Room key=(room2)><Position x="100" y="0" /></Room></If>
        `))
    })

})

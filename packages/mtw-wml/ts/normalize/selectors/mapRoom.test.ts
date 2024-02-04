import Normalizer from ".."
import { schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { selectMapRooms } from './mapRooms'

describe('render selector', () => {
    it('should select a rooms from a map', () => {
        const testOne = new Normalizer()
        testOne.loadWML(`
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
        expect(schemaToWML(testOne.select({ key: 'testMap', selector: selectMapRooms }))).toEqual(deIndentWML(`
            <Room key=(room1)><Position x="0" y="0" /></Room>
            <If {true}><Room key=(room2)><Position x="100" y="0" /></Room></If>
        `))
    })

})

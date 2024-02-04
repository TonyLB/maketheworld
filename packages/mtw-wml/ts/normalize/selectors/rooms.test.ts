import Normalizer from ".."
import { schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { selectRooms } from './rooms'

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
                    <Room key=(room1) x="0" y="0" />
                </Map>
                <If {true}>
                    <Map key=(testMap)>
                        <Room key=(room2) x="100" y="0" />
                    </Map>
                </If>
            </Asset>
        `)
        expect(schemaToWML(testOne.select({ key: 'testMap', selector: selectRooms }))).toEqual(deIndentWML(`
            <Room key=(room1) x="0" y="0" />
            <If {true}><Room key=(room2) x="100" y="0" /></If>
        `))
    })

})

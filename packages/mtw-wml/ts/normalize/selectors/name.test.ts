import Normalizer from ".."
import { schemaToWML } from "../../simpleSchema"
import { deIndentWML } from "../../simpleSchema/utils"
import { selectName } from './name'

describe('name selector', () => {
    it('should select a single key from a normalForm', () => {
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
                <If {true}>
                    <Room key=(room1)>
                        <Name>: Addendum</Name>
                    </Room>
                    <Room key=(room2)>
                        <Description>Red herring</Description>
                    </Room>
                </If>
                <Variable key=(testVar) default={false} />
            </Asset>
        `)
        expect(schemaToWML(testOne.select({ key: 'room1', selector: selectName }))).toEqual(deIndentWML(`
            Test room
            <If {true}>: Addendum</If>
        `))
    })
})

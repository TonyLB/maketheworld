import Normalizer from ".."
import { schemaToWML } from "../../simpleSchema"
import { deIndentWML } from "../../simpleSchema/utils"
import { selectRender } from './render'

describe('render selector', () => {
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
                        <Description>: Addendum</Description>
                    </Room>
                    <Room key=(room2)>
                        <Description>Red herring</Description>
                    </Room>
                </If>
                <Variable key=(testVar) default={false} />
            </Asset>
        `)
        expect(schemaToWML(testOne.select({ key: 'room1', selector: selectRender }))).toEqual(deIndentWML(`
            TestZero
            <If {true}>: Addendum</If>
        `))
    })
})

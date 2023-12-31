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

    it(`should correctly ignore wrappers that don't impact render`, () => {
        const testOne = new Normalizer()
        testOne.loadWML(`
            <Asset key=(testAsset)>
                <Room key=(test)>
                    <Description>
                        One
                        <br />
                    </Description>
                </Room>
                <Room key=(testTwo) />
                <Message key=(testMessage)>
                    Test message
                    <Room key=(test)>
                        <Description>
                            Two
                        </Description>
                        <Exit to=(testTwo)>Test Exit</Exit>
                    </Room>
                </Message>
                <Room key=(testTwo)>
                    <Exit to=(test)>Test Return</Exit>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(testOne.select({ key: 'test', selector: selectRender }))).toEqual(deIndentWML(`
            One
            <br />
            Two
        `))
    })

    it(`should correctly extract render from nested bookmarks`, () => {
        const testOne = new Normalizer()
        testOne.loadWML(`
            <Asset key=(testAsset)>
                <Bookmark key=(testOne)>
                    Test<Bookmark key=(testTwo)>Red herring</Bookmark>
                </Bookmark>
            </Asset>
        `)
        expect(schemaToWML(testOne.select({ key: 'testOne', selector: selectRender }))).toEqual(deIndentWML(`
            Test
            <Bookmark key=(testTwo) />
        `))
    })
})

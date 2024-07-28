import { Standardizer } from '../../standardize'
import { schemaToWML, Schema } from ".."
import { deIndentWML } from "../utils"
import { selectRender } from './render'

describe('render selector', () => {
    it('should select a single key from a normalForm', () => {
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
        const testOne = new Standardizer(testSchema.schema)
        expect(schemaToWML(selectRender(testOne.schema, { tag: 'Room', key: 'room1' }))).toEqual(deIndentWML(`
            TestZero
            <If {true}>: Addendum</If>
        `))
    })

    it(`should correctly ignore wrappers that don't impact render`, () => {
        const testSchema = new Schema()
        testSchema.loadWML(`
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
        const testOne = new Standardizer(testSchema.schema)
        expect(schemaToWML(selectRender(testOne.schema, { tag: 'Room', key: 'test' }))).toEqual(deIndentWML(`
            One
            <br />
            Two
        `))
    })

    it(`should correctly extract render from nested bookmarks`, () => {
        const testSchema = new Schema()
        testSchema.loadWML(`
            <Asset key=(testAsset)>
                <Bookmark key=(testOne)>
                    Test<Bookmark key=(testTwo)>Red herring</Bookmark>
                </Bookmark>
            </Asset>
        `)
        const testOne = new Standardizer(testSchema.schema)
        expect(schemaToWML(selectRender(testOne.schema, { tag: 'Bookmark', key: 'testOne' }))).toEqual(deIndentWML(`
            Test
            <Bookmark key=(testTwo) />
        `))
    })
})

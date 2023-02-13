import Normalizer from '.'
import parse from '../parser'
import tokenizer from '../parser/tokenizer'
import SourceStream from '../parser/tokenizer/sourceStream'
import { schemaFromParse, schemaToWML } from '../schema'
import { NormalForm } from './baseClasses'
import standardizeNormal from './standardize'

const normalizeTestWML = (wml: string): NormalForm => {
    const normalizer = new Normalizer()
    const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(wml))))
    normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
    return normalizer.normal
}

describe('standardizeNormal', () => {

    it('should return an empty wrapper unchanged', () => {
        const testNormal = normalizeTestWML(`<Asset key=(Test) />`)
        const normalizer = new Normalizer()
        normalizer.loadNormal(standardizeNormal(testNormal))
        expect(schemaToWML(normalizer.schema)).toEqual(`<Asset key=(Test) />`)
    })

    it('should combine descriptions in rooms and features', () => {
        const testNormal = normalizeTestWML(`<Asset key=(Test)>
            <Room key=(test)>
                <Description>
                    One
                    <br />
                </Description>
            </Room>
            <If {false}>
                <Room key=(test)>
                    <Description>
                        Two
                    </Description>
                </Room>
                <Feature key=(testFeature)>
                    <Description>
                        Three
                    </Description>
                </Feature>
            </If>
            <Room key=(test)>
                <Name>Test Room</Name>
            </Room>
        </Asset>`)
        const normalizer = new Normalizer()
        normalizer.loadNormal(standardizeNormal(testNormal))
        expect(schemaToWML(normalizer.schema)).toEqual(`<Asset key=(Test)>
    <Room key=(test)>
        <Name>Test Room</Name>
        <Description>One <br /><If {false}>Two</If></Description>
    </Room>
    <Feature key=(testFeature)>
        <Description><If {false}>Three</If></Description>
    </Feature>
</Asset>`)
    })

    it('should combine exits in rooms', () => {
        const testNormal = normalizeTestWML(`<Asset key=(Test)>
            <Room key=(test)>
                <Description>
                    One
                    <br />
                </Description>
            </Room>
            <Room key=(testTwo) />
            <If {false}>
                <Room key=(test)>
                    <Exit to=(testTwo)>Test Exit</Exit>
                </Room>
            </If>
            <Room key=(testTwo)>
                <Exit to=(test)>Test Return</Exit>
            </Room>
        </Asset>`)
        const normalizer = new Normalizer()
        normalizer.loadNormal(standardizeNormal(testNormal))
        expect(schemaToWML(normalizer.schema)).toEqual(`<Asset key=(Test)>
    <Room key=(test)>
        <Description>One <br /></Description>
        <If {false}><Exit to=(testTwo)>Test Exit</Exit></If>
    </Room>
    <Room key=(testTwo)><Exit to=(test)>Test Return</Exit></Room>
</Asset>`)
    })

    it('should combine render in nested rooms', () => {
        const testNormal = normalizeTestWML(`<Asset key=(Test)>
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
        </Asset>`)
        const normalizer = new Normalizer()
        normalizer.loadNormal(standardizeNormal(testNormal))
        expect(schemaToWML(normalizer.schema)).toEqual(`<Asset key=(Test)>
    <Room key=(test)>
        <Description>One <br />Two</Description>
        <Exit to=(testTwo)>Test Exit</Exit>
    </Room>
    <Room key=(testTwo)><Exit to=(test)>Test Return</Exit></Room>
    <Message key=(testMessage)>Test message<Room key=(test) /></Message>
</Asset>`)
    })

    it('should render bookmarks in unreferencing-first graph order', () => {
        const testNormal = normalizeTestWML(`<Asset key=(Test)>
            <Bookmark key=(testOne)>
                TestOne<Bookmark key=(testThree) />
            </Bookmark>
            <Bookmark key=(testTwo)>
                TestTwo<Bookmark key=(testOne) />
            </Bookmark>
            <Bookmark key=(testThree)>
                TestThree
            </Bookmark>
        </Asset>`)
        const normalizer = new Normalizer()
        normalizer.loadNormal(standardizeNormal(testNormal))
        expect(schemaToWML(normalizer.schema)).toEqual(`<Asset key=(Test)>
    <Bookmark key=(testThree)>TestThree</Bookmark>
    <Bookmark key=(testOne)>TestOne<Bookmark key=(testThree) /></Bookmark>
    <Bookmark key=(testTwo)>TestTwo<Bookmark key=(testOne) /></Bookmark>
</Asset>`)
    })

    it('should render maps correctly', () => {
        const testNormal = normalizeTestWML(`<Asset key=(Test)>
            <Map key=(testMap)>
                <Name>Test map</Name>
                <Room key=(testRoomOne) x="0" y="0">
                    <Description>Test Room One</Description>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <If {false}>
                    <Room key=(testRoomTwo) x="-100" y="0">
                        <Description>Test Room Two</Description>
                        <Exit to=(testRoomOne)>one</Exit>
                    </Room>
                </If>
                <Image key=(mapBackground) />
            </Map>
        </Asset>`)
        const normalizer = new Normalizer()
        normalizer.loadNormal(standardizeNormal(testNormal))
        expect(schemaToWML(normalizer.schema)).toEqual(`<Asset key=(Test)>
    <Room key=(testRoomOne)>
        <Description>Test Room One</Description>
        <Exit to=(testRoomTwo)>two</Exit>
    </Room>
    <Room key=(testRoomTwo)>
        <Description><If {false}>Test Room Two</If></Description>
        <If {false}><Exit to=(testRoomOne)>one</Exit></If>
    </Room>
    <Map key=(testMap)>
        <Name />
        <Image key=(mapBackground) />
        <Room key=(testRoomOne) x="0" y="0" />
        <If {false}><Room key=(testRoomTwo) x="-100" y="0" /></If>
    </Map>
</Asset>`)
    })

    it('should render messages correctly', () => {
        const testNormal = normalizeTestWML(`<Asset key=(Test)>
            <Message key=(testMessage)>
                Test message
                <Room key=(testRoomOne)>
                    <Description>Test Room One</Description>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Room key=(testRoomTwo)>
                    <Description>Test Room Two</Description>
                    <Exit to=(testRoomOne)>one</Exit>
                </Room>
            </Message>
        </Asset>`)
        const normalizer = new Normalizer()
        normalizer.loadNormal(standardizeNormal(testNormal))
        expect(schemaToWML(normalizer.schema)).toEqual(`<Asset key=(Test)>
    <Room key=(testRoomOne)>
        <Description>Test Room One</Description>
        <Exit to=(testRoomTwo)>two</Exit>
    </Room>
    <Room key=(testRoomTwo)>
        <Description>Test Room Two</Description>
        <Exit to=(testRoomOne)>one</Exit>
    </Room>
    <Message key=(testMessage)>
        Test message
        <Room key=(testRoomOne) />
        <Room key=(testRoomTwo) />
    </Message>
</Asset>`)
    })

    it('should render momentss correctly', () => {
        const testNormal = normalizeTestWML(`<Asset key=(Test)>
            <Moment key=(testMoment)>
                <Message key=(testMessage)>
                    Test message
                    <Room key=(testRoomOne)>
                        <Description>Test Room One</Description>
                        <Exit to=(testRoomTwo)>two</Exit>
                    </Room>
                </Message>
            </Moment>
        </Asset>`)
        const normalizer = new Normalizer()
        normalizer.loadNormal(standardizeNormal(testNormal))
        expect(schemaToWML(normalizer.schema)).toEqual(`<Asset key=(Test)>
    <Room key=(testRoomOne)>
        <Description>Test Room One</Description>
        <Exit to=(testRoomTwo)>two</Exit>
    </Room>
    <Message key=(testMessage)>Test message<Room key=(testRoomOne) /></Message>
    <Moment key=(testMoment)><Message key=(testMessage) /></Moment>
</Asset>`)
    })

})

import Normalizer from '.'
import { schemaToWML } from '../simpleSchema'
import { deIndentWML } from '../simpleSchema/utils'
import { NormalForm } from './baseClasses'
import standardizeNormal from './standardize'

const normalizeTestWML = (wml: string): NormalForm => {
    const normalizer = new Normalizer()
    normalizer.loadWML(wml)
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
        console.log(`normalForm: ${JSON.stringify(normalizer.normal, null, 4)}`)
        expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(test)>
                    <Name>Test Room</Name>
                    <Description>One<br /><If {false}>Two</If></Description>
                </Room>
                <Feature key=(testFeature)>
                    <Description><If {false}>Three</If></Description>
                </Feature>
            </Asset>
        `))
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
        expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(test)>
                    <Description>One<br /></Description>
                    <If {false}><Exit to=(testTwo)>Test Exit</Exit></If>
                </Room>
                <Room key=(testTwo)><Exit to=(test)>Test Return</Exit></Room>
            </Asset>
        `))
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
        expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(test)>
                    <Description>One<br />Two</Description>
                    <Exit to=(testTwo)>Test Exit</Exit>
                </Room>
                <Room key=(testTwo)><Exit to=(test)>Test Return</Exit></Room>
                <Message key=(testMessage)>Test message<Room key=(test) /></Message>
            </Asset>
        `))
    })

    it('should render features and links correctly', () => {
        const testNormal = normalizeTestWML(`<Asset key=(Test)>
            <Room key=(test)>
                <Description>
                    <Link to=(testFeatureOne)>test</Link>
                </Description>
            </Room>
            <Feature key=(testFeatureOne)>
                <Name>TestOne</Name>
                <Description><Link to=(testFeatureTwo)>two</Link></Description>
            </Feature>
            <Feature key=(testFeatureTwo)>
                <Name>TestTwo</Name>
                <Description>Test</Description>
            </Feature>
        </Asset>`)
        const normalizer = new Normalizer()
        normalizer.loadNormal(standardizeNormal(testNormal))
        expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(test)>
                    <Description><Link to=(testFeatureOne)>test</Link></Description>
                </Room>
                <Feature key=(testFeatureOne)>
                    <Name>TestOne</Name>
                    <Description><Link to=(testFeatureTwo)>two</Link></Description>
                </Feature>
                <Feature key=(testFeatureTwo)>
                    <Name>TestTwo</Name>
                    <Description>Test</Description>
                </Feature>
            </Asset>
        `))
    })

    it('should render knowledge correctly', () => {
        const testNormal = normalizeTestWML(`<Asset key=(Test)>
            <Room key=(test)>
                <Description>
                    <Link to=(testKnowledgeOne)>test</Link>
                </Description>
            </Room>
            <Knowledge key=(testKnowledgeOne)>
                <Name>TestOne</Name>
                <Description><Link to=(testKnowledgeTwo)>two</Link></Description>
            </Knowledge>
            <Knowledge key=(testKnowledgeTwo)>
                <Name>TestTwo</Name>
                <Description>Test</Description>
            </Knowledge>
        </Asset>`)
        const normalizer = new Normalizer()
        normalizer.loadNormal(standardizeNormal(testNormal))
        expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(test)>
                    <Description><Link to=(testKnowledgeOne)>test</Link></Description>
                </Room>
                <Knowledge key=(testKnowledgeOne)>
                    <Name>TestOne</Name>
                    <Description><Link to=(testKnowledgeTwo)>two</Link></Description>
                </Knowledge>
                <Knowledge key=(testKnowledgeTwo)>
                    <Name>TestTwo</Name>
                    <Description>Test</Description>
                </Knowledge>
            </Asset>
        `))
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
        expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Bookmark key=(testThree)>TestThree</Bookmark>
                <Bookmark key=(testOne)>TestOne<Bookmark key=(testThree) /></Bookmark>
                <Bookmark key=(testTwo)>TestTwo<Bookmark key=(testOne) /></Bookmark>
            </Asset>
        `))
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
        expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Description>Test Room One</Description>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Room key=(testRoomTwo)>
                    <Description><If {false}>Test Room Two</If></Description>
                    <If {false}><Exit to=(testRoomOne)>one</Exit></If>
                </Room>
                <Map key=(testMap)>
                    <Name>Test map</Name>
                    <Image key=(mapBackground) />
                    <Room key=(testRoomOne) x="0" y="0" />
                    <If {false}><Room key=(testRoomTwo) x="-100" y="0" /></If>
                </Map>
            </Asset>
        `))
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
        expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
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
            </Asset>
        `))
    })

    it('should render moments correctly', () => {
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
        expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Description>Test Room One</Description>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Message key=(testMessage)>Test message<Room key=(testRoomOne) /></Message>
                <Moment key=(testMoment)><Message key=(testMessage) /></Moment>
            </Asset>
        `))
    })

    it('should render variables correctly', () => {
        const testNormal = normalizeTestWML(`<Asset key=(Test)>
            <Variable key=(testVar) default={false} />
            <Room key=(testRoomOne)>
                <Description>Test Room One</Description>
                <Exit to=(testRoomTwo)>two</Exit>
            </Room>
        </Asset>`)
        const normalizer = new Normalizer()
        normalizer.loadNormal(standardizeNormal(testNormal))
        expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Description>Test Room One</Description>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Variable key=(testVar) default={false} />
            </Asset>
        `))
    })

    it('should render computes in dependency order', () => {
        const testNormal = normalizeTestWML(`<Asset key=(Test)>
            <Computed key=(computeOne) src={computeThree} />
            <Computed key=(computeTwo) src={!computeOne} />
            <Computed key=(computeThree) src={!testVar} />
            <Variable key=(testVar) default={false} />
        </Asset>`)
        const normalizer = new Normalizer()
        normalizer.loadNormal(standardizeNormal(testNormal))
        expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Variable key=(testVar) default={false} />
                <Computed key=(computeThree) src={!testVar} />
                <Computed key=(computeOne) src={computeThree} />
                <Computed key=(computeTwo) src={!computeOne} />
            </Asset>
        `))
    })

    it('should render actions correctly', () => {
        const testNormal = normalizeTestWML(`<Asset key=(Test)>
            <Action key=(actionOne) src={testVar = !testVar} />
            <Computed key=(computeOne) src={!testVar} />
            <Variable key=(testVar) default={false} />
        </Asset>`)
        const normalizer = new Normalizer()
        normalizer.loadNormal(standardizeNormal(testNormal))
        expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Variable key=(testVar) default={false} />
                <Computed key=(computeOne) src={!testVar} />
                <Action key=(actionOne) src={testVar = !testVar} />
            </Asset>
        `))
    })

    it('should render imports correctly', () => {
        const testNormal = normalizeTestWML(`<Asset key=(Test)>
            <Import from=(vanishingPoint)>
                <Variable key=(testVar) from=(power) />
                <Room key=(testRoomOne) />
            </Import>
            <Variable key=(testVar) />
            <Room key=(testRoomOne)>
                <Description>Test Room One</Description>
                <Exit to=(testRoomTwo)>two</Exit>
            </Room>
        </Asset>`)
        const normalizer = new Normalizer()
        normalizer.loadNormal(standardizeNormal(testNormal))
        expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne)>
                    <Description>Test Room One</Description>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Variable key=(testVar) />
                <Import from=(vanishingPoint)>
                    <Variable key=(testVar) from=(power) />
                    <Room key=(testRoomOne) />
                </Import>
            </Asset>
        `))
    })

    it('should render unedited imports correctly', () => {
        const testNormal = normalizeTestWML(`<Asset key=(Test)>
            <Import from=(vanishingPoint)>
                <Room key=(testRoomOne) />
            </Import>
        </Asset>`)
        const normalizer = new Normalizer()
        normalizer.loadNormal(standardizeNormal(testNormal))
        expect(schemaToWML(normalizer.schema)).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne) />
                <Import from=(vanishingPoint)><Room key=(testRoomOne) /></Import>
            </Asset>
        `))
    })

    it('should render exports correctly', () => {
        const testSource = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(testRoomOne) />
                <Export><Room key=(testRoomOne) as=(Room2) /></Export>
            </Asset>
        `)
        const testNormal = normalizeTestWML(testSource)
        const normalizer = new Normalizer()
        normalizer.loadNormal(standardizeNormal(testNormal))
        expect(schemaToWML(normalizer.schema)).toEqual(testSource)
    })

})

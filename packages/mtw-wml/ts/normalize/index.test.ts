import {
    NormalizeTagMismatchError,
    NormalCharacter
} from './baseClasses'
import { clearGeneratedKeys } from './keyUtil'
import { Normalizer } from '.'
import { schemaFromParse } from '../schema'
import parse from '../parser'
import tokenizer from '../parser/tokenizer'
import SourceStream from '../parser/tokenizer/sourceStream'

describe('WML normalize', () => {

    beforeEach(() => {
        clearGeneratedKeys()
    })

    it('should return empty map on empty schema', () => {
        expect((new Normalizer()).normal).toEqual({})
    })

    it('should normalize every needed tag', () => {
        const testSource = `<Asset key=(Test) fileName="Test" >
            <Import from=(BASE)>
                <Use key=(basePower) as=(power) type="Variable" />
                <Use key=(overview) type="Room" />
            </Import>
            <Room key=(a123)>
                <Exit from=(b456) />
                <Feature key=(clockTower) />
            </Room>
            <Map key=(TestMap)>
                <Image key=(ImageTest) fileURL="https://test.com/imageTest.png" />
                <Room key=(a123) x="200" y="150" />
            </Map>
            <Feature key=(clockTower)>
                <Name>Clock Tower</Name>
            </Feature>
            <Variable key=(active) default={true} />
            <Computed key=(inactive) src={!active}>
                <Depend on=(active) />
            </Computed>
            <Action key=(toggleActive) src={active = !active} />
        </Asset>`
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        normalizer.add(testAsset[0], { contextStack: [], location: [0] })
        expect(normalizer.normal).toMatchSnapshot()
    })
    
    it('should create wrapping elements for exits where needed', () => {
        const testSource = `<Asset key=(Test) fileName="Test" >
            <Room key=(a123)>
                <Exit from=(b456) />
            </Room>
        </Asset>`
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        normalizer.add(testAsset[0], { contextStack: [], location: [0] })
        expect(normalizer.normal).toMatchSnapshot()
    })

    it('should normalize exits into their parent room where needed', () => {
        const testSource = `<Asset key=(Test) fileName="Test">
            <Room key=(a123)>
                <Name>Vortex</Name>
                <Exit to=(b456) />
            </Room>
            <Exit from=(b456) to=(a123) />
            <Room key=(b456)>
                <Name>Welcome</Name>
            </Room>
        </Asset>`
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        normalizer.add(testAsset[0], { contextStack: [], location: [0] })
        expect(normalizer.normal).toMatchSnapshot()
    })

    it('should accumulate multiple appearances of the same key', () => {
        const testSource = `<Asset key=(Test) fileName="Test">
            <Room key=(a123)>
                <Name>Vortex</Name>
            </Room>
            <Room key=(a123)>
                <Description>
                    Hello, world!
                </Description>
            </Room>
            <Condition if={true}>
                <Room key=(a123)>
                    <Description>
                        Vortex!
                    </Description>
                </Room>
            </Condition>
        </Asset>`
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        normalizer.add(testAsset[0], { contextStack: [], location: [0] })
        expect(normalizer.normal).toMatchSnapshot()

    })

    it('should denormalize condition dependencies into contextStack', () => {
        const testSource = `<Asset key=(Test) fileName="Test">
            <Room key=(a123)>
                <Name>Vortex</Name>
                <Description>
                    Hello, world!
                </Description>
            </Room>
            <Condition if={strong}>
                <Depend on=(strong) />
                <Room key=(a123)>
                    <Description>
                        Vortex!
                    </Description>
                </Room>
            </Condition>
            <Variable key=(strong) default={false} />
        </Asset>`
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        normalizer.add(testAsset[0], { contextStack: [], location: [0] })
        expect(normalizer.normal).toMatchSnapshot()

    })

    it('should correctly handle multiple and nested conditionals', () => {
        const testSource = `<Asset key=(Test) fileName="Test">
            <Room key=(a123)>
                <Name>Vortex</Name>
                <Description>
                    Hello, world!
                </Description>
            </Room>
            <Condition if={strong}>
                <Depend on=(strong) />
                <Room key=(a123)>
                    <Description>
                        Vortex!
                    </Description>
                </Room>
            </Condition>
            <Condition if={!strong}>
                <Depend on=(strong) />
                <Condition if={trendy}>
                    <Depend on=(trendy) />
                    <Room key=(a123)>
                        <Description>
                            V.O.R.T.E.X.
                        </Description>
                    </Room>
                </Condition>
            </Condition>
            <Variable key=(strong) default={false} />
            <Variable key=(trendy) default={false} />
        </Asset>`
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        normalizer.add(testAsset[0], { contextStack: [], location: [0] })
        expect(normalizer.normal).toMatchSnapshot()

    })

    it('should correctly serialize multiple unconditioned descriptions', () => {
        const testSource = `<Asset key=(Test) fileName="Test">
            <Room key=(test)>
                <Description>
                    One
                </Description>
            </Room>
            <Room key=(test)>
                <Description>
                    Two
                </Description>
            </Room>
        </Asset>`
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        normalizer.add(testAsset[0], { contextStack: [], location: [0] })
        expect(normalizer.normal).toMatchSnapshot()
    })

    it('should throw an error on mismatched key use', () => {
        const testSource = `<Asset key=(Test) fileName="Test">
            <Room key=(ABC)>
                <Name>Vortex</Name>
                <Description>
                    Hello, world!
                </Description>
            </Room>
            <Variable key=(ABC) default={true} />
        </Asset>`
        const normalizer = new Normalizer()
        const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
        expect(() => { normalizer.add(testAsset[0], { contextStack: [], location: [0] }) }).toThrowError(new NormalizeTagMismatchError(`Key 'ABC' is used to define elements of different tags ('Room' and 'Variable')`))
    })
})
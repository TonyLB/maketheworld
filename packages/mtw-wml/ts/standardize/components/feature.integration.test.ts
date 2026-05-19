import { schemaToWML } from '../../schema'
import { StandardForm } from '..'
import { deIndentWML } from '../../schema/utils'

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

describe('StandardFeature integration', () => {
    describe('Situation nesting', () => {
            it('should correct return JSON for examples nested in features nested in rooms', () => {
                const test = new StandardForm(`<Asset uuid=(Test)>
                    <Room uuid=(test) key=(test)>
                        <Feature uuid=(testFeature) key=(testFeature)>
                            <Situation uuid=(testLocal) key=(testLocal)>
                                <Description>Description Test</Description>
                            </Situation>
                        </Feature>
                    </Room>
                    <Room uuid=(testTwo) key=(testTwo) />
                </Asset>`)
                expect(test.toJSON()).toEqual({
                    universalKey: 'ASSET#Test',
                    metaData: [],
                    topLevel: [
                        'ROOM#test',
                        'ROOM#testTwo'
                    ],
                    components: [{
                        tag: 'Room',
                        key: 'test',
                        universalKey: 'ROOM#test',
                        features: ['FEATURE#testFeature']
                    },
                    {
                        tag: 'Feature',
                        key: 'testFeature',
                        universalKey: 'FEATURE#testFeature',
                        situations: [{
                            reference: 'SITUATION#testLocal',
                            payload: { description: ['Description Test'] }
                        }]
                    },
                    {
                        key: 'testLocal',
                        universalKey: 'SITUATION#testLocal',
                        tag: 'Situation',
                    },
                    {
                        tag: 'Room',
                        key: 'testTwo',
                        universalKey: 'ROOM#testTwo',
                    }]
                })
            })
            it('should correctly return schema for examples nested in features nested in rooms', () => {
                const testWML = deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room uuid=(test) key=(test)>
                            <Feature uuid=(testFeature) key=(testFeature)>
                                <Situation key=(testLocal)>
                                    <Description>Description Test</Description>
                                </Situation>
                            </Feature>
                        </Room>
                        <Room uuid=(testTwo) key=(testTwo) />
                    </Asset>
                `)
                const test = new StandardForm(testWML)
                expect(schemaToWML([test.schema])).toEqual(testWML)
            })
    })

    describe('Schema render', () => {
            it('should render features and links correctly', () => {
                const test = new StandardForm(`<Asset uuid=(Test)>
                    <Room uuid=(test) key=(test)>
                        <Situation ref={0} uuid=(testBase)>
                            <Description>
                                <Link to=(testFeatureOne)>test</Link>
                            </Description>
                        </Situation>
                    </Room>
                    <Feature uuid=(testFeatureOne) key=(testFeatureOne)>
                        <Situation uuid=(testFeatureOneBase)>
                            <DisplayName>TestOne</DisplayName>
                            <Description><Link to=(testFeatureTwo)>two</Link></Description>
                        </Situation>
                    </Feature>
                    <Feature uuid=(testFeatureTwo) key=(testFeatureTwo)>
                        <Situation uuid=(testFeatureTwoBase)>
                            <DisplayName>TestTwo</DisplayName>
                            <Description>Test</Description>
                        </Situation>
                    </Feature>
                </Asset>`)
                expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Feature uuid=(testFeatureOne) key=(testFeatureOne)>
                            <Situation uuid=(testFeatureOneBase)>
                                <DisplayName>TestOne</DisplayName>
                                <Description><Link to=(testFeatureTwo)>two</Link></Description>
                            </Situation>
                        </Feature>
                        <Feature uuid=(testFeatureTwo) key=(testFeatureTwo)>
                            <Situation uuid=(testFeatureTwoBase)>
                                <DisplayName>TestTwo</DisplayName>
                                <Description>Test</Description>
                            </Situation>
                        </Feature>
                        <Room uuid=(test) key=(test)>
                            <Situation uuid=(testBase) ref={0}>
                                <Description><Link to=(testFeatureOne)>test</Link></Description>
                            </Situation>
                        </Room>
                        <Situation uuid=(testBase) ref={0} />
                    </Asset>
                `))
            })
    })
})

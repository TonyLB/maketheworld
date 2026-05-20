import { schemaToWML } from '../../schema'
import { StandardForm } from '..'
import { deIndentWML } from '../../schema/utils'

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

describe('StandardKnowledge integration', () => {
    describe('Situation nesting', () => {
            it('should correctly return JSON for situations nested in Knowledge', () => {
                const test = new StandardForm(`<Asset uuid=(Test)>
                    <Knowledge uuid=(test) key=(test)>
                        <Situation uuid=(testLocal)>
                            <Description>Description Test</Description>
                        </Situation>
                    </Knowledge>
                </Asset>`)
                expect(test.toJSON()).toEqual({
                    universalKey: 'ASSET#Test',
                    metaData: [],
                    topLevel: ['KNOWLEDGE#test'],
                    components: [{
                        tag: 'Knowledge',
                        key: 'test',
                        universalKey: 'KNOWLEDGE#test',
                        situations: [{
                            reference: 'SITUATION#testLocal',
                            payload: { description: ['Description Test'] }
                        }]
                    },
                    {
                        universalKey: 'SITUATION#testLocal',
                        tag: 'Situation',
                    }]
                })
            })
            it('should correctly return schema for situations nested in knowledge', () => {
                const testSource = deIndentWML(`
                    <Asset uuid=(Test)>
                        <Knowledge uuid=(test) key=(test)>
                            <Situation key=(testLocal)>
                                <Description>Description Test</Description>
                            </Situation>
                        </Knowledge>
                    </Asset>
                `)
                const test = new StandardForm(testSource)
                expect(schemaToWML([test.schema])).toEqual(testSource)
            })
    })

    describe('Schema render', () => {
            it('should render knowledge correctly', () => {
                const test = new StandardForm(`<Asset uuid=(Test)>
                    <Room uuid=(test) key=(test)>
                        <Situation ref={0} uuid=(testBase)>
                            <Description>
                                <Link to=(testKnowledgeOne)>test</Link>
                            </Description>
                        </Situation>
                    </Room>
                    <Knowledge uuid=(testKnowledgeOne) key=(testKnowledgeOne)>
                        <Situation uuid=(testKnowledgeOneBase)>
                            <DisplayName>TestOne</DisplayName>
                            <Description><Link to=(testKnowledgeTwo)>two</Link></Description>
                        </Situation>
                    </Knowledge>
                    <Knowledge uuid=(testKnowledgeTwo) key=(testKnowledgeTwo)>
                        <Situation uuid=(testKnowledgeTwoBase)>
                            <DisplayName>TestTwo</DisplayName>
                            <Description>Test</Description>
                        </Situation>
                    </Knowledge>
                </Asset>`)
                expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Knowledge uuid=(testKnowledgeOne) key=(testKnowledgeOne)>
                            <Situation uuid=(testKnowledgeOneBase)>
                                <DisplayName>TestOne</DisplayName>
                                <Description><Link to=(testKnowledgeTwo)>two</Link></Description>
                            </Situation>
                        </Knowledge>
                        <Knowledge uuid=(testKnowledgeTwo) key=(testKnowledgeTwo)>
                            <Situation uuid=(testKnowledgeTwoBase)>
                                <DisplayName>TestTwo</DisplayName>
                                <Description>Test</Description>
                            </Situation>
                        </Knowledge>
                        <Room uuid=(test) key=(test)>
                            <Situation uuid=(testBase) ref={0}>
                                <Description><Link to=(testKnowledgeOne)>test</Link></Description>
                            </Situation>
                        </Room>
                        <Situation uuid=(testBase) ref={0} />
                    </Asset>
                `))
            })
    })
})

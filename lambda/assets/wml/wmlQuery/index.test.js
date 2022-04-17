// import wmlGrammar from '../wmlGrammar/wml.ohm-bundle.js'
import { WMLQuery } from './index.js'

describe('wmlQuery', () => {

    const match = `
        <Character key=(TESS) fileName="Tess" player="TonyLB">
            // Comments should be preserved
            <Name>Tess</Name>
            <Pronouns
                subject="she"
                object="her"
                possessive="her"
                adjective="hers"
                reflexive="herself"
            ></Pronouns>
            <FirstImpression>Frumpy Goth</FirstImpression>
            <OneCoolThing>Fuchsia eyes</OneCoolThing>
            <Outfit>A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.</Outfit>
        </Character>
    `

    let wmlQuery = null
    const onChangeMock = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        wmlQuery = new WMLQuery(match, { onChange: onChangeMock })
    })

    it('should return empty on illegal selector', () => {
        expect(wmlQuery.search('Fraggle Rock').nodes()).toEqual([])
    })

    it('should correctly query nodes', () => {
        expect(wmlQuery.search('Character Name').nodes()).toEqual([{
            type: 'tag',
            tag: 'Name',
            tagEnd: 125,
            props: {},
            contents: [{
                type: 'string',
                value: "Tess",
                start: 126,
                end: 130
            }],
            start: 120,
            end: 137
        }])
    })

    it('should correctly return prop when available', () => {
        expect(wmlQuery.search('Character').prop('player')).toEqual('TonyLB')
    })

    it('should correctly return undefined from prop when unavailable', () => {
        expect(wmlQuery.search('Character').prop('origin')).toBe(undefined)
    })

    it('should correctly return undefined prop when search fails', () => {
        expect(wmlQuery.search('Fraggle Rock').prop('rhythm')).toBe(undefined)
    })

    it('should correctly update existing prop', () => {
        expect(wmlQuery.search('Character').prop('key', 'Tess').source).toEqual(`
        <Character key=(Tess) fileName="Tess" player="TonyLB">
            // Comments should be preserved
            <Name>Tess</Name>
            <Pronouns
                subject="she"
                object="her"
                possessive="her"
                adjective="hers"
                reflexive="herself"
            ></Pronouns>
            <FirstImpression>Frumpy Goth</FirstImpression>
            <OneCoolThing>Fuchsia eyes</OneCoolThing>
            <Outfit>A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.</Outfit>
        </Character>
    `)
        expect(onChangeMock).toHaveBeenCalledTimes(1)
        const { wmlQuery: remove, ...rest } = onChangeMock.mock.calls[0][0]
        expect(rest).toEqual({
            type: 'replace',
            startIdx: 25,
            endIdx: 29,
            text: 'Tess'
        })

    })

    it('should correctly remove existing prop', () => {
        expect(wmlQuery.search('Character').removeProp('key').source).toEqual(`
        <Character fileName="Tess" player="TonyLB">
            // Comments should be preserved
            <Name>Tess</Name>
            <Pronouns
                subject="she"
                object="her"
                possessive="her"
                adjective="hers"
                reflexive="herself"
            ></Pronouns>
            <FirstImpression>Frumpy Goth</FirstImpression>
            <OneCoolThing>Fuchsia eyes</OneCoolThing>
            <Outfit>A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.</Outfit>
        </Character>
    `)
    })

    it('should correctly add a new prop', () => {
        expect(wmlQuery.search('Character').prop('zone', 'Library').source).toEqual(`
        <Character key=(TESS) fileName="Tess" player="TonyLB" zone="Library">
            // Comments should be preserved
            <Name>Tess</Name>
            <Pronouns
                subject="she"
                object="her"
                possessive="her"
                adjective="hers"
                reflexive="herself"
            ></Pronouns>
            <FirstImpression>Frumpy Goth</FirstImpression>
            <OneCoolThing>Fuchsia eyes</OneCoolThing>
            <Outfit>A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.</Outfit>
        </Character>
    `)
        expect(onChangeMock).toHaveBeenCalledTimes(1)
        const { wmlQuery: remove, ...rest } = onChangeMock.mock.calls[0][0]
        expect(rest).toEqual({
            type: 'replace',
            startIdx: 62,
            endIdx: 62,
            text: ' zone="Library"'
        })

    })

    it('should correctly no-op when asked to remove an absent prop', () => {
        expect(wmlQuery.search('Name').removeProp('key').source).toEqual(match)
        expect(onChangeMock).toHaveBeenCalledTimes(0)
    })

    it('should correctly remove and update boolean prop', () => {
        const booleanPropsMatch = `
            <Asset key=(BASE)>
                <Room key=(VORTEX) global>
                </Room>
                <Room key=(Test) />
            </Asset>
        `
        let booleanQuery = new WMLQuery(booleanPropsMatch, { onChange: onChangeMock })
        expect(booleanQuery.search('Room[key="VORTEX"]').removeProp('global').source).toMatchSnapshot()
        expect(booleanQuery.search('Room[key="Test"]').prop('global', true, { type: 'boolean' }).source).toMatchSnapshot()
    })

    it('should correctly remove and update expression prop', () => {
        const expressionPropsMatch = `
            <Asset key=(BASE)>
                <Condition if={true}></Condition>
            </Asset>
        `
        let expressionQuery = new WMLQuery(expressionPropsMatch, { onChange: onChangeMock })
        expect(expressionQuery.search('Condition').prop('if', 'false', { type: 'expression' }).source).toMatchSnapshot()
    })

    it('should return empty array contents on failed match', () => {
        expect(wmlQuery.search('Name Outfit').contents()).toEqual([])
    })

    it('should correctly return contents on match', () => {
        expect(wmlQuery.search('Character Name').contents()).toEqual([{
            type: 'string',
            value: 'Tess',
            start: 126,
            end: 130
        }])
    })

    it('should no-op on failed match on contents', () => {
        expect(wmlQuery.search('Name Outfit').contents('An olive-green pea-coat').source).toEqual(match)
    })

    it('should update contents on match', () => {
        expect(wmlQuery.search('Character Name').contents('Glinda').source).toEqual(`
        <Character key=(TESS) fileName="Tess" player="TonyLB">
            // Comments should be preserved
            <Name>Glinda</Name>
            <Pronouns
                subject="she"
                object="her"
                possessive="her"
                adjective="hers"
                reflexive="herself"
            ></Pronouns>
            <FirstImpression>Frumpy Goth</FirstImpression>
            <OneCoolThing>Fuchsia eyes</OneCoolThing>
            <Outfit>A bulky frock-coat lovingly kit-bashed from a black hoodie and patchily dyed lace.</Outfit>
        </Character>
    `)
        expect(onChangeMock).toHaveBeenCalledTimes(1)
        const { wmlQuery: remove, ...rest } = onChangeMock.mock.calls[0][0]
        expect(rest).toEqual({
            type: 'replace',
            startIdx: 126,
            endIdx: 130,
            text: 'Glinda'
        })

    })

    describe('render method', () => {
        const renderMatch = `
        <Asset key=(BASE)>
            <Room key=(VORTEX) global>
                <Description>
                    Test Render:
                    <Link key=(123) to=(clockTower)>Clock Tower</Link>
                </Description>
                <Exit to=(Test)>test</Exit>
            </Room>
            <Room key=(Test) />
            <Room key=(multipleTest)>
                Render One
            </Room>
            <Room key=(multipleTest)>
                Render Two
            </Room>
            <Feature key=(clockTower)>
                Clocktower
                test
                on multiple lines
            </Feature>
        </Asset>
    `
        let renderQuery = new WMLQuery(renderMatch, { onChange: onChangeMock })
        beforeEach(() => {
            jest.clearAllMocks()
            jest.resetAllMocks()
            renderQuery = new WMLQuery(renderMatch, { onChange: onChangeMock })
        })    

        it('should correctly extract renders', () => {
            expect(renderQuery.search('Room[key="VORTEX"]').render()).toMatchSnapshot()
        })

        it('should correctly update renders', () => {
            expect(renderQuery.search('Room[key="VORTEX"]').render([
                'Test Render Two: ',
                {
                    tag: 'Link',
                    key: '456',
                    to: 'clockTower',
                    text: '(clock tower)'
                }
            ]).source).toMatchSnapshot()
        })

        it('should (temporarily) ignore render updates on self-closed tags', () => {
            expect(renderQuery.search('Room[key="Test"]').render([
                'Test Render Two: ',
                {
                    tag: 'Link',
                    key: '456',
                    to: 'clockTower',
                    text: '(clock tower)'
                }
            ]).source).toMatchSnapshot()
        })

        it('should correctly update multiple renders in a set', () => {
            expect(renderQuery.search('Room[key="multipleTest"]').render([
                `Much, much, longer render
                Like, seriously, it's insane how much longer this render is
            `
            ]).source).toMatchSnapshot()
        })
    })

    describe('not method', () => {
        const notMatch = `
        <Asset key=(BASE)>
            <Room key=(VORTEX) global>
                <Description>
                    Test Render:
                    <Link key=(123) to=(clockTower)>Clock Tower</Link>
                </Description>
                <Exit to=(Test)>test</Exit>
            </Room>
            <Condition>
                <Room key=(VORTEX) global>
                    <Description>
                        Conditional Render
                    </Description>
                </Room>
            </Condition>
            <Room key=(Test) />
            <Room key=(multipleTest)>
                <Description>
                    Render One
                </Description>
            </Room>
            <Room key=(multipleTest)>
                <Description>
                    Render Two
                </Description>
            </Room>
            <Feature key=(clockTower)>
                <Description>
                    Clocktower
                    test
                    on multiple lines
                </Description>
            </Feature>
        </Asset>
    `
        let notQuery = new WMLQuery(notMatch, { onChange: onChangeMock })
        beforeEach(() => {
            jest.clearAllMocks()
            jest.resetAllMocks()
            notQuery = new WMLQuery(notMatch, { onChange: onChangeMock })
        })    

        it('should correctly remove nodes from result-set', () => {
            expect(notQuery.search('Room[key="VORTEX"]').not('Condition Room').nodes()).toMatchSnapshot()
        })
    })

    describe('add method', () => {
        const addMatch = `
        <Asset key=(BASE)>
            <Room key=(VORTEX) global>
                <Description>
                    First Room
                </Description>
                <Exit to=(Test)>test</Exit>
            </Room>
            <Room key=(test) />
            <Room key=(nested) />
            <Room key=(nested)><Name>Nested</Name></Room>
            <Condition>
                <Room key=(VORTEX) global>
                    <Description>
                        Conditional Render
                    </Description>
                    <Exit from=(Test)>vortex</Exit>
                </Room>
            </Condition>
        </Asset>
    `
        let addQuery = new WMLQuery(addMatch, { onChange: onChangeMock })
        beforeEach(() => {
            jest.clearAllMocks()
            jest.resetAllMocks()
            addQuery = new WMLQuery(addMatch, { onChange: onChangeMock })
        })    

        it('should correctly add filter tag matches', () => {
            expect(addQuery.search('Room[key="VORTEX"]').not('Condition Room').add('Exit').nodes()).toMatchSnapshot()
        })

        it('should correctly add property filters', () => {
            expect(addQuery.search('Room').not('Condition Room').add('[key="test"]').nodes()).toMatchSnapshot()
        })

        it('should correctly add first filters', () => {
            expect(addQuery.search('Room').not('Condition Room').add(':first').nodes()).toMatchSnapshot()
        })

        it('should correctly add nested filters', () => {
            expect(addQuery.search('Room').not('Condition Room').add('[key="nested"] Name').nodes()).toMatchSnapshot()
        })
    })

    describe('remove method', () => {
        const removeMatch = `
        <Asset key=(BASE)>
            <Room key=(VORTEX) global>
                <Description>
                    Test Render:
                    <Link key=(123) to=(clockTower)>Clock Tower</Link>
                </Description>
                <Exit to=(Test)>test</Exit>
            </Room>
            <Condition>
                <Room key=(VORTEX) global>
                    <Description>
                        Conditional Render
                    </Description>
                </Room>
            </Condition>
            <Room key=(Test) />
            <Room key=(multipleTest)>
                <Description>
                    Render One
                </Description>
            </Room>
            <Room key=(multipleTest)>
                <Description>
                    Render Two
                </Description>
            </Room>
            <Feature key=(clockTower)>
                <Description>
                    Clocktower
                    test
                    on multiple lines
                </Description>
            </Feature>
        </Asset>
    `
        let removeQuery = new WMLQuery(removeMatch, { onChange: onChangeMock })
        beforeEach(() => {
            jest.clearAllMocks()
            jest.resetAllMocks()
            removeQuery = new WMLQuery(removeMatch, { onChange: onChangeMock })
        })    

        it('should correctly remove nodes from source', () => {
            expect(removeQuery.search('Room[key="VORTEX"]').remove().source).toMatchSnapshot()
        })
    })

    describe('children method', () => {
        const childrenMatch = `
        <Asset key=(BASE)>
            <Room key=(VORTEX) global>
                <Description>
                    Test Render:
                    <Link key=(123) to=(clockTower)>Clock Tower</Link>
                </Description>
                <Exit to=(Test)>test</Exit>
            </Room>
            <Condition>
                <Room key=(VORTEX) global>
                    <Description>
                        Conditional Render
                    </Description>
                </Room>
            </Condition>
        </Asset>
    `
        let childrenQuery = new WMLQuery(childrenMatch, { onChange: onChangeMock })
        beforeEach(() => {
            jest.clearAllMocks()
            jest.resetAllMocks()
            childrenQuery = new WMLQuery(childrenMatch, { onChange: onChangeMock })
        })

        it('should correctly aggregate child nodes', () => {
            expect(childrenQuery.search('Room[key="VORTEX"]').children().nodes()).toMatchSnapshot()
        })
    })

    describe('prepend method', () => {
        const prependMatch = `
        <Asset key=(BASE)>
            <Room key=(VORTEX) global>
                <Description>
                    Test Render:
                    <Link key=(123) to=(clockTower)>Clock Tower</Link>
                </Description>
                <Exit to=(Test)>test</Exit>
            </Room>
            <Condition>
                <Room key=(VORTEX) global>
                    <Description>
                        Conditional Render
                    </Description>
                </Room>
            </Condition>
        </Asset>
    `
        let prependQuery = new WMLQuery(prependMatch, { onChange: onChangeMock })
        beforeEach(() => {
            jest.clearAllMocks()
            jest.resetAllMocks()
            prependQuery = new WMLQuery(prependMatch, { onChange: onChangeMock })
        })

        it('should correctly aggregate child nodes', () => {
            expect(prependQuery.search('Room[key="VORTEX"]').children().prepend('<Name>Vortex</Name>').source).toMatchSnapshot()
        })
    })

})
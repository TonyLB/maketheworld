import { WMLQuery } from './index'

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

    let wmlQuery: WMLQuery | undefined
    const onChangeMock = jest.fn()

    const checkOutput = (output: any, compare: any) => {
        const { wmlQuery: remove, ...rest } = output
        expect(rest).toEqual(compare)
    }

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        wmlQuery = new WMLQuery(match, { onChange: onChangeMock })
    })

    it('should correctly query nodes', () => {
        expect(wmlQuery?.search('Character Name').nodes()).toMatchSnapshot()
    })

    it('should correctly return prop when available', () => {
        expect(wmlQuery?.search('Character')?.prop('player')).toEqual('TonyLB')
    })

    it('should correctly return undefined from prop when unavailable', () => {
        expect(wmlQuery?.search('Character').prop('origin')).toBe(undefined)
    })

    it('should correctly return undefined prop when search fails', () => {
        expect(wmlQuery?.search('Character Name Description').prop('rhythm')).toBe(undefined)
    })

    it('should correctly update existing prop', () => {
        const testResult = `
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
    `
        expect(wmlQuery?.search('Character').prop('key', 'Tess', { type: 'key' }).source).toEqual(testResult)
        expect(onChangeMock).toHaveBeenCalledTimes(1)
        checkOutput(onChangeMock.mock.calls[0][0], {
            type: 'replace',
            startIdx: 19,
            endIdx: 30,
            text: ' key=(Tess)'
        })
    })

    it('should correctly remove existing prop', () => {
        const testResult = `
        <Character key=(TESS) player="TonyLB">
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
        expect(wmlQuery?.search('Character').removeProp('fileName').source).toEqual(testResult)
    })

    it('should correctly add a new prop', () => {
        const testResult = `
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
    `
        expect(wmlQuery?.search('Character').prop('zone', 'Library').source).toEqual(testResult)
        expect(onChangeMock).toHaveBeenCalledTimes(1)
        checkOutput(onChangeMock.mock.calls[0][0], {
            type: 'replace',
            startIdx: 62,
            endIdx: 62,
            text: ' zone="Library"'
        })

    })

    it('should correctly no-op when asked to remove an absent prop', () => {
        expect(wmlQuery?.search('Name').removeProp('key').source).toEqual(match)
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
        expect(booleanQuery.search('Room[key="Test"]').prop('global', false, { type: 'boolean' }).source).toMatchSnapshot()
    })

    it('should correctly remove and update expression prop', () => {
        const expressionPropsMatch = `
            <Asset key=(BASE)>
                <Variable key=(test) default={true} />
            </Asset>
        `
        let expressionQuery = new WMLQuery(expressionPropsMatch, { onChange: onChangeMock })
        expect(expressionQuery.search('Variable').prop('default', 'false', { type: 'expression' }).source).toMatchSnapshot()
    })

    it('should return empty array contents on failed match', () => {
        expect(wmlQuery?.search('Name Outfit').contents()).toEqual([])
    })

    it('should correctly return contents on match', () => {
        expect(wmlQuery?.search('Character Name').contents()).toEqual([{
            tag: 'String',
            value: 'Tess',
            parse: {
                tag: 'String',
                value: 'Tess',
                startTagToken: 14,
                endTagToken: 14
            }
        }])
    })

    it('should no-op on failed match on contents', () => {
        expect(wmlQuery?.search('Name Outfit').contents('An olive-green pea-coat').source).toEqual(match)
    })

    it('should update contents on match', () => {
        const testResult = `
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
    `
        expect(wmlQuery?.search('Character Name').contents('Glinda').source).toEqual(testResult)
        expect(onChangeMock).toHaveBeenCalledTimes(1)
        checkOutput(onChangeMock.mock.calls[0][0], {
            type: 'replace',
            startIdx: 126,
            endIdx: 130,
            text: 'Glinda'
        })

    })

    it('should unwrap self-closing tag on contents update', () => {
        const contentsMatch = `
        <Asset key=(BASE)>
            <Room key=(VORTEX) global>
                <Exit to=(Test)/>
            </Room>
        </Asset>
    `
        let contentsQuery = new WMLQuery(contentsMatch, { onChange: onChangeMock })

        const testResult = `
        <Asset key=(BASE)>
            <Room key=(VORTEX) global>
                <Exit to=(Test)>test</Exit>
            </Room>
        </Asset>
    `
        expect(contentsQuery.search('Room Exit').contents('test').source).toEqual(testResult)
    })

    describe('render method', () => {
        const renderMatch = `
        <Asset key=(BASE)>
            <Room key=(VORTEX) global>
                <Description>
                    Test Render:
                    <Link to=(clockTower)>Clock Tower</Link>
                </Description>
                <Exit to=(Test)>test</Exit>
            </Room>
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
            <Room key=(emptyTest)>
                <Description></Description>
            </Room>
        </Asset>
    `
        let renderQuery = new WMLQuery(renderMatch, { onChange: onChangeMock })
        beforeEach(() => {
            jest.clearAllMocks()
            jest.resetAllMocks()
            renderQuery = new WMLQuery(renderMatch, { onChange: onChangeMock })
        })    

        it('should correctly extract renders', () => {
            expect(renderQuery.search('Room[key="VORTEX"] Description').render()).toMatchSnapshot()
        })

        it('should correctly update renders', () => {
            expect(renderQuery.search('Room[key="VORTEX"] Description').render([
                { tag: 'String', value: 'Test Render Two: ' },
                {
                    tag: 'Link',
                    to: 'clockTower',
                    text: '(clock tower)'
                } as any
            ]).source).toMatchSnapshot()
        })

        it('should (temporarily) ignore render updates on self-closed tags', () => {
            expect(renderQuery.search('Room[key="Test"] Description').render([
                { tag: 'String', value: 'Test Render Two: ' },
                {
                    tag: 'Link',
                    to: 'clockTower',
                    text: '(clock tower)'
                } as any
            ]).source).toMatchSnapshot()

        })

        it('should correctly update multiple renders in a set', () => {
            expect(renderQuery.search('Room[key="multipleTest"] Description').render([{
                tag: 'String',
                value: `Much, much, longer render
                Like, seriously, it's insane how much longer this render is
            `}]).source).toMatchSnapshot()
        })

        it('should correctly update an empty description', () => {
            expect(renderQuery.search('Room[key="emptyTest"] Description').render([{ tag: 'String', value: 'Test' }]).source).toMatchSnapshot()
        })
    })

    describe('not method', () => {
        const notMatch = `
        <Asset key=(BASE)>
            <Room key=(VORTEX) global>
                <Description>
                    Test Render:
                    <Link to=(clockTower)>Clock Tower</Link>
                </Description>
                <Exit to=(Test)>test</Exit>
            </Room>
            <If {true}>
                <Room key=(VORTEX) global>
                    <Description>
                        Conditional Render
                    </Description>
                </Room>
                <Room key=(Test)>
                    <Name>Test</Name>
                </Room>
            </If>
            <Map key=(QRS)>
                <Room key=(Test) x="100" y="100" />
            </Map>
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
            expect(notQuery.search('Room[key="VORTEX"]').not('If Room').nodes()).toMatchSnapshot()
        })

        it('should correctly chain multiple not operations', () => {
            expect(notQuery.search('Room[key="Test"]').not('If Room').not('Map Room').remove().source).toMatchSnapshot()
        })
    })

    describe('extend method', () => {
        const filterMatch = `
        <Asset key=(BASE)>
            <Room key=(VORTEX) global>
                <Description>
                    First Room
                </Description>
                <Exit to=(Test)>test</Exit>
            </Room>
            <Room key=(Test) />
            <Room key=(nested) />
            <Room key=(nested)><Name>Nested</Name></Room>
            <If {true}>
                <Room key=(VORTEX) global>
                    <Description>
                        Conditional Render
                    </Description>
                </Room>
                <Room key=(Test)>
                    <Exit to=(Test)>vortex</Exit>
                </Room>
            </If>
        </Asset>
    `
        let baseQuery = new WMLQuery(filterMatch, { onChange: onChangeMock })
        beforeEach(() => {
            jest.clearAllMocks()
            jest.resetAllMocks()
            baseQuery = new WMLQuery(filterMatch, { onChange: onChangeMock })
        })    

        it('should correctly update base query from filter extension', () => {
            const newFirstResult = baseQuery.search('Room[key="VORTEX"]').not('If Room')
            newFirstResult.extend().add('Exit').remove()
            expect(newFirstResult.source).toMatchSnapshot()
        })

        it('should not impact base search on extension', () => {
            const newFirstResult = baseQuery.search('Room[key="VORTEX"]')
            newFirstResult.extend().add('Exit')
            expect(newFirstResult.remove().source).toMatchSnapshot()
        })

    })

    describe('remove method', () => {
        const removeMatch = `
        <Asset key=(BASE)>
            <Room key=(VORTEX) global>
                <Description>
                    Test Render:
                    <Link to=(clockTower)>Clock Tower</Link>
                </Description>
                <Exit to=(Test)>test</Exit>
            </Room>
            <If {true}>
                <Room key=(VORTEX) global>
                    <Description>
                        Conditional Render
                    </Description>
                </Room>
            </If>
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

    describe('addElement method', () => {
        const addMatch = `
        <Asset key=(BASE)>
            <Room key=(VORTEX) global>
                <Description>
                    Test Render:
                    <Link to=(clockTower)>Clock Tower</Link>
                </Description>
                <Exit to=(Test)>test</Exit>
            </Room>
            <Room key=(Test) />
            <Room key=(otherTest)>
                <Description>
                    Render One
                </Description>
            </Room>
            <Room key=(emptyTest)></Room>
        </Asset>
    `
        let addQuery = new WMLQuery(addMatch, { onChange: onChangeMock })
        beforeEach(() => {
            jest.clearAllMocks()
            jest.resetAllMocks()
            addQuery = new WMLQuery(addMatch, { onChange: onChangeMock })
        })    

        it('should correctly add node', () => {
            expect(addQuery.search('Room[key="VORTEX"]').addElement('<Name>Vortex</Name>').source).toMatchSnapshot()
        })

        it('should correctly add node before contents', () => {
            expect(addQuery.search('Room[key="VORTEX"]').addElement('<Name>Vortex</Name>', { position: 'before' }).source).toMatchSnapshot()
        })

        it('should correctly add node to self-closing tag', () => {
            expect(addQuery.search('Room[key="Test"]').addElement('<Name>Test</Name>').source).toMatchSnapshot()
        })

        it('should correctly add node to empty tag', () => {
            expect(addQuery.search('Room[key="emptyTest"]').addElement('<Name>Test</Name>').source).toMatchSnapshot()
        })
    })

    describe('children method', () => {
        const childrenMatch = `
        <Asset key=(BASE)>
            <Room key=(VORTEX) global>
                <Description>
                    Test Render:
                    <Link to=(clockTower)>Clock Tower</Link>
                </Description>
                <Exit to=(Test)>test</Exit>
            </Room>
            <If {true}>
                <Room key=(VORTEX) global>
                    <Description>
                        Conditional Render
                    </Description>
                </Room>
            </If>
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

})
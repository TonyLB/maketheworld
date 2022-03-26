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

    // describe('render method', () => {
    //     const renderMatch = `
    //     <Asset key=(BASE)>
    //         <Room key=(VORTEX) global>
    //             Test Render:
    //             <Link key=(123) to=(clockTower)>Clock Tower</Link>
    //             <Exit to=(Test)>test</Exit>
    //         </Room>
    //         <Room key=(Test)>
    //         </Room>
    //         <Feature key=(clockTower)>
    //             Clocktower
    //             test
    //             on multiple lines
    //         </Feature>
    //     </Asset>
    // `
    //     beforeEach(() => {
    //         jest.clearAllMocks()
    //         jest.resetAllMocks()
    //         renderQuery = new WMLQuery(renderMatch, { onChange: onChangeMock })
    //     })    

    //     it('should correctly extract renders', () => {
    //         expect(renderQuery(''))
    //     })
    // })
})
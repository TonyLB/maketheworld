import { schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardCharacterData } from "./dataTypes/character"
import { StandardCharacter } from './character'
import { mergeTest } from "./utils/testing"
import { excludeUndefined } from "../../lib/lists"
import StandardReference from "../keys/reference"
import { StandardKey } from "../keys/key"

describe('StandardCharacter class', () => {
    it('should construct StandardCharacter from schema', () => {
        const testSource = deIndentWML(`
            <Character key=(test)>
                <ShortName>Tess</ShortName>
                <Pronouns>they/them</Pronouns>
            </Character>
        `)
        const testCharacter = new StandardCharacter(testSource)
        expect(testCharacter.key).toEqual('test')
        expect(testCharacter.shortName?.toJSON()).toEqual('Tess')
        expect(testCharacter.pronouns?.toJSON()).toEqual('they/them')
        expect(schemaToWML([testCharacter.schema])).toEqual(testSource)
    })

    it('should construct StandardCharacter from StandardCharacterData', () => {
        const testCharacterData: StandardCharacterData = {
            key: 'test',
            tag: 'Character',
            shortName: 'Tess',
            pronouns: 'they/them',
        }
        const testCharacter = new StandardCharacter(testCharacterData)
        expect(testCharacter.key).toEqual('test')
        expect(testCharacter.shortName?.toJSON()).toEqual('Tess')
        expect(testCharacter.pronouns?.toJSON()).toEqual('they/them')
        expect(testCharacter.toJSON()).toEqual(testCharacterData)
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            `<Character key=(test)>
                <ShortName>Tess</ShortName>
            </Character>`,
            StandardCharacter,
            `<Character key=(test)>
                <Replace><ShortName>Tess</ShortName></Replace>
                <With><ShortName>Tessty</ShortName></With>
            </Character>`
        )).toEqual(deIndentWML(`
            <Character key=(test)><ShortName>Tessty</ShortName></Character>
        `))
    })

    it('should diff identical components correctly', () => {
        const testCharacter = new StandardCharacter({
            key: 'test',
            tag: 'Character',
            displayName: ['Tess'],
        })
        expect(testCharacter.diff(testCharacter)).toBeUndefined()
    })

    it('should diff different components correctly', () => {
        const testCharacter = new StandardCharacter(`
            <Character key=(test)>
                <ShortName>Tess</ShortName>
            </Character>
        `)
        const testCharacter2 = new StandardCharacter(`
            <Character key=(test)>
                <ShortName>Contessa</ShortName>
            </Character>`
        )
        expect(schemaToWML([testCharacter.diff(testCharacter2)?.schema].filter(excludeUndefined))).toEqual(deIndentWML(`
            <Character key=(test)>
                <Replace><ShortName>Tess</ShortName></Replace>
                <With><ShortName>Contessa</ShortName></With>
            </Character>
        `))
    })

    it('should throw on unconsumed child tags', () => {
        const testSource = deIndentWML(`
            <Character key=(test)>
                <ShortName>Tess</ShortName>
                <Map key=(illegalMap) />
            </Character>
        `)
        expect(() => new StandardCharacter(testSource)).toThrow(/Unconsumed child tags/)
        expect(() => new StandardCharacter(testSource)).toThrow(/Map/)
    })

    it('should construct StandardCharacter from WML with a Situation facet', () => {
        const testSource = deIndentWML(`
            <Character key=(test)>
                <ShortName>Tess</ShortName>
                <Situation uuid=(DEFAULT)><DisplayName>Tess</DisplayName></Situation>
            </Character>
        `)
        const testCharacter = new StandardCharacter(testSource)
        expect(testCharacter.situations.items[0].reference.universalKey).toEqual('SITUATION#DEFAULT')
        expect(schemaToWML([testCharacter.schema])).toEqual(testSource)
    })

    it('should construct StandardCharacter from StandardCharacterData with situations', () => {
        const testCharacterData: StandardCharacterData = {
            key: 'test',
            tag: 'Character',
            situations: [{
                reference: 'SITUATION#DEFAULT',
                payload: { displayName: 'Tess' },
            }],
        }
        const testCharacter = new StandardCharacter(testCharacterData)
        expect(testCharacter.key).toEqual('test')
        expect(testCharacter.toJSON()).toEqual(testCharacterData)
    })

    it('should merge situation facets', () => {
        expect(mergeTest(
            `<Character key=(test)>
                <Situation key=(sit1)><DisplayName>One</DisplayName></Situation>
            </Character>`,
            StandardCharacter,
            `<Character key=(test)>
                <Situation key=(sit2)><DisplayName>Two</DisplayName></Situation>
            </Character>`
        )).toEqual(deIndentWML(`
            <Character key=(test)>
                <Situation key=(sit1)><DisplayName>One</DisplayName></Situation>
                <Situation key=(sit2)><DisplayName>Two</DisplayName></Situation>
            </Character>
        `))
    })

    it('should correctly add a Situation reference to a character', () => {
        const test = new StandardCharacter(`
            <Character key=(test)>
                <Situation uuid=(DEFAULT) />
            </Character>
        `)
        const situation = new StandardKey("SITUATION#other")
        const added = test.withChild(new StandardReference(situation))
        expect(schemaToWML([added.schema])).toEqual(deIndentWML(`
            <Character key=(test)>
                <Situation uuid=(DEFAULT) />
                <Situation uuid=(other) />
            </Character>
        `))
    })

    it('round-trips render from StandardCharacterData to schema', () => {
        const testCharacterData: StandardCharacterData = {
            key: 'test',
            tag: 'Character',
            render: {
                displayName: 'Cached Name',
                summary: ['Summary text'],
                description: ['Description text'],
            },
        }
        const testCharacter = new StandardCharacter(testCharacterData)
        expect(testCharacter.render).toEqual(testCharacterData.render)
        expect(schemaToWML([testCharacter.schema])).toEqual(deIndentWML(`
            <Character key=(test)>
                <Render>
                    <DisplayName>Cached Name</DisplayName>
                    <Summary>Summary text</Summary>
                    <Description>Description text</Description>
                </Render>
            </Character>
        `))
    })
})
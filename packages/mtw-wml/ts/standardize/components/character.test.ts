import { schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardCharacterData } from "./dataTypes/character"
import { StandardCharacter } from './character'
import { mergeTest } from "./utils/testing"
import { excludeUndefined } from "../../lib/lists"

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
})
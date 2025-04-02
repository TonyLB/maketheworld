import { schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardCharacterData } from "./dataTypes/character"
import { StandardCharacter } from './character'
import { mergeTest } from "./utils/testing"
import { StandardReplace } from "./edits"

describe('StandardCharacter class', () => {
    it('should construct StandardCharacter from schema', () => {
        const testSource = deIndentWML(`
            <Character key=(test)>
                <ShortName>Tess</ShortName>
                <Pronouns
                    subject="she"
                    object="her"
                    possessive="her"
                    adjective="hers"
                    reflexive="herself"
                />
            </Character>
        `)
        const testCharacter = new StandardCharacter(testSource)
        expect(testCharacter.key).toEqual('test')
        expect(testCharacter.pronouns).toEqual({ data: { tag: 'Pronouns', subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }, children: [] })
        expect(testCharacter.shortName?.toJSON()).toEqual('Tess')
        expect(schemaToWML([testCharacter.schema])).toEqual(testSource)
    })

    it('should construct StandardCharacter from StandardCharacterData', () => {
        const testCharacterData: StandardCharacterData = {
            key: 'test',
            tag: 'Character',
            pronouns: { data: { tag: 'Pronouns', subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }, children: [] },
            shortName: 'Tess',
        }
        const testCharacter = new StandardCharacter(testCharacterData)
        expect(testCharacter.key).toEqual('test')
        expect(testCharacter.pronouns).toEqual({ data: { tag: 'Pronouns', subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }, children: [] })
        expect(testCharacter.shortName?.toJSON()).toEqual('Tess')
        expect(testCharacter.toJSON()).toEqual(testCharacterData)
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            `<Character key=(test)>
                <Name>Tess</Name>
                <Pronouns
                    subject="she"
                    object="her"
                    possessive="her"
                    adjective="hers"
                    reflexive="herself"
                />
            </Character>`,
            StandardCharacter,
            `<Character key=(test)>
                <Name>Tess</Name>
                <Pronouns
                    subject="they"
                    object="them"
                    possessive="their"
                    adjective="theirs"
                    reflexive="themself"
                />
            </Character>`
        )).toEqual(deIndentWML(`
            <Character key=(test)>
                <Name>Tess</Name>
                <Pronouns
                    subject="they"
                    object="them"
                    possessive="their"
                    adjective="theirs"
                    reflexive="themself"
                />
            </Character>
        `))
    })

    it('should diff identical components correctly', () => {
        const testCharacter = new StandardCharacter({
            key: 'test',
            tag: 'Character',
            pronouns: { data: { tag: 'Pronouns', subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }, children: [] },
            name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Tess' }, children: [] }] },
        })
        expect(testCharacter.diff(testCharacter)).toBeUndefined()
    })

    it('should diff different components correctly', () => {
        const testCharacter = new StandardCharacter({
            key: 'test',
            tag: 'Character',
            pronouns: { data: { tag: 'Pronouns', subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }, children: [] },
            name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Tess' }, children: [] }] },
        })
        const testCharacter2 = new StandardCharacter({
            key: 'test',
            tag: 'Character',
            pronouns: { data: { tag: 'Pronouns', subject: 'they', object: 'them', possessive: 'their', adjective: 'theirs', reflexive: 'themself' }, children: [] },
            name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Tess' }, children: [] }] },
        })
        expect(testCharacter.diff(testCharacter2)?.toJSON()).toEqual(new StandardReplace(testCharacter, testCharacter2).toJSON())
    })
})
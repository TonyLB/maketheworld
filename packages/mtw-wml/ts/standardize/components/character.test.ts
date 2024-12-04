import { schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardCharacterData } from "./dataTypes/character"
import { StandardCharacter } from './character'
import { mergeTest } from "./utils/testing"

describe('StandardCharacter class', () => {
    it('should construct StandardCharacter from schema', () => {
        const testSource = deIndentWML(`
            <Character key=(test)>
                <Name>Tess</Name>
                <Pronouns
                    subject="she"
                    object="her"
                    possessive="her"
                    adjective="hers"
                    reflexive="herself"
                />
                <FirstImpression>Ragged waif</FirstImpression>
                <OneCoolThing>Silvery eyes</OneCoolThing>
                <Outfit>Rags</Outfit>
            </Character>
        `)
        const testRoom = new StandardCharacter(testSource)
        expect(testRoom.key).toEqual('test')
        expect(testRoom.pronouns).toEqual({ data: { tag: 'Pronouns', subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }, children: [] })
        expect(testRoom.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Tess' }, children: [] }] })
        expect(testRoom.firstImpression).toEqual({ data: { tag: 'FirstImpression', value: 'Ragged waif' }, children: [] })
        expect(testRoom.oneCoolThing).toEqual({ data: { tag: 'OneCoolThing', value: 'Silvery eyes' }, children: [] })
        expect(testRoom.outfit).toEqual({ data: { tag: 'Outfit', value:  'Rags' }, children: [] })
        expect(schemaToWML([testRoom.schema])).toEqual(testSource)
    })

    it('should construct StandardCharacter from StandardCharacterData', () => {
        const testRoomData: StandardCharacterData = {
            key: 'test',
            tag: 'Character',
            pronouns: { data: { tag: 'Pronouns', subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }, children: [] },
            name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Tess' }, children: [] }] },
            firstImpression: { data: { tag: 'FirstImpression', value: 'Ragged waif' }, children: [] },
            oneCoolThing: { data: { tag: 'OneCoolThing', value: 'Silvery eyes' }, children: [] },
            outfit: { data: { tag: 'Outfit', value:  'Rags' }, children: [] }
        }
        const testRoom = new StandardCharacter(testRoomData)
        expect(testRoom.key).toEqual('test')
        expect(testRoom.pronouns).toEqual({ data: { tag: 'Pronouns', subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }, children: [] })
        expect(testRoom.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Tess' }, children: [] }] })
        expect(testRoom.firstImpression).toEqual({ data: { tag: 'FirstImpression', value: 'Ragged waif' }, children: [] })
        expect(testRoom.oneCoolThing).toEqual({ data: { tag: 'OneCoolThing', value: 'Silvery eyes' }, children: [] })
        expect(testRoom.outfit).toEqual({ data: { tag: 'Outfit', value:  'Rags' }, children: [] })
        expect(testRoom.toJSON()).toEqual(testRoomData)
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
                <FirstImpression>Ragged waif</FirstImpression>
                <OneCoolThing>Silvery eyes</OneCoolThing>
                <Outfit>Rags</Outfit>
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
                <FirstImpression>Ragged waif</FirstImpression>
                <OneCoolThing>Silvery eyes</OneCoolThing>
                <Outfit>Rags</Outfit>
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
                <FirstImpression>Ragged waif</FirstImpression>
                <OneCoolThing>Silvery eyes</OneCoolThing>
                <Outfit>Rags</Outfit>
            </Character>
        `))
    })
})
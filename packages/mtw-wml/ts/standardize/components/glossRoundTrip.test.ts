import { Schema, schemaToWML } from '../../schema'
import { deIndentWML } from '../../schema/utils'
import { StandardComponent } from './baseClasses'
import { StandardCharacter } from './character'
import StandardFeature from './feature'
import StandardArea from './area'
import { StandardRoom } from './room'
import StandardObject from './object'
import { StandardObjectData } from './dataTypes/object'

const LABEL = 'a red tin cup, fist-sized, light'

type RoundTripCase = {
    tag: string
    wml: string
    expected: string
    Component: new (wml: string) => StandardComponent
}

const glossRoundTripCases: RoundTripCase[] = [
    {
        tag: 'Character',
        wml: `
            <Character key=(test)>
                <ShortName>Test</ShortName>
                <Gloss>${LABEL}</Gloss>
            </Character>
        `,
        expected: `
            <Character key=(test)>
                <ShortName>Test</ShortName>
                <Gloss>${LABEL}</Gloss>
            </Character>
        `,
        Component: StandardCharacter,
    },
    {
        tag: 'Room',
        wml: `
            <Room key=(test)>
                <ShortName>Test</ShortName>
                <Gloss>${LABEL}</Gloss>
            </Room>
        `,
        expected: `
            <Room key=(test)>
                <ShortName>Test</ShortName>
                <Gloss>${LABEL}</Gloss>
            </Room>
        `,
        Component: StandardRoom,
    },
    {
        tag: 'Feature',
        wml: `
            <Feature key=(test)>
                <ShortName>Test</ShortName>
                <Gloss>${LABEL}</Gloss>
            </Feature>
        `,
        expected: `
            <Feature key=(test)>
                <ShortName>Test</ShortName>
                <Gloss>${LABEL}</Gloss>
            </Feature>
        `,
        Component: StandardFeature,
    },
    {
        tag: 'Area',
        wml: `<Area key=(test)><Gloss>${LABEL}</Gloss></Area>`,
        expected: `<Area key=(test)><Gloss>${LABEL}</Gloss></Area>`,
        Component: StandardArea,
    },
]

describe.each(glossRoundTripCases)('$tag gloss round-trip', ({ wml, expected, Component }) => {
    it('parses Gloss and round-trips schema', () => {
        const component = new Component(deIndentWML(wml))
        expect(component.gloss?.toJSON()).toEqual(LABEL)
        expect(schemaToWML([component.schema])).toEqual(deIndentWML(expected))
    })
})

describe('Object gloss round-trip (nested in Room context, per Object\'s own content model)', () => {
    it('parses Gloss inside Object and round-trips schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Asset uuid=(Test)>
                <Object uuid=(test)>
                    <ShortName>Test</ShortName>
                    <Gloss>${LABEL}</Gloss>
                </Object>
            </Asset>
        `)
        schema.loadWML(testSource)
        const objectNode = schema.schema[0].children[0]
        const object = new StandardObject(objectNode)
        expect(object.gloss?.toJSON()).toEqual(LABEL)
        const printed = schemaToWML([object.schema])
        expect(printed).toContain(`<Gloss>${LABEL}</Gloss>`)
    })
})

describe('Gloss is optional (RG-2)', () => {
    it('parses Object with no Gloss child at all, no error', () => {
        const object = new StandardObject({ tag: 'Object', universalKey: 'OBJECT#test', shortName: 'Test' } as StandardObjectData)
        expect(object.gloss).toBeUndefined()
    })

    it('contrasts with Object ShortName, which is required and throws when absent from WML', () => {
        expect(() => new StandardObject(deIndentWML(`
            <Asset uuid=(Test)>
                <Object uuid=(test)></Object>
            </Asset>
        `))).toThrow()
    })
})

describe('Gloss is trimmed (RG-2)', () => {
    it('trims leading and trailing whitespace', () => {
        const object = new StandardObject({ tag: 'Object', universalKey: 'OBJECT#test', shortName: 'Test', gloss: `  ${LABEL}  ` } as StandardObjectData)
        expect(object.gloss?.toJSON()).toEqual(LABEL)
    })
})

describe('An empty Gloss is absent, not an error (RG-2)', () => {
    it('an empty-string Gloss leaves gloss undefined, without throwing', () => {
        expect(() => new StandardObject({ tag: 'Object', universalKey: 'OBJECT#test', shortName: 'Test', gloss: '' } as StandardObjectData)).not.toThrow()
        const object = new StandardObject({ tag: 'Object', universalKey: 'OBJECT#test', shortName: 'Test', gloss: '' } as StandardObjectData)
        expect(object.gloss).toBeUndefined()
    })

    it('a whitespace-only Gloss is absent as well', () => {
        const object = new StandardObject({ tag: 'Object', universalKey: 'OBJECT#test', shortName: 'Test', gloss: '   ' } as StandardObjectData)
        expect(object.gloss).toBeUndefined()
    })
})

describe('Gloss merge, invert, equality (shared literalFieldFactory mechanics)', () => {
    it('merges additively, matching mergeShortName/StandardLiteral.merge semantics (not a last-write-wins overwrite)', () => {
        const base = new StandardObject({ tag: 'Object', universalKey: 'OBJECT#test', gloss: 'old gloss' } as StandardObjectData)
        const incoming = new StandardObject({ tag: 'Object', universalKey: 'OBJECT#test', gloss: 'new gloss' } as StandardObjectData)
        const merged = base.merge(incoming) as StandardObject
        expect(merged.gloss?.toJSON()).toEqual('old glossnew gloss')
    })

    it('inverts a Gloss-carrying Object', () => {
        const object = new StandardObject({ tag: 'Object', universalKey: 'OBJECT#test', gloss: LABEL } as StandardObjectData)
        expect(() => object.invert()).not.toThrow()
    })

    it('Object: components differing only in Gloss are not equal; identical ones are', () => {
        const a = new StandardObject({ tag: 'Object', universalKey: 'OBJECT#test', gloss: 'gloss A' } as StandardObjectData)
        const b = new StandardObject({ tag: 'Object', universalKey: 'OBJECT#test', gloss: 'gloss B' } as StandardObjectData)
        const c = new StandardObject({ tag: 'Object', universalKey: 'OBJECT#test', gloss: 'gloss A' } as StandardObjectData)
        expect(a.equals(b)).toBe(false)
        expect(a.equals(c)).toBe(true)
    })

    it('Room: components differing only in Gloss are not equal; identical ones are', () => {
        const a = new StandardRoom(deIndentWML('<Room key=(test)><Gloss>gloss A</Gloss></Room>'))
        const b = new StandardRoom(deIndentWML('<Room key=(test)><Gloss>gloss B</Gloss></Room>'))
        const c = new StandardRoom(deIndentWML('<Room key=(test)><Gloss>gloss A</Gloss></Room>'))
        expect(a.equals(b)).toBe(false)
        expect(a.equals(c)).toBe(true)
    })

    it('Feature: components differing only in Gloss are not equal; identical ones are', () => {
        const a = new StandardFeature(deIndentWML('<Feature key=(test)><Gloss>gloss A</Gloss></Feature>'))
        const b = new StandardFeature(deIndentWML('<Feature key=(test)><Gloss>gloss B</Gloss></Feature>'))
        const c = new StandardFeature(deIndentWML('<Feature key=(test)><Gloss>gloss A</Gloss></Feature>'))
        expect(a.equals(b)).toBe(false)
        expect(a.equals(c)).toBe(true)
    })

    it('Area: components differing only in Gloss are not equal; identical ones are', () => {
        const a = new StandardArea(deIndentWML('<Area key=(test)><Gloss>gloss A</Gloss></Area>'))
        const b = new StandardArea(deIndentWML('<Area key=(test)><Gloss>gloss B</Gloss></Area>'))
        const c = new StandardArea(deIndentWML('<Area key=(test)><Gloss>gloss A</Gloss></Area>'))
        expect(a.equals(b)).toBe(false)
        expect(a.equals(c)).toBe(true)
    })
})

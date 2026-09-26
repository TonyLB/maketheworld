import { Schema, schemaToWML } from '../../schema'
import { deIndentWML } from '../../schema/utils'
import { StandardComponent } from './baseClasses'
import { StandardCharacter } from './character'
import StandardFeature from './feature'
import StandardArea from './area'
import { StandardRoom } from './room'
import StandardObject from './object'
import { StandardObjectData } from './dataTypes/object'
import { StandardCharacterData } from './dataTypes/character'
import { StandardGuidanceInputData } from './dataTypes/guidance'
import { StandardLensInputData } from './dataTypes/lens'
import { GlossHost, isGlossHost } from './glossField'
import { StandardKnowledge } from './knowledge'
import { StandardGuidance } from './guidance'
import { StandardLens } from './worldState'
import { StandardLiteral } from '../literal'

const LABEL = 'a red tin cup, fist-sized, light'

type RoundTripCase = {
    tag: string
    wml: string
    expected: string
    Component: new (wml: string) => StandardComponent & GlossHost
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

describe('Gloss is optional', () => {
    it('parses Object with no Gloss child at all, no error', () => {
        const object = new StandardObject({ tag: 'Object', universalKey: 'OBJECT#test', shortName: 'Test' } as StandardObjectData)
        expect(object.gloss).toBeUndefined()
    })

    it('parses Object with no ShortName child at all, no error (ShortName is optional on Object, like every other kind)', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Asset uuid=(Test)>
                <Object uuid=(test)></Object>
            </Asset>
        `)
        schema.loadWML(testSource)
        const objectNode = schema.schema[0].children[0]
        const object = new StandardObject(objectNode)
        expect(object.shortName).toBeUndefined()
        const printed = schemaToWML([object.schema])
        expect(printed).toEqual('<Object uuid=(test) />')
    })
})

describe('Gloss is trimmed', () => {
    it('trims leading and trailing whitespace', () => {
        const object = new StandardObject({ tag: 'Object', universalKey: 'OBJECT#test', shortName: 'Test', gloss: `  ${LABEL}  ` } as StandardObjectData)
        expect(object.gloss?.toJSON()).toEqual(LABEL)
    })
})

describe('An empty Gloss is absent, not an error', () => {
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

describe('isGlossHost: only the five Gloss-hosting kinds declare the capability', () => {
    const hosts: { tag: string, build: () => StandardComponent[] }[] = [
        { tag: 'Room', build: () => { const c = new StandardRoom(deIndentWML('<Room key=(test) />')); return [c, new StandardRoom(c.toJSON()), c.clone()] } },
        { tag: 'Area', build: () => { const c = new StandardArea(deIndentWML('<Area key=(test) />')); return [c, new StandardArea(c.toJSON()), c.clone()] } },
        { tag: 'Feature', build: () => { const c = new StandardFeature(deIndentWML('<Feature key=(test) />')); return [c, new StandardFeature(c.toJSON()), c.clone()] } },
        { tag: 'Character', build: () => { const c = new StandardCharacter(deIndentWML('<Character key=(test) />')); return [c, new StandardCharacter(c.toJSON() as StandardCharacterData), c.clone()] } },
        { tag: 'Object', build: () => { const c = new StandardObject({ tag: 'Object', universalKey: 'OBJECT#test' } as StandardObjectData); return [c, new StandardObject(c.toJSON() as StandardObjectData), c.clone()] } },
    ]
    const nonHosts: { tag: string, build: () => StandardComponent[] }[] = [
        { tag: 'Knowledge', build: () => { const c = new StandardKnowledge(deIndentWML('<Knowledge key=(test) />')); return [c, new StandardKnowledge(c.toJSON()), c.clone()] } },
        { tag: 'Guidance', build: () => { const c = new StandardGuidance(deIndentWML('<Guidance key=(test) />')); return [c, new StandardGuidance(c.toJSON() as StandardGuidanceInputData), c.clone()] } },
        { tag: 'Lens', build: () => { const c = new StandardLens(deIndentWML('<Lens key=(test) />')); return [c, new StandardLens(c.toJSON() as StandardLensInputData), c.clone()] } },
    ]

    it.each(hosts)('$tag is a GlossHost (from WML/JSON, from JSON, and cloned)', ({ build }) => {
        build().forEach((component) => { expect(isGlossHost(component)).toBe(true) })
    })

    it.each(nonHosts)('$tag is not a GlossHost (from WML/JSON, from JSON, and cloned)', ({ build }) => {
        build().forEach((component) => { expect(isGlossHost(component)).toBe(false) })
    })

    //
    // The two compile-time cases below rely on @ts-expect-error / type annotations. ts-jest runs this
    // package transpile-only (tsconfig isolatedModules), and tsconfig excludes tests, so `npm test`
    // does NOT enforce them --- type-check this file with tsc to verify them.
    //
    it('narrows a StandardComponent so withGloss is callable only after the check (compile-time)', () => {
        const component: StandardComponent = new StandardRoom(deIndentWML('<Room key=(test) />'))
        // @ts-expect-error withGloss is not on the StandardComponent interface
        expect(typeof component.withGloss).toBe('function')
        const knowledge = new StandardKnowledge(deIndentWML('<Knowledge key=(test) />'))
        // @ts-expect-error Knowledge does not host a Gloss
        expect(knowledge.withGloss).toBeUndefined()
        const glossed = isGlossHost(component) ? component.withGloss(new StandardLiteral(LABEL, { tag: 'Gloss' })) : component
        expect(isGlossHost(glossed) ? glossed.gloss?.toJSON() : undefined).toEqual(LABEL)
    })

    it('withShortName returns the concrete class (compile-time)', () => {
        const room = new StandardRoom(deIndentWML('<Room key=(test) />'))
        const renamed: StandardRoom = room.withShortName(new StandardLiteral('Renamed', { tag: 'ShortName' }))
        expect(renamed.shortName?.toJSON()).toEqual('Renamed')
    })
})

describe('withGloss on each host round-trips to <Gloss> in WML', () => {
    it.each(glossRoundTripCases)('$tag: withGloss adds and removes <Gloss>, leaving the receiver unchanged', ({ tag, Component }) => {
        const original = new Component(deIndentWML(`<${tag} key=(test) />`))
        const glossed = original.withGloss(new StandardLiteral(LABEL, { tag: 'Gloss' }))
        expect(schemaToWML([glossed.schema])).toContain(`<Gloss>${LABEL}</Gloss>`)
        expect(original.gloss).toBeUndefined()
        expect(schemaToWML([original.schema])).not.toContain('<Gloss>')
        const cleared = glossed.withGloss(undefined)
        expect(cleared.gloss).toBeUndefined()
        expect(schemaToWML([cleared.schema])).not.toContain('<Gloss>')
        expect(glossed.gloss?.toJSON()).toEqual(LABEL)
    })

    it('Object: withGloss adds and removes <Gloss>, leaving the receiver unchanged', () => {
        const original = new StandardObject({ tag: 'Object', universalKey: 'OBJECT#test' } as StandardObjectData)
        const glossed = original.withGloss(new StandardLiteral(LABEL, { tag: 'Gloss' }))
        expect(schemaToWML([glossed.schema])).toContain(`<Gloss>${LABEL}</Gloss>`)
        expect(original.gloss).toBeUndefined()
        const cleared = glossed.withGloss(undefined)
        expect(schemaToWML([cleared.schema])).not.toContain('<Gloss>')
    })
})

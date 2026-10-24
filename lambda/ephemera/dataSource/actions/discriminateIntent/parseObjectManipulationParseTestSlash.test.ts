import { isObjectManipulationParseTestSlashCommand } from './objectManipulationParseTestSlashCommand'
import { parseObjectManipulationParseTestSlashTail } from './parseObjectManipulationParseTestSlash'

describe('isObjectManipulationParseTestSlashCommand', () => {
    it('matches the prefix alone or followed by whitespace', () => {
        expect(isObjectManipulationParseTestSlashCommand('/test parse')).toBe(true)
        expect(isObjectManipulationParseTestSlashCommand(' /test parse 3 ')).toBe(true)
        expect(isObjectManipulationParseTestSlashCommand('/test parse "get cup"')).toBe(true)
    })

    it('does not match a longer word or another command', () => {
        expect(isObjectManipulationParseTestSlashCommand('/test parsefoo')).toBe(false)
        expect(isObjectManipulationParseTestSlashCommand('/test affinities')).toBe(false)
        expect(isObjectManipulationParseTestSlashCommand('parse the cup')).toBe(false)
    })
})

describe('parseObjectManipulationParseTestSlashTail', () => {
    it('runs every fixture with no tail', () => {
        expect(parseObjectManipulationParseTestSlashTail('/test parse', 5)).toEqual({ ok: true })
    })

    it('selects one fixture by 1-based index', () => {
        expect(parseObjectManipulationParseTestSlashTail('/test parse 5', 5)).toEqual({
            ok: true,
            harnessInvocation: { fixtureIndex1Based: 5 },
        })
    })

    it('takes a quoted command as free text, straight or curly quotes', () => {
        expect(parseObjectManipulationParseTestSlashTail('/test parse "get bag from table"', 5)).toEqual({
            ok: true,
            harnessInvocation: { command: 'get bag from table' },
        })
        expect(parseObjectManipulationParseTestSlashTail('/test parse “put cup on saucer on table”', 5)).toEqual({
            ok: true,
            harnessInvocation: { command: 'put cup on saucer on table' },
        })
    })

    it('refuses an out-of-range or malformed index', () => {
        for (const tail of ['6', '0', '-1', '1.5', 'abc', '3 4']) {
            expect(parseObjectManipulationParseTestSlashTail(`/test parse ${tail}`, 5)).toEqual({
                ok: false,
                errorMessage: expect.stringContaining('Parse test (/test parse)'),
            })
        }
    })

    it('refuses an unquoted or empty command', () => {
        expect(parseObjectManipulationParseTestSlashTail('/test parse get bag', 5)).toMatchObject({ ok: false })
        expect(parseObjectManipulationParseTestSlashTail('/test parse "get bag', 5)).toMatchObject({ ok: false })
        expect(parseObjectManipulationParseTestSlashTail('/test parse "  "', 5)).toMatchObject({ ok: false })
    })
})

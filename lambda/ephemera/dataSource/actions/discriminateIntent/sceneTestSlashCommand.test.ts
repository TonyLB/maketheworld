import { isSceneTestSlashCommand, parseSceneTestSlashTail } from './sceneTestSlashCommand'

describe('isSceneTestSlashCommand', () => {
    it('matches the prefix alone or followed by whitespace', () => {
        expect(isSceneTestSlashCommand('/test scene')).toBe(true)
        expect(isSceneTestSlashCommand('  /test scene  ')).toBe(true)
        expect(isSceneTestSlashCommand('/test scene extra')).toBe(true)
    })

    it('does not match a longer word or another command', () => {
        expect(isSceneTestSlashCommand('/test scenefoo')).toBe(false)
        expect(isSceneTestSlashCommand('/test parse')).toBe(false)
        expect(isSceneTestSlashCommand('scene')).toBe(false)
    })
})

describe('parseSceneTestSlashTail', () => {
    it('accepts no tail', () => {
        expect(parseSceneTestSlashTail('/test scene')).toEqual({ ok: true })
    })

    it('takes a format name, in any case', () => {
        expect(parseSceneTestSlashTail('/test scene fans')).toEqual({ ok: true, format: 'fans' })
        expect(parseSceneTestSlashTail('/test scene d')).toEqual({ ok: true, format: 'D' })
    })

    it('refuses any other tail, listing the formats', () => {
        const result = parseSceneTestSlashTail('/test scene tavern')
        expect(result).toEqual({ ok: false, errorMessage: expect.stringContaining('one of: D, fans') })
    })
})

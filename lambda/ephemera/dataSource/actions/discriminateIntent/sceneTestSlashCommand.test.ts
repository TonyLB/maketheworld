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

    it('refuses any tail with usage guidance', () => {
        const result = parseSceneTestSlashTail('/test scene tavern')
        expect(result).toEqual({ ok: false, errorMessage: expect.stringContaining('takes no argument') })
    })
})

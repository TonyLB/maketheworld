import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ParseCommandInput } from '../baseClasses'
import { navigationIntentErrorMessages } from '../discriminateIntent/exitResolution'
import { matchNavigationParaphrase } from './matchNavigationParaphrase'

const northRoom = 'ROOM#north' as EphemeraRoomId

const baseInput: ParseCommandInput = {
    command: '',
    roomExits: [{ normalizedName: 'north', targetId: northRoom }],
}

describe('matchNavigationParaphrase', () => {
    it('resolves a movement-verb paraphrase to a terminal Navigation result', () => {
        for (const verb of ['head', 'walk', 'move', 'travel', 'enter']) {
            const result = matchNavigationParaphrase({ ...baseInput, command: `${verb} north` })
            expect(result).toEqual({ type: 'Navigation', targetId: northRoom, exitName: 'north', confidence: 1 })
        }
    })

    it('is case-insensitive on the verb', () => {
        expect(matchNavigationParaphrase({ ...baseInput, command: 'Head North' })).toEqual({
            type: 'Navigation',
            targetId: northRoom,
            exitName: 'north',
            confidence: 1,
        })
    })

    it('does not intercept bare "go" -- that stays deterministicChecks.ts\'s job', () => {
        expect(matchNavigationParaphrase({ ...baseInput, command: 'go north' })).toBeNull()
    })

    it('returns null for non-movement commands', () => {
        expect(matchNavigationParaphrase({ ...baseInput, command: 'take sword' })).toBeNull()
    })

    it('surfaces a specific Error on no matching exit (explicit verb makes it unambiguous)', () => {
        expect(matchNavigationParaphrase({ ...baseInput, command: 'head south' })).toEqual({
            type: 'Error',
            errorMessage: navigationIntentErrorMessages.noMatch,
        })
    })

    it('surfaces a specific Error on an ambiguous exit label', () => {
        const input: ParseCommandInput = {
            command: 'head north',
            roomExits: [
                { normalizedName: 'north', targetId: 'ROOM#north1' as EphemeraRoomId },
                { normalizedName: 'north', targetId: 'ROOM#north2' as EphemeraRoomId },
            ],
        }
        expect(matchNavigationParaphrase(input)).toEqual({
            type: 'Error',
            errorMessage: navigationIntentErrorMessages.ambiguousMatch,
        })
    })

    it('returns null (falls through) when there is no room-exit context at all', () => {
        expect(matchNavigationParaphrase({ command: 'head north' })).toBeNull()
    })

    it('returns null for an empty command', () => {
        expect(matchNavigationParaphrase({ ...baseInput, command: '' })).toBeNull()
    })
})

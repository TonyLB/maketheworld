import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { compileDescribeFromSkeleton } from './compileDescribeFromSkeleton'
import type { ParseSkeleton } from './parse/parseToken'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

const rocketSkatesId = 'OBJECT#RocketSkates' as EphemeraObjectId
const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId

const lookSkeleton = (verb: string, span: string, stableRefKey: string): ParseSkeleton => [
    { type: 'text', text: verb },
    { type: 'objectSpan', span, stableRefKey },
]

describe('compileDescribeFromSkeleton', () => {
    it('returns LookComponent for a matched closed-template command with grounded catalog', async () => {
        const result = await compileDescribeFromSkeleton(
            {
                command: 'look rocket skates',
                skeleton: lookSkeleton('look', 'rocket skates', 'rocketSkatesRef'),
                characterId,
                roomObjectCatalog: [{ objectId: rocketSkatesId, normalizedShortName: 'rocket skates' }],
            },
            0.9
        )

        expect(result).toEqual({
            type: 'LookComponent',
            componentId: rocketSkatesId,
            confidence: 0.9,
        })
    })

    it('matches "examine" the same way as "look"', async () => {
        const result = await compileDescribeFromSkeleton(
            {
                command: 'examine rocket skates',
                skeleton: lookSkeleton('examine', 'rocket skates', 'rocketSkatesRef'),
                characterId,
                roomObjectCatalog: [{ objectId: rocketSkatesId, normalizedShortName: 'rocket skates' }],
            },
            0.9
        )

        expect(result).toEqual({
            type: 'LookComponent',
            componentId: rocketSkatesId,
            confidence: 0.9,
        })
    })

    it('resolves from the held-inventory catalog as well as the room catalog', async () => {
        const result = await compileDescribeFromSkeleton(
            {
                command: 'look lantern',
                skeleton: lookSkeleton('look', 'lantern', 'lanternRef'),
                characterId,
                heldInventoryCatalog: [{ objectId: rocketSkatesId, normalizedShortName: 'lantern' }],
            },
            0.9
        )

        expect(result).toEqual({
            type: 'LookComponent',
            componentId: rocketSkatesId,
            confidence: 0.9,
        })
    })

    it('abstains when the skeleton does not match the closed look template', async () => {
        const result = await compileDescribeFromSkeleton(
            {
                command: 'balance broom carefully',
                skeleton: [
                    { type: 'text', text: 'balance' },
                    { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
                    { type: 'text', text: 'carefully' },
                ],
                characterId,
            },
            0.9
        )

        expect(result).toEqual({
            type: 'Abstain',
            confidence: 0.9,
            reason: objectManipulationErrorMessages.lookNoTemplateMatch,
        })
    })

    it('returns noActingCharacter Error when characterId is absent', async () => {
        const result = await compileDescribeFromSkeleton(
            {
                command: 'look rocket skates',
                skeleton: lookSkeleton('look', 'rocket skates', 'rocketSkatesRef'),
                roomObjectCatalog: [{ objectId: rocketSkatesId, normalizedShortName: 'rocket skates' }],
            },
            0.9
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.noActingCharacter,
        })
    })

    it('errors when there is no catalog to resolve the span against', async () => {
        const result = await compileDescribeFromSkeleton(
            {
                command: 'look sword',
                skeleton: lookSkeleton('look', 'sword', 'swordRef'),
                characterId,
            },
            0.9
        )

        expect(result.type).toBe('Error')
    })
})

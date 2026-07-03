import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { collapseUnaryGrounding } from './unaryCollapse'
import type { SpanGrounding } from './identityStage'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

const broomId = 'OBJECT#Broom' as EphemeraObjectId

describe('collapseUnaryGrounding', () => {
    it('returns single resolved grounding', () => {
        const groundings: SpanGrounding[] = [{
            type: 'resolved',
            objectId: broomId,
            catalogScope: 'room',
        }]
        expect(collapseUnaryGrounding(groundings)).toEqual({
            type: 'resolved',
            objectId: broomId,
            catalogScope: 'room',
        })
    })

    it('returns single resolved grounding for held scope', () => {
        const groundings: SpanGrounding[] = [{
            type: 'resolved',
            objectId: broomId,
            catalogScope: 'held',
        }]
        expect(collapseUnaryGrounding(groundings)).toEqual({
            type: 'resolved',
            objectId: broomId,
            catalogScope: 'held',
        })
    })

    it('returns error when no resolved groundings', () => {
        const groundings: SpanGrounding[] = [{ type: 'noMatch' }]
        const result = collapseUnaryGrounding(groundings)
        expect(result.type).toBe('error')
        if (result.type === 'error') {
            expect(result.errorMessage).toBe(objectManipulationErrorMessages.noMatch)
        }
    })

    it('returns error when multiple resolved groundings', () => {
        const groundings: SpanGrounding[] = [
            { type: 'resolved', objectId: broomId, catalogScope: 'room' },
            { type: 'resolved', objectId: 'OBJECT#Anvil' as EphemeraObjectId, catalogScope: 'room' },
        ]
        const result = collapseUnaryGrounding(groundings)
        expect(result.type).toBe('error')
        if (result.type === 'error') {
            expect(result.errorMessage).toBe(objectManipulationErrorMessages.ambiguousMatch)
        }
    })
})

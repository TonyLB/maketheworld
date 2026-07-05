import { interpretManipulationFrameExtractBody } from './interpretFrameExtract'
import { objectManipulationErrorMessages } from '../resolveObjectSpan'

describe('interpretManipulationFrameExtractBody', () => {
    it('accepts valid frame extract JSON with establishRelation', () => {
        expect(interpretManipulationFrameExtractBody(
            '{"subjectSpan":"broom","targetSpan":"table","relationSpan":"on","operationKind":"establishRelation"}'
        )).toEqual({
            success: true,
            response: {
                subjectSpan: 'broom',
                targetSpan: 'table',
                relationSpan: 'on',
                operationKind: 'establishRelation',
            },
        })
    })

    it('accepts valid frame extract JSON with dissolveRelation', () => {
        expect(interpretManipulationFrameExtractBody(
            '{"subjectSpan":"rope","targetSpan":"crate","relationSpan":"off","operationKind":"dissolveRelation"}'
        )).toEqual({
            success: true,
            response: {
                subjectSpan: 'rope',
                targetSpan: 'crate',
                relationSpan: 'off',
                operationKind: 'dissolveRelation',
            },
        })
    })

    it('trims span whitespace', () => {
        expect(interpretManipulationFrameExtractBody(
            '{"subjectSpan":" rope ","targetSpan":" anvil ","relationSpan":" against ","operationKind":"establishRelation"}'
        )).toEqual({
            success: true,
            response: {
                subjectSpan: 'rope',
                targetSpan: 'anvil',
                relationSpan: 'against',
                operationKind: 'establishRelation',
            },
        })
    })

    it('rejects forbidden routing fields', () => {
        const parsed = interpretManipulationFrameExtractBody(
            '{"subjectSpan":"broom","targetSpan":"table","relationSpan":"on","operationKind":"establishRelation","objectId":"OBJECT#Broom"}'
        )
        expect(parsed.success).toBe(false)
    })

    it('rejects empty subjectSpan', () => {
        const parsed = interpretManipulationFrameExtractBody(
            '{"subjectSpan":"  ","targetSpan":"table","relationSpan":"on","operationKind":"establishRelation"}'
        )
        expect(parsed.success).toBe(false)
        if (!parsed.success) {
            expect(parsed.errorMessage).toBe('Object manipulation frame extract requires subjectSpan')
        }
    })

    it('rejects missing operationKind', () => {
        const parsed = interpretManipulationFrameExtractBody(
            '{"subjectSpan":"broom","targetSpan":"table","relationSpan":"on"}'
        )
        expect(parsed.success).toBe(false)
        if (!parsed.success) {
            expect(parsed.errorMessage).toBe('Object manipulation frame extract requires operationKind')
        }
    })

    it('rejects invalid operationKind', () => {
        const parsed = interpretManipulationFrameExtractBody(
            '{"subjectSpan":"broom","targetSpan":"table","relationSpan":"on","operationKind":"takeHold"}'
        )
        expect(parsed.success).toBe(false)
        if (!parsed.success) {
            expect(parsed.errorMessage).toBe('Object manipulation frame extract operationKind must be establishRelation or dissolveRelation')
        }
    })

    it('rejects invalid JSON', () => {
        const parsed = interpretManipulationFrameExtractBody('not json')
        expect(parsed.success).toBe(false)
        if (!parsed.success) {
            expect(parsed.errorMessage).toBe(objectManipulationErrorMessages.frameExtractParseFailed)
        }
    })
})

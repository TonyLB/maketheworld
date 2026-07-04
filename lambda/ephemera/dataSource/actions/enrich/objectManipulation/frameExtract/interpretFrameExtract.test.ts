import { interpretManipulationFrameExtractBody } from './interpretFrameExtract'
import { objectManipulationErrorMessages } from '../resolveObjectSpan'

describe('interpretManipulationFrameExtractBody', () => {
    it('accepts valid frame extract JSON', () => {
        expect(interpretManipulationFrameExtractBody(
            '{"subjectSpan":"broom","targetSpan":"table","relationSpan":"on"}'
        )).toEqual({
            success: true,
            response: {
                subjectSpan: 'broom',
                targetSpan: 'table',
                relationSpan: 'on',
            },
        })
    })

    it('trims span whitespace', () => {
        expect(interpretManipulationFrameExtractBody(
            '{"subjectSpan":" rope ","targetSpan":" anvil ","relationSpan":" against "}'
        )).toEqual({
            success: true,
            response: {
                subjectSpan: 'rope',
                targetSpan: 'anvil',
                relationSpan: 'against',
            },
        })
    })

    it('rejects forbidden routing fields', () => {
        const parsed = interpretManipulationFrameExtractBody(
            '{"subjectSpan":"broom","targetSpan":"table","relationSpan":"on","objectId":"OBJECT#Broom"}'
        )
        expect(parsed.success).toBe(false)
    })

    it('rejects empty subjectSpan', () => {
        const parsed = interpretManipulationFrameExtractBody(
            '{"subjectSpan":"  ","targetSpan":"table","relationSpan":"on"}'
        )
        expect(parsed.success).toBe(false)
        if (!parsed.success) {
            expect(parsed.errorMessage).toBe('Object manipulation frame extract requires subjectSpan')
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

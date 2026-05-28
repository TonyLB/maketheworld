import { isSchemaComponentTag, isSchemaComponentUUID } from '.'

describe('component UUID validation', () => {
    describe('isSchemaComponentTag', () => {
        it('should accept Area', () => {
            expect(isSchemaComponentTag('Area')).toBe(true)
        })
    })

    describe('isSchemaComponentUUID', () => {
        it('should accept AREA# universal keys', () => {
            expect(isSchemaComponentUUID('AREA#downtown')).toBe(true)
        })

        it('should still accept ROOM# universal keys', () => {
            expect(isSchemaComponentUUID('ROOM#vortex')).toBe(true)
        })

        it('should reject AREA# with empty id', () => {
            expect(isSchemaComponentUUID('AREA#')).toBe(false)
        })

        it('should reject AREA## with extra hash segments', () => {
            expect(isSchemaComponentUUID('AREA##x')).toBe(false)
        })

        it('should reject unknown component prefixes', () => {
            expect(isSchemaComponentUUID('NOTATAG#abc')).toBe(false)
        })
    })
})

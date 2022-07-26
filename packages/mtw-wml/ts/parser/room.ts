import { ParseTagFactory, ParseRoomTag } from "./baseClasses"
import { validateProperties, isValidateError, ExtractProperties } from "./utils"

export const parseRoomFactory: ParseTagFactory<ParseRoomTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseRoomTag, never> & { x?: string; y?: string }>({
        open,
        required: {
            key: ['key']
        },
        optional: {
            global: ['boolean'],
            x: ['literal'],
            y: ['literal']
        }
    })
    if (isValidateError(validate)) {
        return {
            type: 'Tag',
            tag: validate
        }
    }
    else {
        const x = validate.x ? parseInt(validate.x) : undefined
        const y = validate.y ? parseInt(validate.y) : undefined
        if (x === NaN) {
            return {
                type: 'Tag',
                tag: {
                    tag: 'Error',
                    message: `Property 'x' in Room tag must be a number`
                }
            }
        }
        if (y === NaN) {
            return {
                type: 'Tag',
                tag: {
                    tag: 'Error',
                    message: `Property 'y' in Room tag must be a number`
                }
            }
        }
        return {
            type: 'Tag',
            tag: {
                ...validate,
                x,
                y,
                tag: 'Room',
                startTagToken: open.startTagToken,
                endTagToken,
                contents
            }
        }    
    }
}

export default parseRoomFactory

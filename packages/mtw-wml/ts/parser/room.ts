import { ParseTagFactory, ParseRoomTag, ParseException } from "./baseClasses"
import { validateProperties, ExtractProperties } from "./utils"

export const parseRoomFactory: ParseTagFactory<ParseRoomTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseRoomTag, never> & { x?: string; y?: string }>({
        open,
        endTagToken,
        required: {
            key: ['key']
        },
        optional: {
            global: ['boolean'],
            x: ['literal'],
            y: ['literal']
        }
    })
    const x = validate.x ? parseInt(validate.x) : undefined
    const y = validate.y ? parseInt(validate.y) : undefined
    if (x === NaN) {
        throw new ParseException(`Property 'x' in Room tag must be a number`, open.startTagToken, endTagToken)
    }
    if (y === NaN) {
        throw new ParseException(`Property 'y' in Room tag must be a number`, open.startTagToken, endTagToken)
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

export default parseRoomFactory

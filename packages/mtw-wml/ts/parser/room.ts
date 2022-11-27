import { ConverterMixinFactory, isTypedParseTagOpen } from "../convert/functionMixins";
import { ParseTagFactory, ParseRoomTag, ParseException, ParseRoomLegalContents } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents } from "./utils"

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
    if (validate.x && Number.isNaN(x)) {
        throw new ParseException(`Property 'x' in Room tag must be a number`, open.startTagToken, endTagToken)
    }
    if (validate.y && Number.isNaN(y)) {
        throw new ParseException(`Property 'y' in Room tag must be a number`, open.startTagToken, endTagToken)
    }
    const parseContents = validateContents<ParseRoomLegalContents>({
        contents,
        legalTags: ['Description', 'Name', 'Feature', 'Exit', 'If', 'Else', 'ElseIf'],
        ignoreTags: ['Whitespace', 'Comment']
    })
    return {
        type: 'Tag',
        tag: {
            ...validate,
            x,
            y,
            tag: 'Room',
            startTagToken: open.startTagToken,
            endTagToken,
            contents: parseContents
        }
    }    
}

export const ParseRoomMixin = ConverterMixinFactory({
    typeGuard: isTypedParseTagOpen('Room'),
    convert: ({ open, contents, endTagToken }) => {
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
        if (validate.x && Number.isNaN(x)) {
            throw new ParseException(`Property 'x' in Room tag must be a number`, open.startTagToken, endTagToken)
        }
        if (validate.y && Number.isNaN(y)) {
            throw new ParseException(`Property 'y' in Room tag must be a number`, open.startTagToken, endTagToken)
        }
        const parseContents = validateContents<ParseRoomLegalContents>({
            contents,
            legalTags: ['Description', 'Name', 'Feature', 'Exit', 'If', 'Else', 'ElseIf'],
            ignoreTags: ['Whitespace', 'Comment']
        })
        return {
            type: 'Tag',
            tag: {
                ...validate,
                x,
                y,
                tag: 'Room',
                startTagToken: open.startTagToken,
                endTagToken,
                contents: parseContents
            }
        }    
    }
})
    
export default parseRoomFactory

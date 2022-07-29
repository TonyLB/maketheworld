import { ParseTagFactory, ParseExitTag, ParseStringTag, ParseException } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents } from "./utils"

export const parseExitFactory: ParseTagFactory<ParseExitTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseExitTag, never>>({
        open,
        endTagToken,
        required: {},
        optional: {
            to: ['key'],
            from: ['key']
        }
    })
    if (!validate.to && !validate.from) {
        throw new ParseException(`Exit must include either a 'to' or 'from' property`, open.startTagToken, endTagToken)
    }
    const parseContents = validateContents<ParseStringTag>({
        contents,
        legalTags: ['String'],
        ignoreTags: ['Whitespace', 'Comment']
    })
    return {
        type: 'Tag',
        tag: {
            ...validate,
            tag: 'Exit',
            startTagToken: open.startTagToken,
            endTagToken,
            contents: parseContents
        }
    }    
}

export default parseExitFactory

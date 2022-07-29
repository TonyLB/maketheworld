import { ParseTagFactory, ParseNameTag, ParseStringTag } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents } from "./utils"

export const parseNameFactory: ParseTagFactory<ParseNameTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseNameTag, never>>({
        open,
        endTagToken,
        required: {},
        optional: {
            spaceBefore: ['boolean'],
            spaceAfter: ['boolean']
        }
    })
    const parseContents = validateContents<ParseStringTag>({
        contents,
        legalTags: ['String'],
        ignoreTags: ['Whitespace', 'Comment']
    })
    return {
        type: 'Tag',
        tag: {
            tag: 'Name',
            ...validate,
            value: parseContents.map(({ value }) => (value)).join(''),
            startTagToken: open.startTagToken,
            endTagToken
        }
    }    
}

export default parseNameFactory

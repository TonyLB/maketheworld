import { ParseTagFactory, ParseDescriptionTag, ParseWhitespaceTag, ParseStringTag, ParseLinkTag, ParseLineBreakTag } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents } from "./utils"

export const parseDescriptionFactory: ParseTagFactory<ParseDescriptionTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseDescriptionTag, never>>({
        open,
        endTagToken,
        required: {},
        optional: {}
    })
    const parseContents = validateContents<ParseWhitespaceTag | ParseStringTag | ParseLinkTag | ParseLineBreakTag>({
        contents,
        legalTags: ['Whitespace', 'String', 'Link', 'br'],
        ignoreTags: ['Comment']
    })
    return {
        type: 'Tag',
        tag: {
            ...validate,
            tag: 'Description',
            startTagToken: open.startTagToken,
            endTagToken,
            contents: parseContents
        }
    }    
}

export default parseDescriptionFactory

import { ParseTagFactory, ParseDescriptionTag, ParseWhitespaceTag, ParseStringTag, ParseLinkTag, ParseLineBreakTag, ParseSpacerTag } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents } from "./utils"

export const parseDescriptionFactory: ParseTagFactory<ParseDescriptionTag> = ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseDescriptionTag, never>>({
        open,
        endTagToken,
        required: {},
        optional: {
            spaceBefore: ['boolean'],
            spaceAfter: ['boolean']
        }
    })
    const parseContents = validateContents<ParseWhitespaceTag | ParseStringTag | ParseLinkTag | ParseLineBreakTag | ParseSpacerTag>({
        contents,
        legalTags: ['Whitespace', 'String', 'Link', 'br', 'Space'],
        ignoreTags: ['Comment']
    })
    return {
        type: 'Tag',
        tag: {
            ...validate,
            spaceAfter: validate.spaceAfter || false,
            spaceBefore: validate.spaceBefore || false,
            tag: 'Description',
            startTagToken: open.startTagToken,
            endTagToken,
            contents: parseContents
        }
    }    
}

export default parseDescriptionFactory

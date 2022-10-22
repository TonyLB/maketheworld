import { ParseTagFactory, ParseWhitespaceTag, ParseStringTag, ParseLinkTag, ParseLineBreakTag, ParseSpacerTag, ParseTaggedMessageLegalContents, ParseTaggedMessageTag } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents } from "./utils"

export const parseTaggedMessageContentsFactory = <T extends 'Description'>(tag: T, legalTags: ParseTaggedMessageLegalContents["tag"][]): ParseTagFactory<ParseTaggedMessageTag<T>> => ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseTaggedMessageTag<T>, never>>({
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
        legalTags: ['Whitespace', ...legalTags],
        ignoreTags: ['Comment']
    })
    return {
        type: 'Tag',
        tag: {
            ...validate,
            spaceAfter: validate.spaceAfter || false,
            spaceBefore: validate.spaceBefore || false,
            tag,
            startTagToken: open.startTagToken,
            endTagToken,
            contents: parseContents
        }
    }    
}

export default parseTaggedMessageContentsFactory

import { ParseTagFactory, ParseWhitespaceTag, ParseStringTag, ParseLinkTag, ParseLineBreakTag, ParseSpacerTag, ParseTaggedMessageLegalContents, ParseTaggedMessageTag, ParseNameTag, ParseDescriptionTag, ParseStackTagEntry } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents } from "./utils"

export const parseTaggedMessageContentsFactory = <T extends ParseDescriptionTag | ParseNameTag>(tag: T["tag"], legalTags: ParseTaggedMessageLegalContents["tag"][]): ParseTagFactory<T> => ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<T, never>>({
        open,
        endTagToken,
        required: {},
        optional: {}
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
            tag,
            startTagToken: open.startTagToken,
            endTagToken,
            contents: parseContents
        }
    } as ParseStackTagEntry<T>
}

export default parseTaggedMessageContentsFactory

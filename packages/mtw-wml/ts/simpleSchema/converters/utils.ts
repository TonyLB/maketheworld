import { GenericTree } from "../../sequence/tree/baseClasses"
import { ParsePropertyTypes, ParseTagOpen, ParseTagSelfClosure } from "../../simpleParser/baseClasses"
import { SchemaTag } from "../baseClasses"
import { ConverterMapValidateProperties, PrintMapOptionsChange, PrintMapOptionsFactory, ValidationTemplate, ValidationTemplateOutput } from "./baseClasses"

export const validateProperties = <V extends ValidationTemplate>(template: V) => (parse: ParseTagOpen | ParseTagSelfClosure): ValidationTemplateOutput<V> => {
    const unmatchedKey = parse.properties.find(({ key }) => (!((key ?? 'DEFAULT') in template)))
    if (unmatchedKey) {
        throw new Error(`Property '${unmatchedKey.key}' is not allowed in '${parse.tag}' items.`)
    }
    const remap = Object.assign({}, ...Object.entries(template).map(([key, { required, type }]) => {
        const matchedKey = parse.properties.find(({ key: checkKey }) => ((checkKey || 'DEFAULT') === key))
        if (required && !matchedKey) {
            throw new Error(`Property '${key}' is required in '${parse.tag}' items.`)
        }
        if (matchedKey && matchedKey.type !== type) {
            const typeLabel = type === ParsePropertyTypes.Boolean ? 'Boolean' : type === ParsePropertyTypes.Expression ? 'Expression' : type === ParsePropertyTypes.Literal ? 'Literal' : 'Key'
            throw new Error(`Property '${key}' must be of ${typeLabel} type in '${parse.tag}' items.`)
        }
        if (matchedKey) {
            return { [key]: matchedKey.value }
        }
        else {
            return {}
        }
    })) as ValidationTemplateOutput<V>
    return remap
}

export const validateContents = ({ isValid, branchTags, leafTags }: ConverterMapValidateProperties) => (contents: GenericTree<SchemaTag>): boolean => {
    return contents.reduce<boolean>((previous, { data: childTag, children }) => {
        if (!previous) {
            return previous
        }
        if (leafTags.includes(childTag.tag)) {
            return isValid(childTag)
        }
        else if (branchTags.includes(childTag.tag)) {
            if (!isValid(childTag)) {
                return false
            }
            else if (children.length) {
                return validateContents({ isValid, branchTags, leafTags })(children)
            }
        }
        return true
    }, true)
}

export const optionsFactory: PrintMapOptionsFactory = (action) => (previous) => {
    switch(action) {
        case PrintMapOptionsChange.Sibling:
            return previous
        case PrintMapOptionsChange.Indent:
            return {
                ...previous,
                indent: previous.indent + 1
            }
    }
    return previous
}

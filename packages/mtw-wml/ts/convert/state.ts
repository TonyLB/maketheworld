import { ParseActionTag, ParseComputedTag, ParseVariableTag } from "../parser/baseClasses";
import { BaseConverter, Constructor, SimpleParseConverterMixinFactory } from "./functionMixins";
import { extractDependenciesFromJS } from "./utils";

const ParseVariableMixin = SimpleParseConverterMixinFactory<ParseVariableTag, never>({
    tag: 'Variable',
    properties: {
        required: {
            key: ['key'],
        },
        optional: {
            default: ['expression']
        }
    }
})

const ParseComputedMixin = SimpleParseConverterMixinFactory<ParseComputedTag, never>({
    tag: 'Computed',
    properties: {
        required: {
            key: ['key'],
            src: ['expression']
        },
        optional: {}
    },
    postProcess: ({ properties }) => ({
        dependencies: extractDependenciesFromJS(properties.src)
    })
})

const ParseActionMixin = SimpleParseConverterMixinFactory<ParseActionTag, never>({
    tag: 'Action',
    properties: {
        required: {
            key: ['key'],
            src: ['expression']
        },
        optional: {}
    }
})

export const ParseStateMixin = <C extends Constructor<BaseConverter>>(Base: C) => (
    ParseVariableMixin(
    ParseComputedMixin(
    ParseActionMixin(
        Base
    )))
)

export default ParseStateMixin

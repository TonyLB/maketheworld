//
// Purely a prototyping space to experiment with new patterns for handling typescript and composition
// of (particularly) translation functions in WML parsing and schema creation.
//

import { ParseCommentTag, ParseStackTagOpenEntry, ParseTag, ParseTagFactoryProps, ParseTagFactoryPropsLimited } from "../parser/baseClasses";
import { ExtractProperties, ForceStringType, validateContents, validateProperties, ValidatePropertiesItem } from "./utils";

type ConverterArgument<A extends any, T extends {}> = {
    typeGuard: (value: any) => value is A;
    convert: (value: A) => T;
}

type AnyConverterArgument = ConverterArgument<any, {}>

type ConverterTypeFromArgument<A> = A extends AnyConverterArgument ? A["typeGuard"] extends (x: any) => x is infer T ? (value: T) => ReturnType<A["convert"]> : never : never

//
// The following dark art adopted from: https://stackoverflow.com/questions/50374908/transform-union-type-to-intersection-type/50375286#50375286
//
type UnionToIntersection<U> = 
  (U extends any ? (k: U)=>void : never) extends ((k: infer I)=>void) ? I : never

export const composeConvertersHelper = <F extends (...args: any) => any, A extends AnyConverterArgument>(
        {
            beforeConvert = () => {},
            fallback
        }: {
            beforeConvert?: (value: Parameters<UnionToIntersection<A["convert"]> & F>) => void,
            fallback: F,
        },
        ...args: A[]
): UnionToIntersection<ConverterTypeFromArgument<A>> & F => {
    const returnValue = args.reduce((previous, { typeGuard, convert }) => {
        const wrapperFunc = (wrappedFunc: (...args: any) => any) => (value: Parameters<typeof convert>[0]) => {
            if (typeGuard(value)) {
                return convert(value)
            }
            else {
                return wrappedFunc(value)
            }
        }
        return wrapperFunc(previous)
    }, fallback)
    return ((props) => {
        beforeConvert(props)
        return returnValue(props)
    }) as UnionToIntersection<A["convert"]> & F
}

export const composeConverters = <A extends AnyConverterArgument>(...args: A[]): UnionToIntersection<ConverterTypeFromArgument<A>> & (() => never) => (
    composeConvertersHelper({ fallback: () => { throw new Error('Functon composition failure') } }, ...args)
)


// EXAMPLE:  This is the way that composeConverters can be used

// type TagString = {
//     tag: 'String';
//     value: string;
// }

// const isString = (value: any): value is string => (typeof value === 'string')

// const convertToTagString = (value: any): TagString => ({
//     tag: 'String',
//     value
// })

// type TagNumber = {
//     tag: 'Number';
//     value: number;
// }

// const isNumber = (value: any): value is number => (typeof value === 'number')

// const convertToTagNumber = (value: number): TagNumber => ({
//     tag: 'Number',
//     value
// })

// const composedConverters = composeConverters(
//     { typeGuard: isString, convert: convertToTagString },
//     { typeGuard: isNumber, convert: convertToTagNumber }
// )

// //
// // Note that each converter is correctly typecast based on incoming arguments, and
// // invalid arguments are tagged statically as errors
// //
// const convertStringTest = composedConverters('Test')
// const convertNumberTest = composedConverters(5)
// const convertBooleanTest = composedConverters(false)



// EXAMPLE TWO: This is a class mixin implementation of composeConverters which may prove more elegant

export class BaseConverter {
    convert(...args: [never]) {}
}

export type Constructor<T = {}> = new (...args: any[]) => T;

type ConverterMixinFactoryProps<T, G> = {
    typeGuard: (value: unknown) => value is T;
    convert: (value: T) => G;
}

export const ConverterMixinFactory = <T, G>(args: ConverterMixinFactoryProps<T, G>) => <C extends Constructor<BaseConverter>>(Base: C) => {
    return class FactoryMixin extends Base {
        override convert(value: T): G
        override convert(value: Parameters<InstanceType<C>["convert"]>[0] | T): G | ReturnType<InstanceType<C>["convert"]> {
            if (args.typeGuard(value)) {
                return args.convert(value)
            }
            else {
                const returnValue = super.convert(value)
                if (!Boolean(returnValue)) {
                    throw new Error('Invalid parameter')
                }
                return returnValue as ReturnType<InstanceType<C>["convert"]>
            }
        }
    }
}

export const isTypedParseTagOpen = <T extends string>(tag: T) => (props: ParseTagFactoryProps): props is ParseTagFactoryPropsLimited<T extends ParseTag["tag"] | 'Character' ? T : never> => (props.open.tag === tag)

type ConverterArgumentWithContextEvaluator<T> = T | ((context: ParseStackTagOpenEntry[]) => T)

const isBaseArgument = <T>(arg: ConverterArgumentWithContextEvaluator<T>): arg is T => (!(typeof arg === 'function'))

type SimpleParseConverterMixinFactoryProps<T extends ParseTag, C extends ParseTag> = {
    tag: T["tag"];
    properties: {
        required: ConverterArgumentWithContextEvaluator<ValidatePropertiesItem>;
        optional: ConverterArgumentWithContextEvaluator<ValidatePropertiesItem>;
    };
    contents?: {
        legal: ConverterArgumentWithContextEvaluator<ParseTag["tag"][]>;
        ignore: ConverterArgumentWithContextEvaluator<ParseTag["tag"][]>;
    };
    postProcess?: (props: {
        context: ParseStackTagOpenEntry[];
        properties: ForceStringType<ExtractProperties<T, never>>;
        contents?: C[];
        startTagToken: number;
        endTagToken: number;
    }) => Partial<T>
}

export const SimpleParseConverterMixinFactory = <T extends ParseTag, C extends ParseTag>(props: SimpleParseConverterMixinFactoryProps<T, C>) => (
    ConverterMixinFactory({
        typeGuard: isTypedParseTagOpen(props.tag),
        convert: ({ open, contents, context, endTagToken }) => {
            const required = isBaseArgument(props.properties.required) ? props.properties.required : props.properties.required(context)
            const optional = isBaseArgument(props.properties.optional) ? props.properties.optional : props.properties.optional(context)
            const validate = validateProperties<ExtractProperties<T, never>>({
                open,
                endTagToken,
                required,
                optional
            })
            if (props.contents) {
                const legalTags = isBaseArgument(props.contents.legal) ? props.contents.legal : props.contents.legal(context)
                const ignoreTags = isBaseArgument(props.contents.ignore) ? props.contents.ignore : props.contents.ignore(context)
                const parseContents = validateContents<C>({
                    contents,
                    legalTags,
                    ignoreTags
                })
                return {
                    type: 'Tag',
                    tag: {
                        ...validate,
                        ...(props.postProcess ?? (({ contents }) => ({ contents })))({
                            properties: validate,
                            contents: parseContents,
                            context,
                            startTagToken: open.startTagToken,
                            endTagToken
                        }),
                        tag: props.tag,
                        startTagToken: open.startTagToken,
                        endTagToken
                    } as T
                }
            }
            else {
                validateContents<ParseCommentTag>({
                    contents,
                    legalTags: [],
                    ignoreTags: ['Whitespace', 'Comment']
                })
                return {
                    type: 'Tag',
                    tag: {
                        ...validate,
                        ...(props.postProcess?.({
                            properties: validate,
                            context,
                            startTagToken: open.startTagToken,
                            endTagToken
                        }) || {}),
                        tag: props.tag,
                        startTagToken: open.startTagToken,
                        endTagToken
                    } as T
                }        
            }
        }
    })
)


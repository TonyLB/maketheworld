//
// Purely a prototyping space to experiment with new patterns for handling typescript and composition
// of (particularly) translation functions in WML parsing and schema creation.
//

type ConverterArgument<A extends any, T extends {}> = {
    typeGuard: (value: any) => value is A;
    convert: (value: A) => T;
}

type AnyConverterArgument = ConverterArgument<any, {}>

//
// The following dark art adopted from: https://stackoverflow.com/questions/50374908/transform-union-type-to-intersection-type/50375286#50375286
//
type UnionToIntersection<U> = 
  (U extends any ? (k: U)=>void : never) extends ((k: infer I)=>void) ? I : never

export const composeConvertersHelper = <F extends (...args: any) => any, A extends AnyConverterArgument>(fallback: F, ...args: A[]): UnionToIntersection<A["convert"]> & F => {
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
    return returnValue as UnionToIntersection<A["convert"]> & F
}

export const composeConverters = <A extends AnyConverterArgument>(...args: A[]): UnionToIntersection<A["convert"]> & (() => never) => (
    composeConvertersHelper(() => { throw new Error('Functon composition failure') }, ...args)
)


// EXAMPLE:  This is the way that composeConverters can be used

// type TagString = {
//     tag: 'String';
//     value: string;
// }

// const isString = (value: any): value is string => (typeof value === 'string')

// const convertToTagString = (value: string): TagString => ({
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

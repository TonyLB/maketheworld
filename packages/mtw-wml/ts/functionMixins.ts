//
// Purely a prototyping space to experiment with new patterns for handling typescript and composition
// of (particularly) translation functions in WML parsing and schema creation.
//

type ArgumentTypes<F extends (...args: any) => any> = F extends (...args: infer A) => any ? A : never

const stringIdentity = (value: string): string => (value)

const numberIdentity = <F extends (...args: any) => any>(wrappedFunc: F): (((...args: ArgumentTypes<F>) => ReturnType<F>) & ((value: number) => number)) => (value) => {
    if (typeof value === 'number') {
        return value
    }
    else {
        return wrappedFunc(value)
    }
}

const jointIdentity = numberIdentity(stringIdentity)

const stringTest = jointIdentity('Test')
const numberTest = jointIdentity(5)

type TagString = {
    tag: 'String';
    value: string;
}

const isString = (value: any): value is string => (typeof value === 'string')

const convertToTagString = (value: string): TagString => ({
    tag: 'String',
    value
})

type TagNumber = {
    tag: 'Number';
    value: number;
}

const isNumber = (value: any): value is number => (typeof value === 'number')

const convertToTagNumber = (value: number): TagNumber => ({
    tag: 'Number',
    value
})

type ConverterArgument<A extends any, T extends TagString | TagNumber> = {
    typeGuard: (value: any) => value is A;
    convert: (value: A) => T;
}

const composeConverters = <A extends ConverterArgument<any, TagString | TagNumber>>(...args: A[]): ((value: ArgumentTypes<A["convert"]>[0]) => ReturnType<A["convert"]>) => {
    return args.reduce((previous, { typeGuard, convert }) => {
        const wrapperFunc = <F extends (...args: any) => any>(wrappedFunc: F): (((...args: ArgumentTypes<F>) => ReturnType<F>) & ((value: ArgumentTypes<typeof convert>[0]) => ReturnType<typeof convert>)) => (value) => {
            if (typeGuard(value)) {
                return value
            }
            else {
                return wrappedFunc(value)
            }
        }
        return wrapperFunc(previous)
    }, () => { throw new Error('Composition failed') })
}

const composedConverters = composeConverters(
    { typeGuard: isString, convert: convertToTagString },
    { typeGuard: isNumber, convert: convertToTagNumber }
)

//
// TODO: Figure out how to write composeConverters so that convertStringTest is typed
// to TagString, etc.
//
const convertStringTest = composedConverters('Test')
const convertNumberTest = composedConverters(5)


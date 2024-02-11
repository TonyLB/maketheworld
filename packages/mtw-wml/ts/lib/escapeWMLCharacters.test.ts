import { escapeWMLCharacters, deEscapeWMLCharacters } from './escapeWMLCharacters'

describe('escapeWMLCharacters', () => {
    it('should not effect normal text', () => {
        expect(escapeWMLCharacters('Normal text')).toEqual('Normal text')
    })

    it('should escape backslashes', () => {
        expect(escapeWMLCharacters(`Norm\\al text`)).toEqual('Norm\\\\al text')
    })

    it('should escape less-than', () => {
        expect(escapeWMLCharacters(`Norm<al text`)).toEqual('Norm\\<al text')
    })

    it('should escape greater-than', () => {
        expect(escapeWMLCharacters(`Norm>al text`)).toEqual('Norm\\>al text')
    })
})

describe('deEscapeWMLCharacters', () => {
    it('should not effect normal text', () => {
        expect(deEscapeWMLCharacters('Normal text')).toEqual('Normal text')
    })

    it('should deEscape backslashes', () => {
        expect(deEscapeWMLCharacters(`Norm\\\\al text`)).toEqual('Norm\\al text')
    })

    it('should deEscape less-than', () => {
        expect(deEscapeWMLCharacters(`Norm\\<al text`)).toEqual('Norm<al text')
    })

    it('should deEscape greater-than', () => {
        expect(deEscapeWMLCharacters(`Norm\\>al text`)).toEqual('Norm>al text')
    })
})
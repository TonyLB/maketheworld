import { sceneHandle, sceneSlug } from './sceneModel'

describe('sceneSlug and sceneHandle (SP-1 spelling)', () => {
    it.each([
        ['Cup', 'cup'],
        ['Steamer Chest', 'steamer-chest'],
        ["Old Man's Hat", 'old-mans-hat'],
        ['Old Man’s Hat', 'old-mans-hat'],
        ['  Fruit -- Bowl!  ', 'fruit-bowl'],
        ['Room 101', 'room-101'],
        ['Café', 'café'],
    ])('%j slugs to %j', (name, slug) => {
        expect(sceneSlug(name, 'Object')).toBe(slug)
    })

    it('a thing with no name, or none that leaves a letter or digit, takes its kind', () => {
        expect(sceneSlug(undefined, 'Object')).toBe('object')
        expect(sceneSlug(undefined, 'Feature')).toBe('feature')
        expect(sceneSlug('!!!', 'Concept')).toBe('concept')
    })

    it('always appends the counter, after a hyphen when the slug ends in a digit', () => {
        expect(sceneHandle('cup', 1)).toBe('cup1')
        expect(sceneHandle('cup', 2)).toBe('cup2')
        expect(sceneHandle('room-101', 1)).toBe('room-101-1')
    })
})

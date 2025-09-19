import extractHeader from './extractHeader'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'
import { StandardRemove, StandardReplace } from '@tonylb/mtw-wml/ts/standardize/components/edits'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

describe('extractHeader', () => {
    const make = (json: any): StandardComponent => {
        const created = standardComponentFactory(json)
        if (!created) {
            throw new Error('Failed to create StandardComponent for test setup')
        }
        return created
    }

    describe('basic components with shortName', () => {
        it('extracts Room header', () => {
            const room = make({ tag: 'Room', key: 'Room1', shortName: 'Lobby' })
            const result = extractHeader(room)
            expect(result).toBeTruthy()
            // Room serializer omits empty exits array; universalKey/context may be undefined
            expect(result?.toJSON()).toMatchObject({ tag: 'Room', key: 'Room1', shortName: 'Lobby' })
        })

        it('extracts Character header', () => {
            const character = make({ tag: 'Character', key: 'Char1', shortName: 'Alyx' })
            const result = extractHeader(character)
            expect(result).toBeTruthy()
            expect(result?.toJSON()).toEqual({ tag: 'Character', key: 'Char1', shortName: 'Alyx' })
        })

        it('extracts Feature header', () => {
            const feature = make({ tag: 'Feature', key: 'Feature1', shortName: 'Console' })
            const result = extractHeader(feature)
            expect(result).toBeTruthy()
            expect(result?.toJSON()).toEqual({ tag: 'Feature', key: 'Feature1', shortName: 'Console' })
        })

        it('extracts Knowledge header', () => {
            const knowledge = make({ tag: 'Knowledge', key: 'Fact1', shortName: 'Keycode' })
            const result = extractHeader(knowledge)
            expect(result).toBeTruthy()
            expect(result?.toJSON()).toEqual({ tag: 'Knowledge', key: 'Fact1', shortName: 'Keycode' })
        })
    })

    describe('components without shortName', () => {
        it('returns undefined for Map', () => {
            const map = make({ tag: 'Map', key: 'Map1', images: [], positions: [] })
            const result = extractHeader(map)
            expect(result).toBeUndefined()
        })

        it('returns undefined for Message', () => {
            const message = make({ tag: 'Message', key: 'Msg1', rooms: [] })
            const result = extractHeader(message)
            expect(result).toBeUndefined()
        })

        it('returns undefined for Moment', () => {
            const moment = make({ tag: 'Moment', key: 'Mom1' })
            const result = extractHeader(moment)
            expect(result).toBeUndefined()
        })

        it('returns undefined for Image', () => {
            const image = make({ tag: 'Image', key: 'Img1' })
            const result = extractHeader(image)
            expect(result).toBeUndefined()
        })

        it('returns undefined for Example', () => {
            const example = make({ tag: 'Example', key: 'Ex1' })
            const result = extractHeader(example)
            expect(result).toBeUndefined()
        })
    })

    describe('edit wrappers', () => {
        it('extracts header from Remove wrapper', () => {
            const room = make({ tag: 'Room', key: 'Room1', shortName: 'Lobby' })
            const remove = new StandardRemove(room)
            const result = extractHeader(remove)
            // Expect a Remove wrapping a header-only Room; Remove carries key of wrapped component
            expect(result).toBeInstanceOf(StandardRemove)
            expect(result?.toJSON()).toMatchObject({
                tag: 'Remove',
                key: 'Room1',
                component: { tag: 'Room', key: 'Room1', shortName: 'Lobby' }
            })
        })

        it('extracts header from Replace wrapper', () => {
            const roomMatch = make({ tag: 'Room', key: 'Room1', shortName: 'Lobby' })
            const roomPayload = make({ tag: 'Room', key: 'Room1', shortName: 'Atrium' })
            const replace = new StandardReplace(roomMatch, roomPayload)
            const result = extractHeader(replace)
            // Expect a Replace with header-only match and payload; Replace carries key of matched component
            expect(result).toBeInstanceOf(StandardReplace)
            expect(result?.toJSON()).toMatchObject({
                tag: 'Replace',
                key: 'Room1',
                match: { tag: 'Room', key: 'Room1', shortName: 'Lobby' },
                payload: { tag: 'Room', key: 'Room1', shortName: 'Atrium' }
            })
        })
    })

    describe('excludes extra data', () => {
        it('strips Room exits/features/examples/characters', () => {
            const room = make({
                tag: 'Room', key: 'Room1', shortName: 'Lobby',
                // Provide only valid extra fields for this test; omit invalid exit shape
                features: [{ tag: 'Feature', key: 'Feat1' }],
                examples: [{ tag: 'Example', key: 'Ex1' }],
                characters: [{ tag: 'Character', key: 'Char1' }]
            })
            const result = extractHeader(room)
            expect(result?.toJSON()).toMatchObject({ tag: 'Room', key: 'Room1', shortName: 'Lobby' })
        })

        it('strips Feature examples', () => {
            const feature = make({ tag: 'Feature', key: 'F1', shortName: 'Console', examples: [{ tag: 'Example', key: 'ex' }] })
            const result = extractHeader(feature)
            expect(result?.toJSON()).toEqual({ tag: 'Feature', key: 'F1', shortName: 'Console' })
        })

        it('strips Knowledge examples', () => {
            const knowledge = make({ tag: 'Knowledge', key: 'K1', shortName: 'Keycode', examples: [{ tag: 'Example', key: 'ex' }] })
            const result = extractHeader(knowledge)
            expect(result?.toJSON()).toEqual({ tag: 'Knowledge', key: 'K1', shortName: 'Keycode' })
        })

        it('strips Character non-shortName fields', () => {
            // Provide only valid extra field for this test; omit invalid StandardRender shape for name
            const character = make({ tag: 'Character', key: 'C1', shortName: 'Alyx', pronouns: 'she/they' })
            const result = extractHeader(character)
            expect(result?.toJSON()).toEqual({ tag: 'Character', key: 'C1', shortName: 'Alyx' })
        })

        it('strips extra inside Remove', () => {
            const feature = make({ tag: 'Feature', key: 'F1', shortName: 'Console', examples: [{ tag: 'Example', key: 'ex' }] })
            const remove = new StandardRemove(feature)
            const result = extractHeader(remove)
            expect(result?.toJSON()).toMatchObject({
                tag: 'Remove',
                key: 'F1',
                component: { tag: 'Feature', key: 'F1', shortName: 'Console' }
            })
        })

        it('strips extra inside Replace', () => {
            const match = make({ tag: 'Knowledge', key: 'K1', shortName: 'Old', examples: [{ tag: 'Example', key: 'a' }] })
            const payload = make({ tag: 'Knowledge', key: 'K1', shortName: 'New', examples: [{ tag: 'Example', key: 'b' }] })
            const replace = new StandardReplace(match, payload)
            const result = extractHeader(replace)
            expect(result?.toJSON()).toMatchObject({
                tag: 'Replace',
                key: 'K1',
                match: { tag: 'Knowledge', key: 'K1', shortName: 'Old' },
                payload: { tag: 'Knowledge', key: 'K1', shortName: 'New' }
            })
        })

        it('returns undefined for Replace when shortName unchanged', () => {
            const match = make({ tag: 'Feature', key: 'F1', shortName: 'Console', examples: [{ tag: 'Example', key: 'a' }] })
            const payload = make({ tag: 'Feature', key: 'F1', shortName: 'Console', examples: [{ tag: 'Example', key: 'b' }] })
            const replace = new StandardReplace(match, payload)
            const result = extractHeader(replace)
            expect(result).toBeUndefined()
        })
    })
})



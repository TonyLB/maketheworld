import { Schema } from '..'
import { selectKeysReferenced } from './keysReferenced'
import { selectItemsByKey } from './itemsByKey'

describe('keyReferenced selector', () => {
    it('should select keys referenced from a room', () => {
        const testOne = new Schema()
        testOne.loadWML(`
            <Asset key=(testOne)>
                <Room key=(room1)>
                    <Name>Test room</Name>
                    <Description>
                        TestZero
                        <Link to=(feature1)>Link</Link>
                        <Bookmark key=(bookmark1) />
                    </Description>
                    <Exit to=(room2)>Exit</Exit>
                </Room>
                <Room key=(room2) />
                <Feature key=(feature1) />
                <Bookmark key=(bookmark1) />
            </Asset>
        `)
        expect(selectKeysReferenced(selectItemsByKey('room1')(testOne.schema))).toEqual(['feature1', 'bookmark1', 'room2', 'room1'])
    })

    it('should select keys referenced in a map', () => {
        const testOne = new Schema()
        testOne.loadWML(`
            <Asset key=(testOne)>
                <Room key=(room1) />
                <Room key=(room2) />
                <Map key=(map1)>
                    <Room key=(room1)><Position x="0" y="0" /></Room>
                    <Room key=(room2)><Position x="100" y="0" /></Room>
                </Map>
            </Asset>
        `)
        expect(selectKeysReferenced(selectItemsByKey('map1')(testOne.schema))).toEqual(['room1', 'room2'])
    })

})

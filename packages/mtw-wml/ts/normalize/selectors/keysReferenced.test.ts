import Normalizer from ".."
import { isSchemaCondition } from "../../simpleSchema/baseClasses"
import { selectKeysReferenced } from './keysReferenced'

describe('keyReferenced selector', () => {
    it('should select keys referenced from a room', () => {
        const testOne = new Normalizer()
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
        expect(testOne.select({ key: 'room1', selector: selectKeysReferenced })).toEqual(['feature1', 'bookmark1', 'room2', 'room1'])
    })

})

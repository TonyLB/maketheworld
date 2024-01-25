import Normalizer from ".."
import { selectKeysByTag } from './keysByTag'

describe('keysByTag selector', () => {
    it('should select keys by tag even nested deeply', () => {
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
                <If {true}><Feature key=(feature2) /></If>
            </Asset>
        `)
        const schema = testOne.schema
        expect(selectKeysByTag('Room')(testOne.schema)).toEqual(['room1', 'room2'])
        expect(selectKeysByTag('Feature')(testOne.schema)).toEqual(['feature1', 'feature2'])
        expect(selectKeysByTag('Bookmark')(testOne.schema)).toEqual(['bookmark1'])
    })

})

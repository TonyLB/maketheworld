import { wmlDataSource as wmlDataSourceInstance } from './mtw-wml'

export { WMLDataSource } from './abstract'
export { WMLEventSerializer } from './serializers'

export const wmlDataSource = wmlDataSourceInstance
export default wmlDataSource
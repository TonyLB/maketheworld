import { PubSub } from '../../lib/pubSub'
import type { LifeLinePubSubData } from './lifeLine'

export const LifeLinePubSub = new PubSub<LifeLinePubSubData>()

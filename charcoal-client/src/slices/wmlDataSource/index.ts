// WML Data Source Slice
//
// This slice manages subscriptions to the mtw.wml data source. It owns the canonical
// backend WML view (materializedView) per subscribed asset. Initial state comes from
// Snapshot events (sidecar URL); Content Update and Merge Conflict events update the view.

import { createDataSourceSlice, createBrowserDataSourceEnvironment } from '../dataSource'
import type { StreamEventDeserializedPayload } from '../dataSource/streamEventPubSub'
import {
  WMLAggregator,
  WMLDataSourceEventSerializer
} from '@tonylb/mtw-interfaces/ts/eventBridge/wml'

export type GetConfirmedRequestIds = (
  state: any,
  streamKey: string
) => string[]

type AfterProcessEnvelopeConsumer = (
  dispatch: any,
  getState: any,
  payload: StreamEventDeserializedPayload
) => void

let afterProcessEnvelopeConsumer: AfterProcessEnvelopeConsumer | undefined

/** Registered by personalAssets at module load to avoid wml -> personalAssets import cycle. */
export const registerWmlAfterProcessEnvelopeConsumer = (fn: AfterProcessEnvelopeConsumer): void => {
  afterProcessEnvelopeConsumer = fn
}

// Create the slice using the generic factory
const wmlDataSourceFactory = createDataSourceSlice({
  name: 'wmlDataSource',
  dataSourceKey: 'mtw.wml',
  aggregator: new WMLAggregator(),
  eventSerializer: new WMLDataSourceEventSerializer(createBrowserDataSourceEnvironment()),
  sliceSelector: (state: any) => state.wmlDataSource,
  requestIdTracking: { headerField: 'RequestIds' },
  afterProcessEnvelope: (dispatch, getState, payload: StreamEventDeserializedPayload) => {
    afterProcessEnvelopeConsumer?.(dispatch, getState, payload)
  }
})

export const {
  slice: wmlDataSourceSlice,
  selectors: wmlDataSourceSelectors,
  publicActions: wmlDataSourceActions,
  iterateAllSSMs: iterateWmlDataSource,
  subscribeToStreams: subscribeToWmlDataSource,
  unsubscribeFromStreams: unsubscribeFromWmlDataSource
} = wmlDataSourceFactory

const factoryGetConfirmedRequestIds = wmlDataSourceFactory.getConfirmedRequestIds
if (!factoryGetConfirmedRequestIds) {
  throw new Error('wmlDataSource: getConfirmedRequestIds requires requestIdTracking')
}
export const getConfirmedRequestIds: GetConfirmedRequestIds = factoryGetConfirmedRequestIds

export const {
  getActiveStreamKeys,
  getSubscribedStreams
} = wmlDataSourceSelectors

export const {
  processEnvelope,
  pruneStaleConfirmedRequestIds
} = wmlDataSourceActions

export * from './selectors'

// WML Data Source Slice
//
// This slice manages subscriptions to the mtw.wml data source. It owns the canonical
// backend WML view (materializedView) per subscribed asset. Initial state comes from
// Snapshot events (sidecar URL); Content Update and Merge Conflict events update the view.

import { createDataSourceSlice } from '../dataSource'
import {
  WMLAggregator,
  WMLDataSourceEventSerializer,
  isWMLMaterializedView,
  isWMLContentEvent
} from '@tonylb/mtw-interfaces/ts/eventBridge/wml'
import { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import { Schema } from '@tonylb/mtw-wml/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

// Type guards for the slice: materialized view vs content update events
export const isSnapshot = (event: StandardFormData | import('@tonylb/mtw-interfaces/ts/eventBridge/wml').WMLContentEvent): event is StandardFormData => {
  return isWMLMaterializedView(event)
}

export const isUpdate = (event: StandardFormData | import('@tonylb/mtw-interfaces/ts/eventBridge/wml').WMLContentEvent): event is import('@tonylb/mtw-interfaces/ts/eventBridge/wml').WMLContentEvent => {
  return isWMLContentEvent(event)
}

/**
 * Resolve sidecar snapshot: fetch WML from presigned URL, parse to StandardFormData.
 * The slice passes this to processRawSnapshot; the reducer then applies it as materializedView.
 * Exported for testing.
 */
export async function resolveSidecarSnapshot(
  _streamKey: string,
  sidecarUrl: string,
  _rawSnapshot: any
): Promise<StandardFormData> {
  const response = await fetch(sidecarUrl)
  if (!response.ok) {
    throw new Error(`[wmlDataSource] Sidecar fetch failed: ${response.status} ${response.statusText}`)
  }
  const wml = await response.text()
  const schemaConverter = new Schema()
  schemaConverter.loadWML(wml.replace(/\r/g, ''))
  const standardForm = new StandardForm(schemaConverter.schema[0])
  return standardForm.toJSON()
}

// Create the slice using the generic factory
export const {
  slice: wmlDataSourceSlice,
  selectors: wmlDataSourceSelectors,
  publicActions: wmlDataSourceActions,
  iterateAllSSMs: iterateWmlDataSource,
  subscribeToStreams: subscribeToWmlDataSource,
  unsubscribeFromStreams: unsubscribeFromWmlDataSource
} = createDataSourceSlice({
  name: 'wmlDataSource',
  dataSourceKey: 'mtw.wml',
  aggregator: new WMLAggregator(),
  eventSerializer: new WMLDataSourceEventSerializer(),
  isSnapshot,
  isUpdate,
  sliceSelector: (state: any) => state.wmlDataSource,
  resolveSidecarSnapshot
})

export const {
  getActiveStreamKeys,
  getSubscribedStreams
} = wmlDataSourceSelectors

export const {
  processRawSnapshot,
  processRawEvent
} = wmlDataSourceActions

export * from './selectors'

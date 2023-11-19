import { SchemaConditionTag, SchemaExitTag, SchemaRoomTag } from "@tonylb/mtw-wml/dist/simpleSchema/baseClasses"

export type ToolSelected = 'Select' | 'Move' | 'AddRoom' | 'OneWayExit' | 'TwoWayExit'

export type MapTreeExit = SchemaExitTag & { inherited?: boolean }
export type MapTreeRoom = SchemaRoomTag & { inherited?: boolean; contents: MapTreeItem[] }
export type MapTreeCondition = SchemaConditionTag & { inherited?: boolean; contents: MapTreeItem[] }

export type MapTreeItem = MapTreeExit | MapTreeRoom | MapTreeCondition

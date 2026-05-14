/** Prefix for job-scoped partitions in the Ephemera table (`EphemeraId`). */
export const THINKING_JOB_EPHEMERA_PREFIX = 'JOB#' as const

/** Prefix for task-scoped partitions (`EphemeraId`) and for adjacency sort keys under a job. */
export const THINKING_TASK_EPHEMERA_PREFIX = 'TASK#' as const

/** `begins_with(DataCategory, ...)` under `JOB#...` for listing task adjacency rows. */
export const THINKING_TASK_DATA_CATEGORY_PREFIX = THINKING_TASK_EPHEMERA_PREFIX

const META_JOB = 'Meta::Job' as const
const META_RESULT = 'Meta::Result' as const
const META_SCHEDULE = 'Meta::Schedule' as const

/**
 * Ephemera hash key for a thinking job / run (uses the run `generationId` as the id segment).
 */
export const jobEphemeraId = (generationId: string): `${typeof THINKING_JOB_EPHEMERA_PREFIX}${string}` =>
    `${THINKING_JOB_EPHEMERA_PREFIX}${generationId}`

/** Single job-level metadata row under the job partition. */
export const jobMetaDataCategory = (): typeof META_JOB => META_JOB

/**
 * Ephemera hash key for a single work item (result and other task-owned rows live here).
 * Same string is used as **`DataCategory`** on the **`JOB#${generationId}`** partition for the
 * lightweight adjacency row (membership only).
 */
export const taskEphemeraId = (workItemId: string): `${typeof THINKING_TASK_EPHEMERA_PREFIX}${string}` =>
    `${THINKING_TASK_EPHEMERA_PREFIX}${workItemId}`

/** Sort key on the job partition for the adjacency stub row (`JOB#` + `TASK#${workItemId}`). */
export const jobTaskAdjacencyDataCategory = (workItemId: string): string => taskEphemeraId(workItemId)

/** `DataCategory` for the thinking result payload on the **`TASK#${workItemId}`** partition. */
export const thinkingResultMetaDataCategory = (): typeof META_RESULT => META_RESULT

/** `DataCategory` for schedule state on the **`TASK#${workItemId}`** partition. */
export const thinkingScheduleMetaDataCategory = (): typeof META_SCHEDULE => META_SCHEDULE

export const isThinkingResultMetaDataCategory = (dataCategory: string): dataCategory is typeof META_RESULT =>
    dataCategory === META_RESULT

export const isThinkingScheduleMetaDataCategory = (dataCategory: string): dataCategory is typeof META_SCHEDULE =>
    dataCategory === META_SCHEDULE

/** True when `EphemeraId` is the task partition for `workItemId` (same as `taskEphemeraId`). */
export const isTaskPartitionEphemeraId = (ephemeraId: string, workItemId: string): boolean =>
    ephemeraId === taskEphemeraId(workItemId)

/**
 * Parse `TASK#${workItemId}` partition id into `workItemId`, or `null` if the prefix does not match.
 */
export const parseWorkItemIdFromTaskEphemeraId = (ephemeraId: string): string | null => {
    if (!ephemeraId.startsWith(THINKING_TASK_EPHEMERA_PREFIX)) {
        return null
    }
    return ephemeraId.slice(THINKING_TASK_EPHEMERA_PREFIX.length) || null
}

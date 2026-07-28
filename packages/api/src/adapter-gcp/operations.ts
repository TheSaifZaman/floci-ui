/**
 * Google's REST APIs answer mutations with a long-running-operation envelope
 * rather than the resource, and the shape differs per service:
 *
 *   - Cloud Functions / GKE / Cloud Run: `{done, response: <resource>}`
 *   - Cloud SQL (`sql#operation`): `{status: 'DONE', targetId: <resource name>}`
 *     with no embedded resource, so the caller must re-read it
 *
 * These helpers keep that discrimination in one place instead of each adapter
 * guessing whether it received a resource or a receipt for one.
 */

export interface GcpOperationEnvelope<T> {
    kind?: string
    /** Cloud Functions / GKE / Cloud Run. */
    done?: boolean
    response?: T
    /** Cloud SQL. */
    status?: string
    targetId?: string
    operationType?: string
    error?: unknown
}

/** True when the payload is an operation receipt rather than the resource. */
export function isOperationEnvelope(payload: unknown): boolean {
    if (!payload || typeof payload !== 'object') return false
    const envelope = payload as GcpOperationEnvelope<unknown>
    return (
        envelope.kind?.endsWith('#operation') === true ||
        typeof envelope.done === 'boolean' ||
        (typeof envelope.status === 'string' && typeof envelope.operationType === 'string')
    )
}

/**
 * Unwrap an embedded resource. Returns null when the operation carries only a
 * reference, in which case the caller should read the resource back by name.
 */
export function operationResponse<T>(payload: GcpOperationEnvelope<T> | T | null): T | null {
    if (!payload) return null
    if (!isOperationEnvelope(payload)) return payload as T

    const envelope = payload as GcpOperationEnvelope<T>
    return envelope.response ?? null
}

/** The resource name an operation acted on, when it reports one. */
export function operationTargetId<T>(payload: GcpOperationEnvelope<T> | T | null): string | null {
    if (!payload || !isOperationEnvelope(payload)) return null
    return (payload as GcpOperationEnvelope<T>).targetId ?? null
}

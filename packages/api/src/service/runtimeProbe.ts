import {RuntimeUnavailableError} from '../cloud-spi/errors'
import type {CloudProvider} from '../cloud-spi/types'
import {azure, azureEndpoint} from '../azure'
import {gcp, gcpEndpoint} from '../gcp'

/**
 * Liveness probes per runtime.
 *
 * Cloud status used to be inferred from whether the *storage* adapter could list,
 * which meant a cloud whose storage worked reported "reachable" no matter what
 * else was broken, and a cloud with no storage adapter reported "coming_soon"
 * even when its runtime was up. These probe the runtime itself.
 */
export type RuntimeProbe = () => Promise<void>

export const runtimeProbes: Record<CloudProvider, RuntimeProbe> = {
    // Floci core answers on / (S3 ListBuckets), so any non-5xx means it is up.
    aws: () => probeHttp(awsEndpoint(), 'Floci core'),
    // Floci-AZ exposes a real health endpoint.
    azure: async () => {
        await azure.fetch('/_floci/health', {method: 'GET'})
    },
    gcp: () => gcp.health(),
}

export function endpointFor(cloud: CloudProvider): string | null {
    if (cloud === 'aws') return awsEndpoint()
    if (cloud === 'azure') return azureEndpoint()
    if (cloud === 'gcp') return gcpEndpoint()
    return null
}

export function awsEndpoint(): string {
    return process.env.FLOCI_ENDPOINT ?? 'http://localhost:4566'
}

async function probeHttp(endpoint: string, label: string): Promise<void> {
    let res: Response
    try {
        res = await globalThis.fetch(endpoint, {method: 'GET'})
    } catch (error) {
        throw new RuntimeUnavailableError(`Cannot reach ${label} at ${endpoint}`, {cause: error})
    }
    if (res.status >= 500) {
        throw new RuntimeUnavailableError(`${label} at ${endpoint} returned HTTP ${res.status}`)
    }
}

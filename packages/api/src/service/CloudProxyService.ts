import type {
    CloudAvailability,
    CloudDescriptor,
    CloudProvider,
    CloudResource,
    CloudServiceDescriptor,
    CloudServiceType,
    CloudStatus,
    CosmosContainer,
    CosmosItem,
    CosmosQueryResult,
    CreateResourceInput,
    ResourceQuery,
    ServerlessInvokeResult,
    ServiceSchema,
    StorageObjectDownload,
    StorageObjectList,
} from '../cloud-spi/types'
import {NotSupportedError} from '../cloud-spi/errors'
import {CloudAdapterRegistry} from '../registry/CloudAdapterRegistry'
import {SERVICE_CATALOG_ENTRIES, displayNameFor, routeFor} from '../cloud-spi/serviceCatalog'
import {azureEndpoint} from '../azure'
import {checkGcpRuntime, gcpEndpoint} from '../gcp'

export class CloudProxyService {
    constructor(private readonly registry: CloudAdapterRegistry) {}

    clouds(): CloudDescriptor[] {
        return [
            {id: 'aws', displayName: 'AWS', availability: 'available'},
            {id: 'azure', displayName: 'Azure', availability: 'available'},
            {id: 'gcp', displayName: 'GCP', availability: 'available'},
        ]
    }

    /**
     * Derived from the service catalog and the adapter registry — never from a
     * hardcoded per-cloud list. Registering an adapter is therefore the only
     * thing needed to make a service appear as available in the UI.
     */
    services(cloud: CloudProvider): CloudServiceDescriptor[] {
        return SERVICE_CATALOG_ENTRIES.map((entry) => {
            const adapter = this.registry.get(cloud, entry.service)
            const override = adapter?.descriptorOverride?.() ?? {}
            const derived: CloudAvailability = entry.legacyAvailability?.[cloud]
                ?? (adapter ? 'available' : 'coming_soon')
            const availability = override.availability ?? derived
            const displayName = override.displayName ?? displayNameFor(entry, cloud)

            return {
                cloud,
                service: entry.service,
                displayName,
                availability,
                reason: override.reason ?? unavailableReason(availability, cloud, displayName),
                route: routeFor(entry),
                iconKey: entry.iconKey,
                group: entry.group,
                order: entry.order,
            }
        })
    }

    /**
     * Only a registered adapter can describe a service. Returning a static
     * schema for an unregistered pair used to make the UI render a table that
     * then failed on every request.
     */
    schema(cloud: CloudProvider, service: CloudServiceType): ServiceSchema | null {
        return this.registry.get(cloud, service)?.schema() ?? null
    }

    async status(cloud: CloudProvider): Promise<CloudStatus> {
        const adapter = this.registry.get(cloud, 'storage')
        if (cloud === 'gcp') {
            try {
                await checkGcpRuntime()
                return {
                    cloud,
                    adapterRegistered: Boolean(adapter),
                    runtime: 'reachable',
                    endpoint: endpointFor(cloud),
                    checkedAt: new Date().toISOString(),
                    error: null,
                }
            } catch (error) {
                return {
                    cloud,
                    adapterRegistered: Boolean(adapter),
                    runtime: 'unavailable',
                    endpoint: endpointFor(cloud),
                    checkedAt: new Date().toISOString(),
                    error: error instanceof Error ? error.message : 'Runtime check failed',
                }
            }
        }

        if (!adapter) {
            return {
                cloud,
                adapterRegistered: false,
                runtime: 'coming_soon',
                endpoint: endpointFor(cloud),
                checkedAt: new Date().toISOString(),
                error: null,
            }
        }

        try {
            await adapter.list()
            return {
                cloud,
                adapterRegistered: true,
                runtime: 'reachable',
                endpoint: endpointFor(cloud),
                checkedAt: new Date().toISOString(),
                error: null,
            }
        } catch (error) {
            return {
                cloud,
                adapterRegistered: true,
                runtime: 'unavailable',
                endpoint: endpointFor(cloud),
                checkedAt: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Runtime check failed',
            }
        }
    }

    async listResources(cloud: CloudProvider, service: CloudServiceType, query: ResourceQuery): Promise<CloudResource[]> {
        return this.requireAdapter(cloud, service).list(query)
    }

    async getResource(cloud: CloudProvider, service: CloudServiceType, id: string): Promise<CloudResource | null> {
        return this.requireAdapter(cloud, service).get(id)
    }

    async createResource(cloud: CloudProvider, service: CloudServiceType, input: CreateResourceInput): Promise<CloudResource> {
        return this.requireAdapter(cloud, service).create(input)
    }

    async deleteResource(cloud: CloudProvider, service: CloudServiceType, id: string): Promise<void> {
        await this.requireAdapter(cloud, service).delete(id)
    }
async invokeResource(
    cloud: CloudProvider,
    service: CloudServiceType,
    id: string,
    payload: string,
): Promise<ServerlessInvokeResult> {
    const adapter = this.requireAdapter(cloud, service)
    if (!adapter.invoke) throw new NotSupportedError(`${cloud}/${service} invoke is not supported`)
    return adapter.invoke(id, payload)
}
    async listObjects(cloud: CloudProvider, service: CloudServiceType, resourceId: string, prefix?: string): Promise<StorageObjectList> {
        const adapter = this.requireAdapter(cloud, service)
        if (!adapter.listObjects) throw new NotSupportedError(`Object listing is not supported for ${cloud}/${service}`)
        return adapter.listObjects(resourceId, prefix)
    }

    async putObject(cloud: CloudProvider, service: CloudServiceType, resourceId: string, key: string, body: Uint8Array, contentType: string): Promise<void> {
        const adapter = this.requireAdapter(cloud, service)
        if (!adapter.putObject) throw new NotSupportedError(`Object upload is not supported for ${cloud}/${service}`)
        await adapter.putObject(resourceId, key, body, contentType)
    }

    async getObject(cloud: CloudProvider, service: CloudServiceType, resourceId: string, key: string): Promise<StorageObjectDownload> {
        const adapter = this.requireAdapter(cloud, service)
        if (!adapter.getObject) throw new NotSupportedError(`Object download is not supported for ${cloud}/${service}`)
        return adapter.getObject(resourceId, key)
    }

    async deleteObject(cloud: CloudProvider, service: CloudServiceType, resourceId: string, key: string): Promise<void> {
        const adapter = this.requireAdapter(cloud, service)
        if (!adapter.deleteObject) throw new NotSupportedError(`Object delete is not supported for ${cloud}/${service}`)
        await adapter.deleteObject(resourceId, key)
    }

    async copyObject(cloud: CloudProvider, service: CloudServiceType, srcResourceId: string, srcKey: string, destKey: string, destResourceId?: string): Promise<void> {
        const adapter = this.requireAdapter(cloud, service)
        if (!adapter.copyObject) throw new NotSupportedError(`Object copy is not supported for ${cloud}/${service}`)
        await adapter.copyObject(srcResourceId, srcKey, destKey, destResourceId)
    }

    async listCosmosContainers(cloud: CloudProvider, databaseId: string): Promise<CosmosContainer[]> {
        const adapter = this.requireAdapter(cloud, 'database')
        if (!adapter.listCosmosContainers) throw new NotSupportedError(`Cosmos containers are not supported for ${cloud}/database`)
        return adapter.listCosmosContainers(databaseId)
    }

    async createCosmosContainer(cloud: CloudProvider, databaseId: string, input: CreateResourceInput): Promise<CosmosContainer> {
        const adapter = this.requireAdapter(cloud, 'database')
        if (!adapter.createCosmosContainer) throw new NotSupportedError(`Cosmos container creation is not supported for ${cloud}/database`)
        return adapter.createCosmosContainer(databaseId, input)
    }

    async deleteCosmosContainer(cloud: CloudProvider, databaseId: string, containerId: string): Promise<void> {
        const adapter = this.requireAdapter(cloud, 'database')
        if (!adapter.deleteCosmosContainer) throw new NotSupportedError(`Cosmos container deletion is not supported for ${cloud}/database`)
        await adapter.deleteCosmosContainer(databaseId, containerId)
    }

    async listCosmosItems(cloud: CloudProvider, databaseId: string, containerId: string): Promise<CosmosItem[]> {
        const adapter = this.requireAdapter(cloud, 'database')
        if (!adapter.listCosmosItems) throw new NotSupportedError(`Cosmos items are not supported for ${cloud}/database`)
        return adapter.listCosmosItems(databaseId, containerId)
    }

    async upsertCosmosItem(cloud: CloudProvider, databaseId: string, containerId: string, document: Record<string, unknown>): Promise<CosmosItem> {
        const adapter = this.requireAdapter(cloud, 'database')
        if (!adapter.upsertCosmosItem) throw new NotSupportedError(`Cosmos item upsert is not supported for ${cloud}/database`)
        return adapter.upsertCosmosItem(databaseId, containerId, document)
    }

    async deleteCosmosItem(cloud: CloudProvider, databaseId: string, containerId: string, itemId: string, partitionKey?: string | null): Promise<void> {
        const adapter = this.requireAdapter(cloud, 'database')
        if (!adapter.deleteCosmosItem) throw new NotSupportedError(`Cosmos item deletion is not supported for ${cloud}/database`)
        await adapter.deleteCosmosItem(databaseId, containerId, itemId, partitionKey)
    }

    async queryCosmosItems(cloud: CloudProvider, databaseId: string, containerId: string, query: string): Promise<CosmosQueryResult> {
        const adapter = this.requireAdapter(cloud, 'database')
        if (!adapter.queryCosmosItems) throw new NotSupportedError(`Cosmos query is not supported for ${cloud}/database`)
        return adapter.queryCosmosItems(databaseId, containerId, query)
    }

    private requireAdapter(cloud: CloudProvider, service: CloudServiceType) {
        const adapter = this.registry.get(cloud, service)
        if (!adapter) throw new NotSupportedError(`No adapter registered for ${cloud}/${service}`)
        return adapter
    }
}

/** Keeps the promise that every coming_soon descriptor explains itself. */
function unavailableReason(
    availability: CloudAvailability,
    cloud: CloudProvider,
    displayName: string,
): string | undefined {
    if (availability === 'available') return undefined
    return `No ${cloud.toUpperCase()} adapter is registered for ${displayName} yet.`
}

function endpointFor(cloud: CloudProvider): string | null {
    if (cloud === 'aws') return process.env.FLOCI_ENDPOINT ?? 'http://localhost:4566'
    if (cloud === 'azure') return azureEndpoint()
    if (cloud === 'gcp') return gcpEndpoint()
    return null
}

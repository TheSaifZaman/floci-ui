import {
    CreateQueueCommand,
    DeleteQueueCommand,
    GetQueueAttributesCommand,
    GetQueueUrlCommand,
    ListQueuesCommand,
    type SQSClient,
} from '@aws-sdk/client-sqs'
import {NotFoundError, ValidationError} from '../cloud-spi/errors'
import {awsMessagingSchema} from '../cloud-spi/messagingSchema'
import {sqs as defaultSqs} from '../aws'
import type {
    CloudResource,
    CloudServiceAdapter,
    CreateResourceInput,
    ResourceQuery,
    ServiceSchema,
} from '../cloud-spi/types'

/**
 * SQS queues as `messaging` resources.
 *
 * SQS identifies a queue by URL, but a URL is a poor id for the console: it is
 * long, embeds the endpoint, and changes if the runtime is re-pointed. The
 * adapter uses the queue name as the resource id and resolves it back to a URL
 * per call via GetQueueUrl, which is the same thing the AWS console does.
 */

interface QueueAttributes {
    QueueArn?: string
    ApproximateNumberOfMessages?: string
    ApproximateNumberOfMessagesNotVisible?: string
    ApproximateNumberOfMessagesDelayed?: string
    VisibilityTimeout?: string
    MessageRetentionPeriod?: string
    MaximumMessageSize?: string
    DelaySeconds?: string
    CreatedTimestamp?: string
    LastModifiedTimestamp?: string
    FifoQueue?: string
}

export class AwsSqsAdapter implements CloudServiceAdapter {
    readonly cloud = 'aws' as const
    readonly service = 'messaging' as const

    constructor(private readonly sqs: SQSClient = defaultSqs) {}

    schema(): ServiceSchema {
        return awsMessagingSchema()
    }

    async list(query: ResourceQuery = {}): Promise<CloudResource[]> {
        const res = await this.sqs.send(new ListQueuesCommand({}))
        const urls = res.QueueUrls ?? []

        const resources = await Promise.all(
            urls.map(async (url) => {
                const name = queueNameFromUrl(url)
                // A queue with no attributes is still a queue, so a failed
                // describe degrades to the bare row rather than failing the list.
                const attributes = await this.attributesFor(url).catch(() => ({}))
                return toResource(name, url, attributes)
            }),
        )

        return filterBySearch(resources, query.search)
    }

    async get(id: string): Promise<CloudResource | null> {
        const url = await this.queueUrl(id)
        if (!url) return null
        return toResource(id, url, await this.attributesFor(url))
    }

    async create(input: CreateResourceInput): Promise<CloudResource> {
        const name = stringValue(input.values.queueName ?? input.values.name)
        if (!name) throw new ValidationError('queueName is required')
        if (!isValidQueueName(name)) {
            throw new ValidationError(
                'Use a valid SQS queue name: up to 80 alphanumeric characters, hyphens, or underscores.',
            )
        }

        const attributes: Record<string, string> = {}
        const visibilityTimeout = stringValue(input.values.visibilityTimeout)
        const retention = stringValue(input.values.messageRetentionPeriod)
        if (visibilityTimeout) attributes.VisibilityTimeout = visibilityTimeout
        if (retention) attributes.MessageRetentionPeriod = retention

        const res = await this.sqs.send(
            new CreateQueueCommand({
                QueueName: name,
                ...(Object.keys(attributes).length > 0 ? {Attributes: attributes} : {}),
            }),
        )

        const url = res.QueueUrl ?? (await this.queueUrl(name)) ?? ''
        return toResource(name, url, await this.attributesFor(url).catch(() => ({})))
    }

    async delete(id: string): Promise<void> {
        const url = await this.queueUrl(id)
        if (!url) throw new NotFoundError(`Queue ${id} does not exist`)
        await this.sqs.send(new DeleteQueueCommand({QueueUrl: url}))
    }

    /** Listing queue names is cheaper than describing each one. */
    async health(): Promise<void> {
        await this.sqs.send(new ListQueuesCommand({}))
    }

    private async queueUrl(name: string): Promise<string | null> {
        try {
            const res = await this.sqs.send(new GetQueueUrlCommand({QueueName: name}))
            return res.QueueUrl ?? null
        } catch (error) {
            if (isQueueMissing(error)) return null
            throw error
        }
    }

    private async attributesFor(url: string): Promise<QueueAttributes> {
        if (!url) return {}
        const res = await this.sqs.send(
            new GetQueueAttributesCommand({QueueUrl: url, AttributeNames: ['All']}),
        )
        return (res.Attributes ?? {}) as QueueAttributes
    }
}

function toResource(name: string, url: string, attributes: QueueAttributes): CloudResource {
    return {
        id: name,
        name,
        cloud: 'aws',
        service: 'messaging',
        type: attributes.FifoQueue === 'true' ? 'fifo-queue' : 'queue',
        region: null,
        createdAt: epochSecondsToIso(attributes.CreatedTimestamp),
        metadata: {
            provider: 'aws',
            messagingService: 'sqs',
            queueUrl: url,
            arn: attributes.QueueArn,
            approximateMessages: numberValue(attributes.ApproximateNumberOfMessages),
            messagesInFlight: numberValue(attributes.ApproximateNumberOfMessagesNotVisible),
            messagesDelayed: numberValue(attributes.ApproximateNumberOfMessagesDelayed),
            visibilityTimeout: numberValue(attributes.VisibilityTimeout),
            messageRetentionPeriod: numberValue(attributes.MessageRetentionPeriod),
            maximumMessageSize: numberValue(attributes.MaximumMessageSize),
            delaySeconds: numberValue(attributes.DelaySeconds),
            lastModified: epochSecondsToIso(attributes.LastModifiedTimestamp),
        },
    }
}

/** SQS reports timestamps as epoch seconds; the contract uses ISO strings. */
function epochSecondsToIso(value: string | undefined): string | null {
    if (!value) return null
    const seconds = Number(value)
    return Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : null
}

function numberValue(value: string | undefined): number | null {
    if (value === undefined) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

function queueNameFromUrl(url: string): string {
    return url.split('/').filter(Boolean).pop() ?? url
}

function stringValue(value: unknown): string {
    return typeof value === 'string' ? value.trim() : ''
}

function filterBySearch(resources: CloudResource[], search?: string): CloudResource[] {
    const normalized = search?.trim().toLowerCase()
    if (!normalized) return resources
    return resources.filter((resource) => resource.name.toLowerCase().includes(normalized))
}

function isValidQueueName(value: string): boolean {
    // FIFO queues must end in .fifo, which is the one place a dot is allowed.
    return /^[A-Za-z0-9_-]{1,80}$/.test(value) || /^[A-Za-z0-9_-]{1,75}\.fifo$/.test(value)
}

function isQueueMissing(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false
    const name = (error as {name?: string}).name
    return name === 'QueueDoesNotExist' || name === 'AWS.SimpleQueueService.NonExistentQueue'
}

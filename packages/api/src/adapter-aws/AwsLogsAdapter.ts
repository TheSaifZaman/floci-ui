import {
    type CloudWatchLogsClient,
    CreateLogGroupCommand,
    DeleteLogGroupCommand,
    DescribeLogGroupsCommand,
} from '@aws-sdk/client-cloudwatch-logs'
import {NotFoundError, ValidationError} from '../cloud-spi/errors'
import {awsLogsSchema} from '../cloud-spi/logsSchema'
import type {
    CloudResource,
    CloudServiceAdapter,
    CreateResourceInput,
    ResourceQuery,
    ServiceSchema,
} from '../cloud-spi/types'

interface LogGroupShape {
    logGroupName?: string
    createdTime?: number
    arn?: string
    storedBytes?: number
    metricFilterCount?: number
    retentionInDays?: number
}

export class AwsLogsAdapter implements CloudServiceAdapter {
    readonly cloud = 'aws' as const
    readonly service = 'logs' as const

    constructor(private readonly client: CloudWatchLogsClient) {}

    schema(): ServiceSchema {
        return awsLogsSchema()
    }

    async list(query: ResourceQuery = {}): Promise<CloudResource[]> {
        const prefix = query.search?.trim()
        const response = await this.client.send(
            new DescribeLogGroupsCommand(prefix ? {logGroupNamePrefix: prefix} : {}),
        )
        return (response.logGroups ?? []).map(toResource)
    }

    async get(id: string): Promise<CloudResource | null> {
        const group = await this.describeExact(id)
        return group ? toResource(group) : null
    }

    async create(input: CreateResourceInput): Promise<CloudResource> {
        const name = String(input.values.name ?? '').trim()
        if (!name) throw new ValidationError('A log group name is required.')

        await this.client.send(new CreateLogGroupCommand({logGroupName: name}))

        const group = await this.describeExact(name)
        if (!group) throw new NotFoundError(`Log group ${name} was created but could not be read back.`)
        return toResource(group)
    }

    async delete(id: string): Promise<void> {
        await this.client.send(new DeleteLogGroupCommand({logGroupName: id}))
    }

    /**
     * DescribeLogGroups filters by prefix, so `/floci/probe` also returns
     * `/floci/probe-two`. Filtering to an exact match keeps `get` honest.
     */
    private async describeExact(name: string): Promise<LogGroupShape | null> {
        const response = await this.client.send(new DescribeLogGroupsCommand({logGroupNamePrefix: name}))
        return (response.logGroups ?? []).find((group) => group.logGroupName === name) ?? null
    }
}

function toResource(group: LogGroupShape): CloudResource {
    const name = group.logGroupName ?? ''
    return {
        id: name,
        name,
        cloud: 'aws',
        service: 'logs',
        type: 'log-group',
        region: null,
        createdAt: group.createdTime ? new Date(group.createdTime).toISOString() : null,
        metadata: {
            arn: group.arn,
            storedBytes: group.storedBytes ?? 0,
            metricFilterCount: group.metricFilterCount ?? 0,
            retentionInDays: group.retentionInDays ?? null,
        },
    }
}

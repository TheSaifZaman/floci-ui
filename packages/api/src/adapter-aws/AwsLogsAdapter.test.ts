import {describe, expect, test} from 'bun:test'
import {AwsLogsAdapter} from './AwsLogsAdapter'

/**
 * Stubs the SDK client's `send`, dispatching on the command's constructor name.
 * Matching the real SDK's *name* rather than the wire shape is deliberate — see
 * .claude/memory/aws-sdk-error-names-differ-from-wire-codes.md.
 */
function stubClient(handlers: Record<string, (input: Record<string, unknown>) => unknown>) {
    const calls: Array<{command: string; input: Record<string, unknown>}> = []
    const client = {
        async send(command: {constructor: {name: string}; input: Record<string, unknown>}) {
            const name = command.constructor.name
            calls.push({command: name, input: command.input})
            const handler = handlers[name]
            if (!handler) throw new Error(`unexpected command ${name}`)
            return handler(command.input)
        },
    }
    return {client: client as never, calls}
}

describe('AwsLogsAdapter resources', () => {
    test('normalizes log groups as cloud resources', async () => {
        const {client} = stubClient({
            DescribeLogGroupsCommand: () => ({
                logGroups: [{
                    logGroupName: '/floci/probe',
                    createdTime: 1785260691820,
                    arn: 'arn:aws:logs:us-east-1:000000000000:log-group:/floci/probe',
                    storedBytes: 0,
                    metricFilterCount: 0,
                }],
            }),
        })
        const adapter = new AwsLogsAdapter(client)

        await expect(adapter.list()).resolves.toMatchObject([{
            id: '/floci/probe',
            name: '/floci/probe',
            cloud: 'aws',
            service: 'logs',
            type: 'log-group',
            createdAt: new Date(1785260691820).toISOString(),
        }])
    })

    // The runtime filters natively by prefix, so `search` must not be a
    // client-side contains — that would silently disagree with the field label.
    test('search is sent as logGroupNamePrefix', async () => {
        const {client, calls} = stubClient({DescribeLogGroupsCommand: () => ({logGroups: []})})
        const adapter = new AwsLogsAdapter(client)

        await adapter.list({search: '/floci'})

        expect(calls[0].input).toMatchObject({logGroupNamePrefix: '/floci'})
    })

    test('get returns null for a group the runtime does not have', async () => {
        const {client} = stubClient({DescribeLogGroupsCommand: () => ({logGroups: []})})
        const adapter = new AwsLogsAdapter(client)

        await expect(adapter.get('/nope')).resolves.toBeNull()
    })

    // DescribeLogGroups is a prefix match, so a longer name starting with the
    // requested one would otherwise be returned as if it were an exact hit.
    test('get matches the name exactly, not by prefix', async () => {
        const {client} = stubClient({
            DescribeLogGroupsCommand: () => ({logGroups: [{logGroupName: '/floci/probe-two', createdTime: 1}]}),
        })
        const adapter = new AwsLogsAdapter(client)

        await expect(adapter.get('/floci/probe')).resolves.toBeNull()
    })

    test('create and delete issue the right commands', async () => {
        const {client, calls} = stubClient({
            CreateLogGroupCommand: () => ({}),
            DeleteLogGroupCommand: () => ({}),
            DescribeLogGroupsCommand: () => ({logGroups: [{logGroupName: '/floci/new', createdTime: 1}]}),
        })
        const adapter = new AwsLogsAdapter(client)

        await expect(adapter.create({values: {name: '/floci/new'}})).resolves.toMatchObject({id: '/floci/new'})
        await adapter.delete('/floci/new')

        expect(calls.map((call) => call.command)).toEqual([
            'CreateLogGroupCommand',
            'DescribeLogGroupsCommand',
            'DeleteLogGroupCommand',
        ])
    })

    test('create rejects a blank name before calling the runtime', async () => {
        const {client, calls} = stubClient({})
        const adapter = new AwsLogsAdapter(client)

        await expect(adapter.create({values: {name: '  '}})).rejects.toThrow()
        expect(calls).toEqual([])
    })
})

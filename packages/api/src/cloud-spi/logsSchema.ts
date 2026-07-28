import type {ServiceSchema} from './types'

export function awsLogsSchema(): ServiceSchema {
    return {
        cloud: 'aws',
        service: 'logs',
        displayName: 'CloudWatch Logs',
        fields: [
            {
                name: 'name',
                label: 'Log group name',
                type: 'text',
                required: true,
                validation: {
                    minLength: 1,
                    maxLength: 512,
                    pattern: '^[A-Za-z0-9_./#-]+$',
                    message: 'Use letters, numbers, underscore, dot, slash, hash, or dash.',
                },
            },
        ],
        actions: ['list', 'create', 'delete', 'inspect'],
        capabilities: {
            resourceActions: [
                {name: 'list', label: 'List log groups', enabled: true, status: 'available', runtimeRequired: true},
                {name: 'create', label: 'Create log group', enabled: true, status: 'available', runtimeRequired: true},
                {name: 'delete', label: 'Delete log group', enabled: true, status: 'available', runtimeRequired: true},
                {name: 'inspect', label: 'Inspect metadata', enabled: true, status: 'available', runtimeRequired: true},
            ],
        },
        filters: [
            {
                name: 'search',
                label: 'Name starts with',
                type: 'text',
                required: false,
                description: 'CloudWatch filters log groups by prefix, not by substring.',
            },
        ],
        columns: [
            {name: 'name', label: 'Log group'},
            {name: 'storedBytes', label: 'Stored', path: 'metadata.storedBytes', format: 'bytes'},
            {name: 'retentionInDays', label: 'Retention', path: 'metadata.retentionInDays', emptyText: 'Never expires'},
            {name: 'createdAt', label: 'Created', format: 'datetime'},
        ],
    }
}

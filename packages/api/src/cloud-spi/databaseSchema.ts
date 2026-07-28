import type {CloudProvider, FieldSchema, ServiceSchema, TableColumnSchema} from './types'

const databaseColumns: TableColumnSchema[] = [
    {name: 'name', label: 'Name'},
    {name: 'status', label: 'Status'},
    {name: 'engine', label: 'Engine'},
    {name: 'version', label: 'Version'},
    {name: 'instanceClass', label: 'Class'},
]

/** Cloud SQL reports a connection endpoint, which RDS does not surface here. */
const cloudSqlColumns: TableColumnSchema[] = [
    {name: 'name', label: 'Name'},
    {name: 'status', label: 'Status', format: 'badge'},
    {name: 'engine', label: 'Version'},
    {name: 'region', label: 'Region'},
    {name: 'instanceClass', label: 'Tier'},
    {name: 'connectionName', label: 'Connection', path: 'metadata.connectionName', format: 'code'},
]

const databaseFilters: FieldSchema[] = [
    {name: 'search', label: 'Search', type: 'text', required: false},
]

export function awsDatabaseSchema(): ServiceSchema {
    return {
        cloud: 'aws',
        service: 'database',
        displayName: 'AWS RDS',
        fields: [],
        actions: ['list', 'inspect'],
        filters: databaseFilters,
        columns: databaseColumns,
    }
}

export function azureDatabaseSchema(): ServiceSchema {
    return {
        cloud: 'azure',
        service: 'database',
        displayName: 'Cosmos DB',
        fields: [
            {
                name: 'databaseName',
                label: 'Database Name',
                type: 'text',
                required: true,
                validation: {
                    minLength: 1,
                    maxLength: 255,
                    pattern: '^[A-Za-z0-9._-]+$',
                    message: 'Use letters, numbers, dot, underscore, or dash.',
                },
            },
        ],
        actions: ['list', 'create', 'delete', 'inspect'],
        capabilities: {
            resourceActions: [
                {name: 'list', label: 'List databases', enabled: true, status: 'available', runtimeRequired: true},
                {name: 'create', label: 'Create database', enabled: true, status: 'available', runtimeRequired: true},
                {name: 'delete', label: 'Delete database', enabled: true, status: 'available', runtimeRequired: true},
                {name: 'inspect', label: 'Inspect metadata', enabled: true, status: 'available', runtimeRequired: true},
            ],
        },
        filters: databaseFilters,
        columns: [
            {name: 'name', label: 'Database'},
            {name: 'engine', label: 'Engine'},
            {name: 'status', label: 'Status'},
            {name: 'createdAt', label: 'Created At'},
        ],
    }
}

export function gcpDatabaseSchema(): ServiceSchema {
    return {
        cloud: 'gcp',
        service: 'database',
        displayName: 'Cloud SQL',
        fields: [
            {
                name: 'instanceName',
                label: 'Instance Name',
                type: 'text',
                required: true,
                description: 'Lowercase letters, numbers, and hyphens; must start with a letter.',
            },
            {
                name: 'databaseVersion',
                label: 'Database Version',
                type: 'select',
                required: false,
                // The runtime backs instances with real Postgres containers and
                // rejects every other engine, so this is not the full GCP list.
                description: 'The local runtime supports PostgreSQL only.',
                options: [
                    {label: 'PostgreSQL 15', value: 'POSTGRES_15'},
                    {label: 'PostgreSQL 16', value: 'POSTGRES_16'},
                ],
            },
            {
                name: 'region',
                label: 'Region',
                type: 'text',
                required: false,
                description: 'Defaults to us-central1.',
            },
            {
                name: 'tier',
                label: 'Machine Tier',
                type: 'text',
                required: false,
                description: 'Defaults to db-f1-micro.',
            },
        ],
        actions: ['list', 'create', 'inspect', 'delete'],
        filters: databaseFilters,
        columns: cloudSqlColumns,
        capabilities: {
            resourceActions: [
                {name: 'list', label: 'List instances', enabled: true, status: 'available', runtimeRequired: true},
                {name: 'create', label: 'Create instance', enabled: true, status: 'available', runtimeRequired: true},
                {name: 'delete', label: 'Delete instance', enabled: true, status: 'available', runtimeRequired: true},
                {name: 'inspect', label: 'Inspect instance', enabled: true, status: 'available', runtimeRequired: false},
            ],
        },
    }
}

export function databaseSchemaFor(cloud: CloudProvider): ServiceSchema | null {
    if (cloud === 'aws') return awsDatabaseSchema()
    if (cloud === 'azure') return azureDatabaseSchema()
    if (cloud === 'gcp') return gcpDatabaseSchema()
    return null
}

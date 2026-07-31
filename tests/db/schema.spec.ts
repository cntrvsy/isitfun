import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { telemetrySessions, organizationMemberships } from '$lib/server/db/db-schema';

describe('Database Schema Composite Indexes', () => {
	it('should define a composite index (projectId, createdAt) on telemetrySessions', () => {
		const config = getTableConfig(telemetrySessions);
		const indexNames = config.indexes.map((idx) => idx.config.name);
		expect(indexNames).toContain('telemetry_sessions_projectId_createdAt_idx');

		const compositeIndex = config.indexes.find(
			(idx) => idx.config.name === 'telemetry_sessions_projectId_createdAt_idx'
		);
		expect(compositeIndex).toBeDefined();

		const columnNames = compositeIndex?.config.columns.map((col) => (col as { name: string }).name);
		expect(columnNames).toEqual(['project_id', 'created_at']);
	});

	it('should define a composite index (organizationId, userId) on organizationMemberships', () => {
		const config = getTableConfig(organizationMemberships);
		const indexNames = config.indexes.map((idx) => idx.config.name);
		expect(indexNames).toContain('org_mem_orgId_userId_idx');

		const compositeIndex = config.indexes.find(
			(idx) => idx.config.name === 'org_mem_orgId_userId_idx'
		);
		expect(compositeIndex).toBeDefined();

		const columnNames = compositeIndex?.config.columns.map((col) => (col as { name: string }).name);
		expect(columnNames).toEqual(['organization_id', 'user_id']);
	});
});

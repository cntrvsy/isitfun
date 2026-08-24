<script lang="ts" generics="TData extends RowData">
	import {
		createTable,
		FlexRender,
		stockFeatures,
		type SortingState,
		type PaginationState,
		type ColumnDef,
		type RowData
	} from '@tanstack/svelte-table';
	import {
		ArrowUpDown,
		ArrowUp,
		ArrowDown,
		ChevronLeft,
		ChevronRight,
		Search
	} from '@lucide/svelte';

	interface Props {
		data: TData[];
		columns: ColumnDef<typeof stockFeatures, TData>[];
		pageSize?: number;
		searchPlaceholder?: string;
	}

	let { data, columns, pageSize = 10, searchPlaceholder = 'Search records...' }: Props = $props();

	let sorting = $state<SortingState>([]);
	let globalFilter = $state('');
	let pagination = $state<PaginationState>({
		pageIndex: 0,
		pageSize: 10
	});

	$effect(() => {
		pagination.pageSize = pageSize;
	});

	const table = createTable({
		features: stockFeatures,
		get data() {
			return data;
		},
		get columns() {
			return columns;
		},
		state: {
			get sorting() {
				return sorting;
			},
			get globalFilter() {
				return globalFilter;
			},
			get pagination() {
				return pagination;
			}
		},
		onSortingChange: (updater) => {
			sorting = typeof updater === 'function' ? updater(sorting) : updater;
		},
		onGlobalFilterChange: (updater) => {
			globalFilter = typeof updater === 'function' ? updater(globalFilter) : updater;
		},
		onPaginationChange: (updater) => {
			pagination = typeof updater === 'function' ? updater(pagination) : updater;
		}
	});
</script>

<div class="space-y-3">
	<!-- Filter & Search Controls -->
	<div class="flex items-center justify-between gap-4">
		<div class="relative max-w-xs flex-1">
			<Search class="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
			<input
				type="text"
				bind:value={globalFilter}
				placeholder={searchPlaceholder}
				class="w-full rounded-lg border border-slate-200 bg-white py-1.5 pr-3 pl-8 text-xs text-slate-900 placeholder-slate-400 focus:border-purple-600 focus:outline-none"
			/>
		</div>
		<div class="text-[11px] text-slate-500">
			Showing {table.getRowModel().rows.length} of {data.length} records
		</div>
	</div>

	<!-- Table Element -->
	<div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
		<table class="w-full text-left text-xs">
			<thead
				class="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500"
			>
				{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
					<tr>
						{#each headerGroup.headers as header (header.id)}
							<th class="p-3 select-none">
								{#if !header.isPlaceholder}
									{#if header.column.getCanSort()}
										<button
											type="button"
											onclick={header.column.getToggleSortingHandler()}
											class="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900"
										>
											<FlexRender {header} />
											{#if header.column.getIsSorted() === 'asc'}
												<ArrowUp class="h-3 w-3 text-purple-600" />
											{:else if header.column.getIsSorted() === 'desc'}
												<ArrowDown class="h-3 w-3 text-purple-600" />
											{:else}
												<ArrowUpDown class="h-3 w-3 text-slate-300 hover:text-slate-500" />
											{/if}
										</button>
									{:else}
										<FlexRender {header} />
									{/if}
								{/if}
							</th>
						{/each}
					</tr>
				{/each}
			</thead>
			<tbody class="divide-y divide-slate-100 text-slate-700">
				{#if table.getRowModel().rows.length === 0}
					<tr>
						<td colspan={columns.length} class="p-8 text-center text-slate-400 italic">
							No records match your criteria.
						</td>
					</tr>
				{:else}
					{#each table.getRowModel().rows as row (row.id)}
						<tr class="transition-colors hover:bg-slate-50/60">
							{#each row.getVisibleCells() as cell (cell.id)}
								<td class="p-3">
									<FlexRender {cell} />
								</td>
							{/each}
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	<!-- Pagination Controls -->
	{#if table.getPageCount() > 1}
		<div class="flex items-center justify-between gap-4 pt-1">
			<span class="text-xs text-slate-500">
				Page {table.atoms.pagination.get().pageIndex + 1} of {table.getPageCount()}
			</span>
			<div class="flex items-center gap-1.5">
				<button
					onclick={() => table.previousPage()}
					disabled={!table.getCanPreviousPage()}
					class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
				>
					<ChevronLeft class="h-3.5 w-3.5" /> Previous
				</button>
				<button
					onclick={() => table.nextPage()}
					disabled={!table.getCanNextPage()}
					class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
				>
					Next <ChevronRight class="h-3.5 w-3.5" />
				</button>
			</div>
		</div>
	{/if}
</div>

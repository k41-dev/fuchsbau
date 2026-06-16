<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import { toLocalDateTimeInputValue } from '$lib/datetime-input';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let showDetails = $state(false);
	let correctingEntryId = $state<number | null>(null);
	let keepRunningOnCorrect = $state(false);

	function formatTime(iso: string | null) {
		if (!iso) return '—';
		return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function exportUrl(format: 'summary' | 'full' = 'summary') {
		const params = new URLSearchParams({ from: data.from, to: data.to, format });
		if (data.projectId) params.set('project', String(data.projectId));
		return `/reports/export?${params}`;
	}

	function openCorrection(entryId: number, isRunning: boolean) {
		if (correctingEntryId === entryId) {
			correctingEntryId = null;
			return;
		}
		correctingEntryId = entryId;
		keepRunningOnCorrect = isRunning;
	}

	$effect(() => {
		if (form?.corrected) {
			correctingEntryId = null;
			showDetails = true;
		}
	});
</script>

<div class="max-w-5xl mx-auto px-6 py-10">
	<div class="flex items-end justify-between mb-8 gap-4">
		<div>
			<h1 class="text-4xl font-semibold tracking-tighter">Time reports</h1>
			<p class="text-muted-foreground mt-1">
				{#if data.isOwnerView}
					Crew hours across your job sites
				{:else}
					Your logged hours on assigned job sites
				{/if}
			</p>
		</div>
		{#if data.entries.length > 0 || data.totalAbsences > 0}
			<div class="flex flex-col sm:flex-row gap-2 shrink-0">
				<a
					href={exportUrl('summary')}
					class="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors text-center"
				>
					Export payroll
				</a>
				<a
					href={exportUrl('full')}
					class="h-10 px-4 rounded-xl border text-sm font-medium hover:bg-muted transition-colors text-center"
				>
					Full CSV
				</a>
			</div>
		{/if}
	</div>

	{#if form?.corrected}
		<div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 mb-6 text-sm text-emerald-800">
			Time entry corrected and saved to the audit log.
		</div>
	{:else if form?.error}
		<div class="rounded-2xl border border-red-200 bg-red-50 p-4 mb-6 text-sm text-red-600">
			{form.error}
		</div>
	{/if}

	<!-- Filters -->
	<form method="GET" class="rounded-2xl border bg-card p-5 mb-8 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
		<div class="space-y-2">
			<label for="from" class="text-sm font-medium">From</label>
			<input
				id="from"
				name="from"
				type="date"
				value={data.from}
				required
				class="w-full h-10 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
			/>
		</div>

		<div class="space-y-2">
			<label for="to" class="text-sm font-medium">To</label>
			<input
				id="to"
				name="to"
				type="date"
				value={data.to}
				required
				class="w-full h-10 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
			/>
		</div>

		<div class="space-y-2 sm:col-span-2">
			<label for="project" class="text-sm font-medium">Job site</label>
			<select
				id="project"
				name="project"
				value={data.projectId ?? ''}
				class="w-full h-10 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
			>
				<option value="">All job sites</option>
				{#each data.projects as proj}
					<option value={proj.id}>{proj.name}{proj.isOwner ? ' (managed)' : ''}</option>
				{/each}
			</select>
		</div>

		<button
			type="submit"
			class="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors sm:col-span-4 sm:w-auto sm:justify-self-start"
		>
			Apply filters
		</button>
	</form>

	<!-- Totals -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
		<div class="rounded-2xl border bg-card p-5">
			<div class="text-xs uppercase tracking-widest text-muted-foreground mb-1">Total hours</div>
			<div class="text-5xl font-semibold tracking-tighter">{data.totalHours}</div>
		</div>
		<div class="rounded-2xl border bg-card p-5">
			<div class="text-xs uppercase tracking-widest text-muted-foreground mb-1">Time entries</div>
			<div class="text-5xl font-semibold tracking-tighter">{data.totalEntries}</div>
		</div>
		<div class="rounded-2xl border bg-card p-5">
			<div class="text-xs uppercase tracking-widest text-muted-foreground mb-1">Sick days</div>
			<div class="text-5xl font-semibold tracking-tighter text-blue-700">{data.totalSickDays}</div>
		</div>
		<div class="rounded-2xl border bg-card p-5">
			<div class="text-xs uppercase tracking-widest text-muted-foreground mb-1">Vacation days</div>
			<div class="text-5xl font-semibold tracking-tighter text-violet-700">
				{data.totalVacationDays}
			</div>
		</div>
	</div>

	{#if data.projects.length === 0}
		<div class="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
			You're not assigned to any job sites yet. Create or join a project to see reports.
		</div>
	{:else if data.summaries.length === 0 && data.totalAbsences === 0}
		<div class="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
			No time entries or absences found for this period.
		</div>
	{:else}
		{#if data.absenceSummaries.length > 0}
			<div class="mb-8">
				<h2 class="font-semibold text-xl tracking-tight mb-4">Absences by worker</h2>
				<div class="rounded-2xl border bg-card overflow-hidden">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b bg-muted/40 text-left">
								<th class="px-5 py-3 font-medium">Worker</th>
								<th class="px-5 py-3 font-medium text-right">Sick days</th>
								<th class="px-5 py-3 font-medium text-right">Vacation days</th>
							</tr>
						</thead>
						<tbody>
							{#each data.absenceSummaries as row}
								<tr class="border-b last:border-0">
									<td class="px-5 py-3">
										<div class="font-medium">{row.userName ?? row.userEmail}</div>
										{#if row.userName}
											<div class="text-xs text-muted-foreground">{row.userEmail}</div>
										{/if}
									</td>
									<td class="px-5 py-3 text-right font-mono font-medium text-blue-700">
										{row.sickDays}
									</td>
									<td class="px-5 py-3 text-right font-mono font-medium text-violet-700">
										{row.vacationDays}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		{#if data.absences.length > 0}
			<div class="mb-8">
				<h2 class="font-semibold text-xl tracking-tight mb-4">Absence detail</h2>
				<div class="rounded-2xl border bg-card overflow-hidden">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b bg-muted/40 text-left">
								<th class="px-5 py-3 font-medium">Date</th>
								<th class="px-5 py-3 font-medium">Worker</th>
								<th class="px-5 py-3 font-medium">Type</th>
								<th class="px-5 py-3 font-medium">Note</th>
							</tr>
						</thead>
						<tbody>
							{#each data.absences as absence}
								<tr class="border-b last:border-0">
									<td class="px-5 py-3">{absence.date}</td>
									<td class="px-5 py-3">{absence.userName ?? absence.userEmail}</td>
									<td class="px-5 py-3">
										<span
											class="text-xs px-2 py-1 rounded-full font-medium {absence.type === 'vacation'
												? 'bg-violet-100 text-violet-800'
												: 'bg-blue-100 text-blue-800'}"
										>
											{absence.type === 'vacation' ? 'Vacation' : 'Sick'}
										</span>
									</td>
									<td class="px-5 py-3 text-muted-foreground">{absence.note ?? '—'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		{#if data.summaries.length > 0}
		<!-- Hours summary -->
		<div class="mb-8">
			<h2 class="font-semibold text-xl tracking-tight mb-4">Hours by worker & job site</h2>
			<div class="rounded-2xl border bg-card overflow-hidden">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b bg-muted/40 text-left">
							<th class="px-5 py-3 font-medium">Worker</th>
							<th class="px-5 py-3 font-medium">Job site</th>
							<th class="px-5 py-3 font-medium text-right">Entries</th>
							<th class="px-5 py-3 font-medium text-right">Hours</th>
						</tr>
					</thead>
					<tbody>
						{#each data.summaries as row}
							<tr class="border-b last:border-0">
								<td class="px-5 py-3">
									<div class="font-medium">{row.userName ?? row.userEmail}</div>
									{#if row.userName}
										<div class="text-xs text-muted-foreground">{row.userEmail}</div>
									{/if}
								</td>
								<td class="px-5 py-3">{row.projectName}</td>
								<td class="px-5 py-3 text-right text-muted-foreground">{row.entryCount}</td>
								<td class="px-5 py-3 text-right font-mono font-medium">{row.totalHours}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
		{/if}

		{#if data.entries.length > 0}
		<!-- Detail -->
		<div>
			<button
				onclick={() => (showDetails = !showDetails)}
				class="font-semibold text-xl tracking-tight mb-4 flex items-center gap-2 hover:opacity-80 transition-opacity"
			>
				Detailed entries
				<span class="text-sm text-muted-foreground font-normal">{showDetails ? '▲' : '▼'}</span>
			</button>

			{#if showDetails}
				<div class="rounded-2xl border bg-card overflow-x-auto">
					<table class="w-full text-sm min-w-[640px]">
						<thead>
							<tr class="border-b bg-muted/40 text-left">
								<th class="px-5 py-3 font-medium">Date</th>
								<th class="px-5 py-3 font-medium">Worker</th>
								<th class="px-5 py-3 font-medium">Job site</th>
								<th class="px-5 py-3 font-medium">Role</th>
								<th class="px-5 py-3 font-medium">Start</th>
								<th class="px-5 py-3 font-medium">End</th>
								<th class="px-5 py-3 font-medium text-right">Hours</th>
								{#if data.isOwnerView}
									<th class="px-5 py-3 font-medium text-right">Actions</th>
								{/if}
							</tr>
						</thead>
						<tbody>
							{#each data.entries as entry}
								<tr class="border-b last:border-0 align-top">
									<td class="px-5 py-3">{entry.date}</td>
									<td class="px-5 py-3">
										<div>{entry.userName ?? entry.userEmail}</div>
										{#if entry.correctionCount > 0}
											<span class="text-xs text-amber-700">Edited {entry.correctionCount}×</span>
										{/if}
									</td>
									<td class="px-5 py-3">{entry.projectName}</td>
									<td class="px-5 py-3 text-muted-foreground">{entry.roleName ?? '—'}</td>
									<td class="px-5 py-3 font-mono text-xs">{formatTime(entry.startTime)}</td>
									<td class="px-5 py-3 font-mono text-xs">
										{#if entry.isRunning}
											<span class="text-emerald-600">Running</span>
										{:else}
											{formatTime(entry.endTime)}
										{/if}
									</td>
									<td class="px-5 py-3 text-right font-mono font-medium">{entry.hours}</td>
									{#if data.isOwnerView}
										<td class="px-5 py-3 text-right">
											{#if entry.canCorrect}
												<button
													type="button"
													onclick={() => openCorrection(entry.entryId, entry.isRunning)}
													class="text-sm font-medium text-primary hover:underline"
												>
													{correctingEntryId === entry.entryId ? 'Close' : 'Correct'}
												</button>
											{:else}
												<span class="text-xs text-muted-foreground">—</span>
											{/if}
										</td>
									{/if}
								</tr>
								{#if data.isOwnerView && entry.canCorrect && correctingEntryId === entry.entryId}
									<tr class="border-b bg-muted/20">
										<td colspan="8" class="px-5 py-4">
											<form
												method="POST"
												action="?/correctEntry"
												use:enhance={() => {
													return async ({ update }) => {
														await update();
													};
												}}
												class="space-y-4"
											>
												<input type="hidden" name="entryId" value={entry.entryId} />
												<div>
													<h3 class="font-medium mb-1">Correct time entry</h3>
													<p class="text-sm text-muted-foreground">
														{entry.userName ?? entry.userEmail} · {entry.projectName} ·
														{entry.date}
													</p>
												</div>
												<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
													<label class="space-y-2 text-sm block">
														<span class="font-medium">Start</span>
														<input
															type="datetime-local"
															name="startTime"
															required
															value={toLocalDateTimeInputValue(entry.startTime)}
															class="w-full h-10 rounded-xl border bg-background px-3 text-sm"
														/>
													</label>
													<label class="space-y-2 text-sm block">
														<span class="font-medium">End</span>
														<input
															type="datetime-local"
															name="endTime"
															value={entry.endTime
																? toLocalDateTimeInputValue(entry.endTime)
																: ''}
															required={!entry.isRunning}
															disabled={entry.isRunning && keepRunningOnCorrect}
															class="w-full h-10 rounded-xl border bg-background px-3 text-sm disabled:opacity-50"
														/>
													</label>
												</div>
												{#if entry.isRunning}
													<label class="flex items-center gap-2 text-sm">
														<input
															type="checkbox"
															name="keepRunning"
															bind:checked={keepRunningOnCorrect}
														/>
														Keep shift running (only adjust start time)
													</label>
												{/if}
												<label class="space-y-2 text-sm block">
													<span class="font-medium">Reason *</span>
													<textarea
														name="reason"
														required
														rows="2"
														placeholder="e.g. Worker forgot to clock out at 17:00"
														class="w-full rounded-xl border bg-background px-3 py-2 text-sm resize-none"
													></textarea>
												</label>
												<div class="flex gap-3">
													<button
														type="submit"
														class="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
													>
														Save correction
													</button>
													<button
														type="button"
														onclick={() => (correctingEntryId = null)}
														class="h-10 px-5 rounded-xl border text-sm font-medium"
													>
														Cancel
													</button>
												</div>
											</form>
										</td>
									</tr>
								{/if}
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
		{/if}
	{/if}
</div>
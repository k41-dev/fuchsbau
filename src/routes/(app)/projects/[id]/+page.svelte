<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { onMount, onDestroy } from 'svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let elapsedMap = $state<Record<number, string>>({});
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	function startLiveTimers() {
		stopLiveTimers();
		if (!data.activeWorkers.length) return;

		timerInterval = setInterval(() => {
			const now = Date.now();
			const newMap: Record<number, string> = {};

			for (const w of data.activeWorkers) {
				const start = new Date(w.startTime);
				const diff = Math.floor((now - start.getTime()) / 1000);
				const h = Math.floor(diff / 3600);
				const m = Math.floor((diff % 3600) / 60);
				const s = diff % 60;
				newMap[w.entryId] = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
			}
			elapsedMap = newMap;
		}, 1000);
	}

	function stopLiveTimers() {
		if (timerInterval) clearInterval(timerInterval);
		timerInterval = null;
	}

	function handleFormResult() {
		if (form?.success) window.location.reload();
	}

	$effect(() => {
		if (form) handleFormResult();
	});

	onMount(startLiveTimers);
	onDestroy(stopLiveTimers);

	function getElapsed(entryId: number | null) {
		if (!entryId) return '00:00:00';
		return elapsedMap[entryId] || '00:00:00';
	}

	function formatDateLabel(dateStr: string) {
		const d = new Date(dateStr + 'T12:00:00');
		const today = new Date();
		const isToday = dateStr === today.toISOString().slice(0, 10);
		if (isToday) return 'Today';
		return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
	}
</script>

<div class="max-w-5xl mx-auto px-6 py-8">
	<!-- Header -->
	<div class="flex items-center justify-between mb-6 gap-4">
		<div>
			<a href="/projects" class="text-sm text-muted-foreground hover:text-foreground">← All job sites</a>
			<h1 class="text-4xl font-semibold tracking-tighter mt-1">{data.project.name}</h1>
			{#if data.project.address}
				<p class="text-muted-foreground mt-1">{data.project.address}</p>
			{/if}
			{#if data.isOwner}
				<p class="text-xs text-muted-foreground mt-2">Site supervisor view</p>
			{/if}
		</div>

		{#if data.myActiveEntry}
			<div class="flex items-center gap-4 shrink-0">
				<div class="text-right">
					<div class="text-xs text-muted-foreground">You are tracking</div>
					<div class="font-mono text-2xl font-semibold tracking-tighter text-emerald-600">
						{getElapsed(data.myActiveEntry.id)}
					</div>
				</div>
				<form method="POST" action="?/clockOut">
					<button
						type="submit"
						class="h-11 px-6 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
					>
						Clock Out
					</button>
				</form>
			</div>
		{/if}
	</div>

	{#if data.canManage}
		<!-- Date filter (supervisor) -->
		<form method="GET" class="flex items-center gap-3 mb-6">
			<label for="date" class="text-sm font-medium text-muted-foreground">Viewing</label>
			<input
				id="date"
				name="date"
				type="date"
				value={data.selectedDate}
				max={new Date().toISOString().slice(0, 10)}
				class="h-9 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
			/>
			<button
				type="submit"
				class="h-9 px-4 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
			>
				Update
			</button>
			{#if data.selectedDate !== new Date().toISOString().slice(0, 10)}
				<a href="/projects/{data.project.id}" class="text-sm text-muted-foreground hover:text-foreground">
					Back to today
				</a>
			{/if}
		</form>

		<!-- Stale clock-out alerts -->
		{#if data.daySummary.isToday && data.daySummary.staleWorkers.length > 0}
			<div class="rounded-2xl border border-amber-200 bg-amber-50 p-5 mb-6">
				<div class="font-medium text-amber-900 mb-2">
					{data.daySummary.staleWorkers.length} worker{data.daySummary.staleWorkers.length === 1 ? '' : 's'} may have forgotten to clock out
				</div>
				<div class="space-y-2">
					{#each data.daySummary.staleWorkers as stale}
						<div class="flex items-center justify-between gap-4 text-sm">
							<div>
								<span class="font-medium text-amber-900">{stale.userName || stale.userEmail}</span>
								<span class="text-amber-700 ml-2">{stale.staleReason}</span>
							</div>
							<form method="POST" action="?/forceClockOut">
								<input type="hidden" name="userId" value={stale.userId} />
								<button type="submit" class="text-xs font-medium text-amber-900 hover:underline">
									Clock out for them
								</button>
							</form>
						</div>
					{/each}
				</div>
			</div>
		{:else if data.daySummary.isToday && data.stats.allClockedOut && data.stats.workerCount > 0}
			<div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 mb-6 text-sm text-emerald-800">
				Everyone has clocked out for today.
			</div>
		{/if}
	{/if}

	<!-- Stats -->
	<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
		<div class="rounded-2xl border bg-card p-5">
			<div class="text-xs uppercase tracking-widest text-muted-foreground mb-1">Active now</div>
			<div class="text-4xl font-semibold tracking-tighter">{data.stats.activeCount}</div>
		</div>
		<div class="rounded-2xl border bg-card p-5">
			<div class="text-xs uppercase tracking-widest text-muted-foreground mb-1">
				Hours · {formatDateLabel(data.selectedDate)}
			</div>
			<div class="text-4xl font-semibold tracking-tighter">{data.stats.totalHours}</div>
		</div>
		<div class="rounded-2xl border bg-card p-5">
			<div class="text-xs uppercase tracking-widest text-muted-foreground mb-1">Workers</div>
			<div class="text-4xl font-semibold tracking-tighter">{data.stats.workerCount}</div>
		</div>
		<div class="rounded-2xl border bg-card p-5">
			<div class="text-xs uppercase tracking-widest text-muted-foreground mb-1">Clock-ins</div>
			<div class="text-4xl font-semibold tracking-tighter">{data.stats.clockInCount}</div>
		</div>
		{#if data.canManage}
			<div class="rounded-2xl border bg-card p-5">
				<div class="text-xs uppercase tracking-widest text-muted-foreground mb-1">Sick</div>
				<div class="text-4xl font-semibold tracking-tighter text-blue-700">{data.stats.sickCount}</div>
			</div>
			<div class="rounded-2xl border bg-card p-5">
				<div class="text-xs uppercase tracking-widest text-muted-foreground mb-1">Vacation</div>
				<div class="text-4xl font-semibold tracking-tighter text-violet-700">
					{data.stats.vacationCount}
				</div>
			</div>
		{/if}
	</div>

	{#if data.canManage && data.daySummary.absences.length > 0}
		<div class="rounded-2xl border bg-card p-5 mb-8">
			<h2 class="font-semibold text-lg tracking-tight mb-4">
				Away · {formatDateLabel(data.selectedDate)}
			</h2>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
				{#each data.daySummary.absences as absent}
					<div class="rounded-xl border px-4 py-3 flex items-center justify-between gap-3">
						<div class="min-w-0">
							<div class="font-medium truncate">{absent.userName || absent.userEmail}</div>
							{#if absent.note}
								<div class="text-xs text-muted-foreground truncate">{absent.note}</div>
							{/if}
						</div>
						<span
							class="text-xs px-2.5 py-1 rounded-full shrink-0 font-medium {absent.type === 'vacation'
								? 'bg-violet-100 text-violet-800'
								: 'bg-blue-100 text-blue-800'}"
						>
							{absent.type === 'vacation' ? 'Vacation' : 'Sick'}
						</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Active Workers (live) -->
	{#if data.daySummary.isToday}
		<div class="mb-10">
			<h2 class="font-semibold text-xl tracking-tight mb-4 flex items-center gap-2">
				Who's on site right now
				<span class="text-xs px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
					{data.stats.activeCount}
				</span>
			</h2>

			{#if data.activeWorkers.length === 0}
				<div class="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
					No one is currently clocked in.
				</div>
			{:else}
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					{#each data.activeWorkers as worker}
						<div
							class="rounded-2xl border bg-card p-5 flex justify-between items-center {worker.isStale
								? 'border-amber-300 bg-amber-50/50'
								: ''}"
						>
							<div>
								<div class="font-medium">{worker.userName || worker.userEmail}</div>
								<div class="text-sm text-muted-foreground">{worker.roleName || 'No role'}</div>
								{#if worker.isStale}
									<div class="text-xs text-amber-700 mt-1">{worker.staleReason}</div>
								{/if}
							</div>
							<div class="text-right flex flex-col items-end gap-2">
								<div>
									<div
										class="font-mono text-3xl font-semibold tracking-tighter {worker.isStale
											? 'text-amber-600'
											: 'text-emerald-600'}"
									>
										{getElapsed(worker.entryId)}
									</div>
									<div class="text-[10px] text-muted-foreground">ELAPSED</div>
								</div>
								{#if data.canManage && worker.isStale}
									<form method="POST" action="?/forceClockOut">
										<input type="hidden" name="userId" value={worker.userId} />
										<button
											type="submit"
											class="text-xs text-amber-800 hover:underline font-medium"
										>
											Force clock out
										</button>
									</form>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Daily crew breakdown (supervisor) -->
	{#if data.canManage && data.daySummary.workers.length > 0}
		<div class="mb-10">
			<div class="flex items-center justify-between mb-4">
				<h2 class="font-semibold text-xl tracking-tight">
					Crew hours · {formatDateLabel(data.selectedDate)}
				</h2>
				<a href="/reports?project={data.project.id}&from={data.selectedDate}&to={data.selectedDate}" class="text-sm text-muted-foreground hover:text-foreground">
					Full report →
				</a>
			</div>
			<div class="rounded-2xl border bg-card overflow-hidden">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b bg-muted/40 text-left">
							<th class="px-5 py-3 font-medium">Worker</th>
							<th class="px-5 py-3 font-medium text-right">Entries</th>
							<th class="px-5 py-3 font-medium text-right">Hours</th>
							<th class="px-5 py-3 font-medium text-right">Status</th>
						</tr>
					</thead>
					<tbody>
						{#each data.daySummary.workers as worker}
							<tr class="border-b last:border-0">
								<td class="px-5 py-3">
									<div class="font-medium">{worker.userName || worker.userEmail}</div>
								</td>
								<td class="px-5 py-3 text-right text-muted-foreground">{worker.entryCount}</td>
								<td class="px-5 py-3 text-right font-mono font-medium">{worker.totalHours}</td>
								<td class="px-5 py-3 text-right">
									{#if worker.absenceType === 'sick'}
										<span class="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">Sick</span>
									{:else if worker.absenceType === 'vacation'}
										<span class="text-xs px-2 py-1 rounded-full bg-violet-100 text-violet-800"
											>Vacation</span
										>
									{:else if worker.isActiveNow}
										<span class="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700"
											>On site</span
										>
									{:else}
										<span class="text-xs text-muted-foreground">Clocked out</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr class="bg-muted/20">
							<td class="px-5 py-3 font-medium">Total</td>
							<td class="px-5 py-3 text-right text-muted-foreground">{data.stats.clockInCount}</td>
							<td class="px-5 py-3 text-right font-mono font-semibold">{data.stats.totalHours}</td>
							<td></td>
						</tr>
					</tfoot>
				</table>
			</div>
		</div>
	{/if}

	<!-- Crew -->
	<div class="mb-10">
		<div class="flex items-center justify-between mb-4 gap-4">
			<h2 class="font-semibold text-xl tracking-tight">Crew</h2>
			<span class="text-xs text-muted-foreground">{data.crew.length} member{data.crew.length === 1 ? '' : 's'}</span>
		</div>

		{#if data.canManage}
			<form method="POST" action="?/addMember" class="flex flex-col sm:flex-row gap-2 mb-4">
				<input
					type="email"
					name="email"
					placeholder="Add crew member by email"
					required
					class="flex-1 h-10 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				/>
				<button
					type="submit"
					class="h-10 px-4 rounded-xl border text-sm font-medium hover:bg-muted transition-colors shrink-0"
				>
					+ Add to crew
				</button>
			</form>
		{/if}

		<div class="rounded-2xl border bg-card divide-y">
			{#each data.crew as member}
				<div class="flex items-center justify-between px-5 py-4 gap-4">
					<div class="min-w-0">
						<div class="font-medium truncate">{member.name || member.email}</div>
						<div class="text-sm text-muted-foreground truncate">{member.email}</div>
					</div>
					<div class="flex items-center gap-3 shrink-0">
						{#if member.userId === data.project.userId}
							<span class="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">Owner</span>
						{/if}
						{#if data.canManage && member.userId !== data.project.userId}
							<form method="POST" action="?/removeMember">
								<input type="hidden" name="memberUserId" value={member.userId} />
								<button type="submit" class="text-xs text-red-600 hover:underline">Remove</button>
							</form>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Roles -->
	<div>
		<div class="flex items-center justify-between mb-4 gap-4">
			<h2 class="font-semibold text-xl tracking-tight">On-site roles</h2>

			{#if data.canManage}
				<form method="POST" action="?/addRole" class="flex items-center gap-2">
					<input
						type="text"
						name="name"
						placeholder="e.g. Foreman, Electrician"
						class="h-9 w-48 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						required
					/>
					<button
						type="submit"
						class="h-9 px-4 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
					>
						+ Add role
					</button>
				</form>
			{/if}
		</div>

		{#if data.roles.length === 0}
			<div class="rounded-2xl border bg-card p-8 text-center text-muted-foreground text-sm">
				No roles defined yet. Add trade roles so workers can clock in with their position.
			</div>
		{:else}
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each data.roles as r}
					{@const isOccupied = data.activeWorkers.some((w) => w.roleId === r.id)}
					<div class="rounded-2xl border bg-card p-5 flex flex-col">
						<div class="font-medium text-lg tracking-tight">{r.name}</div>
						<div class="text-xs text-muted-foreground mt-0.5 mb-4">
							{isOccupied ? 'Currently occupied' : 'Available'}
						</div>

						{#if data.canClockIn && !data.myActiveEntry}
							<form method="POST" action="?/takeOverRole" class="mt-auto">
								<input type="hidden" name="roleId" value={r.id} />
								<button
									type="submit"
									class="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
								>
									Clock in as {r.name}
								</button>
							</form>
						{:else if data.myActiveEntry}
							<div
								class="text-xs text-center text-muted-foreground mt-auto py-2 border rounded-lg bg-muted/50"
							>
								You're currently tracking
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	{#if form?.error}
		<div class="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
			{form.error}
		</div>
	{/if}
</div>
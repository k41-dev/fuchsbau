<script lang="ts">
	import ProjectCover from '$lib/components/ProjectCover.svelte';
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
		if (!form?.success) return;
		if (form.inviteCreated || form.memberAdded || form.inviteRevoked) return;
		window.location.reload();
	}

	async function copyInviteLink(url: string) {
		await navigator.clipboard.writeText(url);
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
	<ProjectCover
		projectId={data.project.id}
		hasBackgroundImage={data.project.hasBackgroundImage}
		overlay="hero"
		class="rounded-3xl border mb-6 min-h-[220px] flex flex-col justify-end"
	>
		<div class="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
			<div>
				<a
					href="/projects"
					class="text-sm hover:underline {data.project.hasBackgroundImage
						? 'text-white/80 hover:text-white'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					← All job sites
				</a>
				<h1 class="text-4xl font-semibold tracking-tighter mt-1">{data.project.name}</h1>
				{#if data.project.address}
					<p class="mt-1 {data.project.hasBackgroundImage ? 'text-white/85' : 'text-muted-foreground'}">
						{data.project.address}
					</p>
				{/if}
				{#if data.isOwner}
					<p
						class="text-xs mt-2 {data.project.hasBackgroundImage
							? 'text-white/70'
							: 'text-muted-foreground'}"
					>
						Site supervisor view
					</p>
				{/if}
			</div>

			{#if data.myActiveEntry}
				<div class="flex items-center gap-4 shrink-0">
					<div class="text-right">
						<div
							class="text-xs {data.project.hasBackgroundImage
								? 'text-white/75'
								: 'text-muted-foreground'}"
						>
							You are tracking
						</div>
						<div
							class="font-mono text-2xl font-semibold tracking-tighter {data.project.hasBackgroundImage
								? 'text-emerald-200'
								: 'text-emerald-600'}"
						>
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
	</ProjectCover>

	{#if data.canManage}
		<div class="rounded-2xl border bg-card p-5 mb-6">
			<h2 class="font-semibold text-sm mb-3">Cover photo</h2>
			{#if form?.backgroundUpdated}
				<div class="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 mb-3">
					Cover photo updated.
				</div>
			{:else if form?.backgroundRemoved}
				<div class="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 mb-3">
					Cover photo removed.
				</div>
			{:else if form?.error}
				<div class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 mb-3">
					{form.error}
				</div>
			{/if}
			<div class="flex flex-col sm:flex-row gap-3 items-start">
				<form method="POST" action="?/updateBackground" enctype="multipart/form-data" class="flex-1 w-full">
					<input
						type="file"
						name="background"
						accept="image/jpeg,image/png,image/webp"
						class="w-full rounded-xl border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
					/>
					<button type="submit" class="mt-3 h-10 px-4 rounded-xl border text-sm font-medium">
						Upload new photo
					</button>
				</form>
				{#if data.project.hasBackgroundImage}
					<form method="POST" action="?/removeBackground">
						<button type="submit" class="h-10 px-4 rounded-xl border text-sm font-medium text-red-600">
							Remove photo
						</button>
					</form>
				{/if}
			</div>
		</div>
	{/if}

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
							<form
								method="POST"
								action="?/forceClockOut"
								onsubmit={(e) => {
									if (
										!confirm(
											`Clock out ${stale.userName || stale.userEmail}? Their shift will end now.`
										)
									) {
										e.preventDefault();
									}
								}}
							>
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

	{#if data.canManage && data.pendingAbsenceRequests.length > 0}
		<div class="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 mb-8">
			<h2 class="font-semibold text-lg tracking-tight mb-1">Pending absence requests</h2>
			<p class="text-sm text-muted-foreground mb-4">
				Approve or reject before they count in reports and block clock-in.
			</p>
			<div class="space-y-3">
				{#each data.pendingAbsenceRequests as request}
					<div class="rounded-xl border bg-card px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
						<div class="min-w-0 flex-1">
							<div class="font-medium">{request.userName || request.userEmail}</div>
							<div class="text-sm text-muted-foreground mt-0.5">
								{request.type === 'vacation' ? 'Vacation' : 'Sick'}
								·
								{request.startDate === request.endDate
									? formatDateLabel(request.startDate)
									: `${formatDateLabel(request.startDate)} – ${formatDateLabel(request.endDate)}`}
								· {request.dayCount} day{request.dayCount === 1 ? '' : 's'}
							</div>
							{#if request.note}
								<div class="text-sm text-muted-foreground mt-1">{request.note}</div>
							{/if}
						</div>
						<div class="flex flex-col sm:flex-row gap-2 shrink-0">
							<form method="POST" action="?/approveAbsence">
								<input type="hidden" name="requestGroupId" value={request.requestGroupId} />
								<button
									type="submit"
									class="h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-medium w-full sm:w-auto"
								>
									Approve
								</button>
							</form>
							<form method="POST" action="?/rejectAbsence" class="flex gap-2 items-center">
								<input type="hidden" name="requestGroupId" value={request.requestGroupId} />
								<input
									type="text"
									name="reviewNote"
									placeholder="Optional note"
									class="h-10 rounded-xl border bg-background px-3 text-sm w-full sm:w-40"
								/>
								<button
									type="submit"
									class="h-10 px-4 rounded-xl border text-sm font-medium shrink-0"
								>
									Reject
								</button>
							</form>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if data.canManage && data.daySummary.absences.length > 0}
		<div class="rounded-2xl border bg-card p-5 mb-8">
			<h2 class="font-semibold text-lg tracking-tight mb-4">
				Approved away · {formatDateLabel(data.selectedDate)}
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
									<form
										method="POST"
										action="?/forceClockOut"
										onsubmit={(e) => {
											if (
												!confirm(
													`Clock out ${worker.userName || worker.userEmail}? Their shift will end now.`
												)
											) {
												e.preventDefault();
											}
										}}
									>
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
			{#if form?.inviteCreated && form.inviteUrl}
				<div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 mb-4 text-sm text-emerald-900">
					<p class="font-medium mb-2">
						{form.resentInvite ? 'Invite link for' : 'Invite created for'}
						{form.email}
					</p>
					<p class="mb-3 text-emerald-800">
						Share this link so they can register and join your crew automatically.
					</p>
					<div class="flex flex-col sm:flex-row gap-2">
						<input
							readonly
							value={form.inviteUrl}
							class="flex-1 h-10 rounded-xl border bg-white px-3 text-sm font-mono"
						/>
						<button
							type="button"
							onclick={() => copyInviteLink(form.inviteUrl!)}
							class="h-10 px-4 rounded-xl border bg-white text-sm font-medium shrink-0"
						>
							Copy link
						</button>
					</div>
				</div>
			{:else if form?.memberAdded}
				<div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 mb-4 text-sm text-emerald-900">
					{form.email} was added to the crew.
				</div>
			{:else if form?.error}
				<div class="rounded-2xl border border-red-200 bg-red-50 p-4 mb-4 text-sm text-red-600">
					{form.error}
				</div>
			{/if}

			<form method="POST" action="?/inviteMember" class="flex flex-col sm:flex-row gap-2 mb-4">
				<input
					type="email"
					name="email"
					placeholder="Invite worker by email"
					required
					class="flex-1 h-10 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				/>
				<button
					type="submit"
					class="h-10 px-4 rounded-xl border text-sm font-medium hover:bg-muted transition-colors shrink-0"
				>
					Invite to crew
				</button>
			</form>

			{#if data.pendingInvites.length > 0}
				<div class="rounded-2xl border bg-card p-4 mb-4">
					<h3 class="font-medium text-sm mb-3">Pending invites</h3>
					<div class="space-y-3">
						{#each data.pendingInvites as invite}
							<div class="flex flex-col sm:flex-row sm:items-center gap-3">
								<div class="min-w-0 flex-1">
									<div class="font-medium text-sm">{invite.email}</div>
									<div class="text-xs text-muted-foreground">
										Expires {new Date(invite.expiresAt).toLocaleDateString()}
									</div>
								</div>
								<div class="flex gap-2 shrink-0">
									<button
										type="button"
										onclick={() => copyInviteLink(`${window.location.origin}${invite.invitePath}`)}
										class="h-9 px-3 rounded-xl border text-xs font-medium"
									>
										Copy link
									</button>
									<form method="POST" action="?/revokeInvite">
										<input type="hidden" name="inviteId" value={invite.id} />
										<button type="submit" class="h-9 px-3 rounded-xl border text-xs font-medium">
											Revoke
										</button>
									</form>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
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
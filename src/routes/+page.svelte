<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { PageData } from './$types';
	import type { WorkerStatus } from '$lib/server/worker-status';
	import type { AbsenceType } from '$lib/absence';
	import { todayString } from '$lib/absence';
	import type { CachedProject, WorkerActionName } from '$lib/offline/types';
	import {
		buildOfflineStatus,
		getPendingCount,
		performWorkerAction,
		saveWorkerCache,
		syncPendingActions
	} from '$lib/offline/worker-offline';

	let { data }: { data: PageData } = $props();

	let projects = $state<CachedProject[]>([]);
	let status = $state<WorkerStatus | null>(null);
	let isOnline = $state(true);
	let pendingCount = $state(0);
	let isSyncing = $state(false);
	let syncNotice = $state<string | null>(null);
	let selectedProjectId = $state<number | null>(null);
	let selectedRoleId = $state<number | null>(null);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let absenceFlow = $state<'closed' | 'pick' | AbsenceType>('closed');
	let vacationStart = $state(todayString());
	let vacationEnd = $state(todayString());
	let absenceNote = $state('');
	let workDisplay = $state('00:00:00');
	let breakDisplay = $state('00:00:00');

	let timerInterval: ReturnType<typeof setInterval> | null = null;

	function formatSeconds(total: number) {
		const h = Math.floor(total / 3600);
		const m = Math.floor((total % 3600) / 60);
		const s = total % 60;
		return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	}

	function updateDisplays() {
		if (!status?.entry) {
			workDisplay = '00:00:00';
			breakDisplay = '00:00:00';
			return;
		}

		const start = new Date(status.entry.startTime).getTime();
		const gross = Math.floor((Date.now() - start) / 1000);
		const breakSecs =
			status.entry.breakSeconds +
			(status.openBreak
				? Math.floor((Date.now() - new Date(status.openBreak.startTime).getTime()) / 1000) -
					(status.state === 'on_break' ? 0 : 0)
				: 0);

		let currentBreak = status.entry.breakSeconds;
		if (status.openBreak) {
			currentBreak += Math.floor((Date.now() - new Date(status.openBreak.startTime).getTime()) / 1000);
		}

		workDisplay = formatSeconds(Math.max(0, gross - currentBreak));
		breakDisplay = status.openBreak
			? formatSeconds(Math.floor((Date.now() - new Date(status.openBreak.startTime).getTime()) / 1000))
			: formatSeconds(status.entry.breakSeconds);
	}

	async function refreshPendingCount() {
		pendingCount = await getPendingCount();
	}

	async function runSync() {
		if (!data.user || isSyncing) return;

		isSyncing = true;
		syncNotice = null;

		const result = await syncPendingActions();
		await refreshPendingCount();

		if (result.failed) {
			error = result.failed;
		} else if (result.status) {
			status = result.status;
			await saveWorkerCache({
				userId: data.user.id,
				projects,
				status: result.status,
				updatedAt: Date.now()
			});
			if (result.synced > 0) {
				syncNotice = `Synced ${result.synced} offline action${result.synced === 1 ? '' : 's'}`;
			}
		}

		isSyncing = false;
	}

	async function workerAction(action: WorkerActionName, extra: Record<string, unknown> = {}) {
		if (!data.user) return;

		isLoading = true;
		error = null;
		syncNotice = null;

		const result = await performWorkerAction({
			userId: data.user.id,
			action,
			payload: extra,
			projects,
			currentStatus: status
		});

		if (result.success) {
			status = result.status ?? status;
			await refreshPendingCount();

			if (result.queued) {
				syncNotice = 'Saved offline — will sync when you are back online';
			}

			if (action === 'clock-in') {
				if (selectedProjectId && selectedRoleId) {
					localStorage.setItem(
						`fuchsbau:lastRole:${selectedProjectId}`,
						String(selectedRoleId)
					);
				}
				selectedProjectId = null;
				selectedRoleId = null;
			}
			if (action === 'clock-out' || action === 'report-absence') {
				absenceFlow = 'closed';
				absenceNote = '';
				vacationStart = todayString();
				vacationEnd = todayString();
			}
		} else {
			error = result.error ?? 'Something went wrong';
		}

		isLoading = false;
	}

	function startTimer() {
		stopTimer();
		timerInterval = setInterval(updateDisplays, 1000);
		updateDisplays();
	}

	function stopTimer() {
		if (timerInterval) clearInterval(timerInterval);
		timerInterval = null;
	}

	const stateLabel = $derived(
		status?.state === 'working'
			? 'On site'
			: status?.state === 'on_break'
				? 'On break'
				: status?.state === 'absent'
					? status.absence?.type === 'vacation'
						? 'On vacation'
						: 'Sick today'
					: 'Off duty'
	);

	const selectedProject = $derived(
		projects.find((p) => p.id === selectedProjectId) ?? null
	);

	const canClockIn = $derived(
		!!selectedProjectId &&
			(!selectedProject?.roles.length || !!selectedRoleId)
	);

	function selectProject(projectId: number) {
		selectedProjectId = projectId;
		selectedRoleId = null;

		const project = projects.find((p) => p.id === projectId);
		if (!project?.roles.length) return;

		const saved = localStorage.getItem(`fuchsbau:lastRole:${projectId}`);
		if (saved) {
			const roleId = parseInt(saved, 10);
			if (project.roles.some((r) => r.id === roleId)) {
				selectedRoleId = roleId;
			}
		}
	}

	const stateColor = $derived(
		status?.state === 'working'
			? 'bg-emerald-100 text-emerald-800'
			: status?.state === 'on_break'
				? 'bg-amber-100 text-amber-800'
				: status?.state === 'absent'
					? status.absence?.type === 'vacation'
						? 'bg-violet-100 text-violet-800'
						: 'bg-blue-100 text-blue-800'
					: 'bg-muted text-muted-foreground'
	);

	function openAbsenceFlow(type: AbsenceType) {
		absenceFlow = type;
		if (type === 'vacation') {
			vacationStart = todayString();
			vacationEnd = todayString();
		}
	}

	function submitAbsence() {
		if (absenceFlow === 'sick') {
			workerAction('report-absence', { type: 'sick', note: absenceNote || undefined });
			return;
		}
		if (absenceFlow === 'vacation') {
			workerAction('report-absence', {
				type: 'vacation',
				startDate: vacationStart,
				endDate: vacationEnd,
				note: absenceNote || undefined
			});
		}
	}

	onMount(() => {
		isOnline = navigator.onLine;

		const handleOnline = () => {
			isOnline = true;
			void runSync();
		};
		const handleOffline = () => {
			isOnline = false;
		};

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		void (async () => {
			projects = data.projects.map((p) => ({
				id: p.id,
				name: p.name,
				address: p.address,
				roles: p.roles
			}));

			if (data.user) {
				if (!navigator.onLine) {
					const offlineStatus = await buildOfflineStatus(data.user.id, projects);
					status = offlineStatus ?? data.workerStatus;
				} else {
					status = data.workerStatus;
					await saveWorkerCache({
						userId: data.user.id,
						projects,
						status: data.workerStatus,
						updatedAt: Date.now()
					});
					await runSync();
				}

				await refreshPendingCount();
			} else {
				status = data.workerStatus;
			}

			if (projects.length === 1) {
				selectProject(projects[0].id);
			}

			if (status?.state === 'working' || status?.state === 'on_break') {
				startTimer();
			}
		})();

		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	});

	onDestroy(stopTimer);

	$effect(() => {
		if (status?.state === 'working' || status?.state === 'on_break') {
			startTimer();
		} else {
			stopTimer();
			updateDisplays();
		}
	});
</script>

<div class="worker-page min-h-[calc(100dvh-3.5rem)] flex flex-col">
	<div class="flex-1 px-4 pt-4 pb-32 max-w-lg mx-auto w-full">
		{#if !data.user}
			<div class="flex flex-col items-center justify-center min-h-[60dvh] text-center">
				<p class="text-muted-foreground mb-6 text-lg">Sign in to track your time on site.</p>
				<div class="flex flex-col gap-3 w-full max-w-xs">
					<a
						href="/login"
						class="h-14 rounded-2xl bg-primary text-primary-foreground text-lg font-semibold flex items-center justify-center"
					>
						Sign in
					</a>
					<a
						href="/register"
						class="h-14 rounded-2xl border text-lg font-medium flex items-center justify-center"
					>
						Create account
					</a>
				</div>
			</div>
		{:else if data.projects.length === 0}
			<div class="flex flex-col items-center justify-center min-h-[60dvh] text-center">
				<p class="text-muted-foreground mb-6">No job sites assigned yet.</p>
				<a
					href="/projects"
					class="h-14 px-8 rounded-2xl bg-primary text-primary-foreground text-lg font-semibold flex items-center justify-center"
				>
					View job sites
				</a>
			</div>
		{:else}
			{#if !isOnline}
				<div class="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
					You are offline. Time tracking still works — changes sync when you reconnect.
				</div>
			{:else if isSyncing}
				<div class="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
					Syncing offline changes...
				</div>
			{:else if pendingCount > 0}
				<div class="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
					{pendingCount} action{pendingCount === 1 ? '' : 's'} waiting to sync.
					<button type="button" onclick={() => runSync()} class="ml-2 font-medium underline">
						Sync now
					</button>
				</div>
			{:else if syncNotice}
				<div class="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
					{syncNotice}
				</div>
			{/if}

			<!-- Status header -->
			<div class="text-center mb-6">
				<span class="inline-block px-4 py-1.5 rounded-full text-sm font-semibold {stateColor}">
					{stateLabel}
				</span>
			</div>

			{#if error}
				<div class="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
					{error}
				</div>
			{/if}

			{#if status?.state === 'absent'}
				<div class="rounded-3xl border bg-card p-8 text-center shadow-sm mb-6">
					<div class="text-5xl mb-4">
						{status.absence?.type === 'vacation' ? '🏖️' : '🤒'}
					</div>
					<h2 class="text-xl font-semibold mb-2">
						{status.absence?.type === 'vacation'
							? 'You are on vacation today'
							: 'You reported sick today'}
					</h2>
					<p class="text-muted-foreground text-sm mb-6">
						{status.absence?.note ||
							(status.absence?.type === 'vacation'
								? 'Enjoy your time off. No time tracking needed.'
								: 'Get well soon. No time tracking needed.')}
					</p>
					<button
						onclick={() => workerAction('cancel-absence')}
						disabled={isLoading}
						class="h-14 w-full rounded-2xl border text-base font-medium hover:bg-muted transition-colors disabled:opacity-60"
					>
						{isLoading
							? 'Updating...'
							: status.absence?.type === 'vacation'
								? 'Cancel today — I am working'
								: "I'm feeling better — cancel"}
					</button>
				</div>
			{:else if status?.state === 'working' || status?.state === 'on_break'}
				<!-- Active shift -->
				<div class="rounded-3xl border bg-card p-6 shadow-sm mb-6">
					<div class="text-center mb-6">
						<div class="text-sm text-muted-foreground mb-1">
							{status.state === 'on_break' ? 'Break time' : 'Work time'}
						</div>
						<div
							class="font-mono text-6xl sm:text-7xl font-bold tracking-tighter mb-2 {status.state ===
							'on_break'
								? 'text-amber-600'
								: 'text-emerald-600'}"
						>
							{status.state === 'on_break' ? breakDisplay : workDisplay}
						</div>
						<div class="text-lg font-medium">{status.entry?.projectName}</div>
						{#if status.entry?.roleName}
							<div class="text-sm text-muted-foreground">{status.entry.roleName}</div>
						{/if}
					</div>

					<div class="grid grid-cols-2 gap-3 text-center text-sm">
						<div class="rounded-xl bg-muted/50 p-3">
							<div class="text-muted-foreground text-xs mb-1">Work</div>
							<div class="font-mono font-semibold">{workDisplay}</div>
						</div>
						<div class="rounded-xl bg-muted/50 p-3">
							<div class="text-muted-foreground text-xs mb-1">Breaks</div>
							<div class="font-mono font-semibold">{breakDisplay}</div>
						</div>
					</div>
				</div>
			{:else}
				<!-- Clock in: pick job site -->
				<div class="mb-4">
					<h2 class="text-lg font-semibold mb-3">Select job site</h2>
					<div class="grid grid-cols-1 gap-3">
						{#each projects as proj}
							<button
								type="button"
								onclick={() => selectProject(proj.id)}
								class="w-full text-left rounded-2xl border p-5 transition-all active:scale-[0.98] {selectedProjectId ===
								proj.id
									? 'border-primary bg-primary/5 ring-2 ring-primary'
									: 'bg-card hover:border-primary/30'}"
							>
								<div class="font-semibold text-lg">{proj.name}</div>
								{#if proj.address}
									<div class="text-sm text-muted-foreground mt-0.5">{proj.address}</div>
								{/if}
							</button>
						{/each}
					</div>
				</div>

				{#if selectedProject?.roles.length}
					<div class="mb-4">
						<h2 class="text-lg font-semibold mb-3">Your role</h2>
						<div class="flex flex-wrap gap-2">
							{#each selectedProject.roles as role}
								<button
									type="button"
									onclick={() => (selectedRoleId = role.id)}
									class="h-12 px-5 rounded-2xl border text-base font-medium transition-all active:scale-[0.98] {selectedRoleId ===
									role.id
										? 'border-primary bg-primary text-primary-foreground shadow-sm'
										: 'bg-card hover:border-primary/30'}"
								>
									{role.name}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				{#if absenceFlow === 'closed'}
					<button
						type="button"
						onclick={() => (absenceFlow = 'pick')}
						class="w-full text-center text-sm text-muted-foreground py-3 hover:text-foreground"
					>
						Can't work? Report sick or vacation
					</button>
				{:else if absenceFlow === 'pick'}
					<div class="rounded-2xl border bg-card p-5 mb-4">
						<p class="text-sm mb-4">What are you reporting?</p>
						<div class="grid grid-cols-2 gap-3">
							<button
								type="button"
								onclick={() => openAbsenceFlow('sick')}
								class="h-14 rounded-xl bg-blue-600 text-white font-medium"
							>
								Sick today
							</button>
							<button
								type="button"
								onclick={() => openAbsenceFlow('vacation')}
								class="h-14 rounded-xl bg-violet-600 text-white font-medium"
							>
								Vacation
							</button>
						</div>
						<button
							type="button"
							onclick={() => (absenceFlow = 'closed')}
							class="w-full mt-3 h-10 rounded-xl border text-sm font-medium"
						>
							Cancel
						</button>
					</div>
				{:else if absenceFlow === 'sick'}
					<div class="rounded-2xl border bg-card p-5 mb-4">
						<p class="text-sm mb-4">Report sick for today?</p>
						<input
							type="text"
							bind:value={absenceNote}
							placeholder="Optional note"
							class="w-full h-11 rounded-xl border bg-background px-3 text-sm mb-4"
						/>
						<div class="flex gap-3">
							<button
								onclick={submitAbsence}
								disabled={isLoading}
								class="flex-1 h-12 rounded-xl bg-blue-600 text-white font-medium disabled:opacity-60"
							>
								Report sick
							</button>
							<button
								onclick={() => (absenceFlow = 'pick')}
								class="flex-1 h-12 rounded-xl border font-medium"
							>
								Back
							</button>
						</div>
					</div>
				{:else if absenceFlow === 'vacation'}
					<div class="rounded-2xl border bg-card p-5 mb-4">
						<p class="text-sm mb-4">Book vacation (single or multiple days)</p>
						<div class="grid grid-cols-2 gap-3 mb-4">
							<label class="text-sm">
								<span class="text-muted-foreground block mb-1">From</span>
								<input
									type="date"
									bind:value={vacationStart}
									class="w-full h-11 rounded-xl border bg-background px-3 text-sm"
								/>
							</label>
							<label class="text-sm">
								<span class="text-muted-foreground block mb-1">To</span>
								<input
									type="date"
									bind:value={vacationEnd}
									min={vacationStart}
									class="w-full h-11 rounded-xl border bg-background px-3 text-sm"
								/>
							</label>
						</div>
						<input
							type="text"
							bind:value={absenceNote}
							placeholder="Optional note"
							class="w-full h-11 rounded-xl border bg-background px-3 text-sm mb-4"
						/>
						<div class="flex gap-3">
							<button
								onclick={submitAbsence}
								disabled={isLoading || !vacationStart || !vacationEnd}
								class="flex-1 h-12 rounded-xl bg-violet-600 text-white font-medium disabled:opacity-60"
							>
								Book vacation
							</button>
							<button
								onclick={() => (absenceFlow = 'pick')}
								class="flex-1 h-12 rounded-xl border font-medium"
							>
								Back
							</button>
						</div>
					</div>
				{/if}
			{/if}
		{/if}
	</div>

	<!-- Sticky bottom actions (mobile thumb zone) -->
	{#if data.user && data.projects.length > 0 && status?.state !== 'absent'}
		<div
			class="fixed bottom-0 inset-x-0 border-t bg-background/95 backdrop-blur-md px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
		>
			<div class="max-w-lg mx-auto flex flex-col gap-3">
				{#if status?.state === 'idle'}
					<button
						onclick={() =>
							workerAction('clock-in', {
								projectId: selectedProjectId,
								roleId: selectedRoleId ?? undefined
							})}
						disabled={isLoading || !canClockIn}
						class="h-16 w-full rounded-2xl bg-emerald-600 text-white text-xl font-bold active:bg-emerald-700 disabled:opacity-50 transition-colors shadow-lg"
					>
						{isLoading
							? 'Starting...'
							: selectedProject?.roles.length && !selectedRoleId
								? 'Select your role'
								: 'Clock In'}
					</button>
				{:else if status?.state === 'working'}
					<div class="grid grid-cols-2 gap-3">
						<button
							onclick={() => workerAction('start-break')}
							disabled={isLoading}
							class="h-16 rounded-2xl bg-amber-500 text-white text-lg font-bold active:bg-amber-600 disabled:opacity-50"
						>
							Start Break
						</button>
						<button
							onclick={() => workerAction('clock-out')}
							disabled={isLoading}
							class="h-16 rounded-2xl bg-red-600 text-white text-lg font-bold active:bg-red-700 disabled:opacity-50"
						>
							Clock Out
						</button>
					</div>
				{:else if status?.state === 'on_break'}
					<button
						onclick={() => workerAction('end-break')}
						disabled={isLoading}
						class="h-16 w-full rounded-2xl bg-emerald-600 text-white text-xl font-bold active:bg-emerald-700 disabled:opacity-50 shadow-lg"
					>
						{isLoading ? 'Resuming...' : 'End Break'}
					</button>
					<button
						onclick={() => workerAction('clock-out')}
						disabled={isLoading}
						class="h-12 w-full rounded-2xl border text-base font-medium text-red-600 disabled:opacity-50"
					>
						End shift (clock out)
					</button>
				{/if}
			</div>
		</div>
	{/if}
</div>
<script lang="ts">
	import { onMount } from 'svelte';
	import ProjectCover from '$lib/components/ProjectCover.svelte';
	import type { PageData } from './$types';
	import type { WorkerStatus } from '$lib/server/worker-status';
	import type { CachedProject, WorkerActionName } from '$lib/offline/types';
	import {
		getActiveProjectId,
		isClockedIn,
		needsProjectSwitch
	} from '$lib/worker-sites';
	import {
		buildOfflineStatus,
		performWorkerAction,
		saveWorkerCache,
		syncPendingActions
	} from '$lib/offline/worker-offline';

	let { data }: { data: PageData } = $props();

	let projects = $state<CachedProject[]>([]);
	let status = $state<WorkerStatus | null>(null);
	let selectedProjectId = $state<number | null>(null);
	let selectedRoleId = $state<number | null>(null);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let switchTarget = $state<CachedProject | null>(null);

	const activeProjectId = $derived(getActiveProjectId(status));

	const selectedProject = $derived(
		projects.find((p) => p.id === selectedProjectId) ?? null
	);

	const canSignIn = $derived(
		!!selectedProjectId &&
			(!selectedProject?.roles.length || !!selectedRoleId) &&
			!isClockedIn(status)
	);

	function selectProject(projectId: number) {
		const project = projects.find((p) => p.id === projectId);
		if (!project) return;

		if (needsProjectSwitch(status, projectId)) {
			switchTarget = project;
			selectedProjectId = projectId;
			selectedRoleId = null;
			error = null;
			return;
		}

		switchTarget = null;
		selectedProjectId = projectId;
		selectedRoleId = null;

		if (!project.roles.length) return;

		const saved = localStorage.getItem(`fuchsbau:lastRole:${projectId}`);
		if (saved) {
			const roleId = parseInt(saved, 10);
			if (project.roles.some((r) => r.id === roleId)) {
				selectedRoleId = roleId;
			}
		}
	}

	function cancelSwitch() {
		switchTarget = null;
		selectedProjectId = activeProjectId;
		selectedRoleId = null;
	}

	async function runAction(action: WorkerActionName, extra: Record<string, unknown> = {}) {
		if (!data.user) return;

		isLoading = true;
		error = null;

		const result = await performWorkerAction({
			userId: data.user.id,
			action,
			payload: extra,
			projects,
			currentStatus: status
		});

		if (result.success) {
			status = result.status ?? status;
			switchTarget = null;

			if ((action === 'clock-in' || action === 'switch-project') && selectedProjectId && selectedRoleId) {
				localStorage.setItem(
					`fuchsbau:lastRole:${selectedProjectId}`,
					String(selectedRoleId)
				);
			}
		} else {
			error = result.error ?? 'Something went wrong';
		}

		isLoading = false;
	}

	function signIn() {
		if (!selectedProjectId) return;
		runAction('clock-in', {
			projectId: selectedProjectId,
			roleId: selectedRoleId ?? undefined
		});
	}

	function confirmSwitch() {
		if (!switchTarget) return;
		runAction('switch-project', {
			projectId: switchTarget.id,
			roleId: selectedRoleId ?? undefined
		});
	}

	onMount(() => {
		void (async () => {
			projects = data.projects.map((p) => ({
				id: p.id,
				name: p.name,
				address: p.address,
				hasBackgroundImage: p.hasBackgroundImage,
				roles: p.roles
			}));

			if (!data.user) {
				status = data.workerStatus;
				return;
			}

			if (!navigator.onLine) {
				status = (await buildOfflineStatus(data.user.id, projects)) ?? data.workerStatus;
			} else {
				status = data.workerStatus;
				await saveWorkerCache({
					userId: data.user.id,
					projects,
					status: data.workerStatus,
					updatedAt: Date.now()
				});
				const sync = await syncPendingActions();
				if (sync.status) status = sync.status;
			}

			const activeId = getActiveProjectId(status);
			if (activeId) {
				selectedProjectId = activeId;
			} else if (projects.length === 1) {
				selectProject(projects[0].id);
			}
		})();
	});
</script>

<div class="min-h-[calc(100dvh-3.5rem)] px-4 pt-4 pb-32 max-w-lg mx-auto w-full">
	<div class="mb-6">
		<h1 class="text-2xl font-semibold tracking-tight">My job sites</h1>
		<p class="text-sm text-muted-foreground mt-1">
			All projects you are assigned to. Tap a site to clock in or switch.
		</p>
	</div>

	{#if !data.user}
		<p class="text-muted-foreground">Sign in to see your job sites.</p>
	{:else if projects.length === 0}
		<div class="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
			No job sites assigned yet. Ask your supervisor to add you to a crew.
		</div>
	{:else}
		{#if error}
			<div class="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
				{error}
			</div>
		{/if}

		<div class="grid grid-cols-1 gap-3 mb-6">
			{#each projects as proj}
				{@const isActive = activeProjectId === proj.id}
				<button
					type="button"
					onclick={() => selectProject(proj.id)}
					class="w-full text-left rounded-2xl border overflow-hidden transition-all active:scale-[0.98] {selectedProjectId ===
					proj.id
						? 'border-primary ring-2 ring-primary'
						: 'hover:border-primary/30'}"
				>
					<ProjectCover
						projectId={proj.id}
						hasBackgroundImage={proj.hasBackgroundImage}
						class="min-h-[120px] flex flex-col justify-end"
					>
						<div class="p-5 flex items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="font-semibold text-lg">{proj.name}</div>
								{#if proj.address}
									<div
										class="text-sm mt-0.5 {proj.hasBackgroundImage
											? 'text-white/80'
											: 'text-muted-foreground'}"
									>
										{proj.address}
									</div>
								{/if}
							</div>
							{#if isActive}
								<span
									class="shrink-0 text-xs px-2.5 py-1 rounded-full font-medium {proj.hasBackgroundImage
										? 'bg-emerald-400/90 text-emerald-950'
										: 'bg-emerald-100 text-emerald-800'}"
								>
									{status?.state === 'on_break' ? 'On break' : 'Clocked in'}
								</span>
							{:else if isClockedIn(status)}
								<span
									class="shrink-0 text-xs px-2.5 py-1 rounded-full {proj.hasBackgroundImage
										? 'bg-white/20 text-white'
										: 'bg-muted text-muted-foreground'}"
								>
									Switch
								</span>
							{:else}
								<span
									class="shrink-0 text-xs px-2.5 py-1 rounded-full {proj.hasBackgroundImage
										? 'bg-white/20 text-white'
										: 'bg-blue-50 text-blue-700'}"
								>
									Available
								</span>
							{/if}
						</div>
					</ProjectCover>
				</button>
			{/each}
		</div>

		{#if switchTarget && selectedProject}
			<div class="rounded-2xl border border-amber-200 bg-amber-50 p-5 mb-4">
				<h2 class="font-semibold text-amber-950 mb-2">Switch job site?</h2>
				<p class="text-sm text-amber-900 mb-4">
					You are clocked in at
					<strong>{status?.entry?.projectName ?? 'another site'}</strong>.
					Clocking in at <strong>{switchTarget.name}</strong> will end your current shift first.
				</p>

				{#if selectedProject.roles.length}
					<div class="mb-4">
						<p class="text-sm font-medium text-amber-950 mb-2">Your role at {switchTarget.name}</p>
						<div class="flex flex-wrap gap-2">
							{#each selectedProject.roles as role}
								<button
									type="button"
									onclick={() => (selectedRoleId = role.id)}
									class="h-10 px-4 rounded-xl border text-sm font-medium {selectedRoleId ===
									role.id
										? 'border-primary bg-primary text-primary-foreground'
										: 'bg-white'}"
								>
									{role.name}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<div class="flex flex-col gap-2">
					<button
						type="button"
						onclick={confirmSwitch}
						disabled={isLoading || (selectedProject.roles.length > 0 && !selectedRoleId)}
						class="h-12 rounded-xl bg-amber-600 text-white font-semibold disabled:opacity-50"
					>
						{isLoading ? 'Switching...' : 'Clock out & switch'}
					</button>
					<button
						type="button"
						onclick={cancelSwitch}
						disabled={isLoading}
						class="h-10 rounded-xl border bg-white text-sm font-medium"
					>
						Cancel
					</button>
				</div>
			</div>
		{:else if selectedProject && !isClockedIn(status)}
			{#if selectedProject.roles.length}
				<div class="mb-4">
					<h2 class="text-lg font-semibold mb-3">Your role</h2>
					<div class="flex flex-wrap gap-2">
						{#each selectedProject.roles as role}
							<button
								type="button"
								onclick={() => (selectedRoleId = role.id)}
								class="h-12 px-5 rounded-2xl border text-base font-medium {selectedRoleId ===
								role.id
									? 'border-primary bg-primary text-primary-foreground'
									: 'bg-card'}"
							>
								{role.name}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<button
				type="button"
				onclick={signIn}
				disabled={isLoading || !canSignIn}
				class="h-14 w-full rounded-2xl bg-emerald-600 text-white text-lg font-bold disabled:opacity-50"
			>
				{isLoading
					? 'Starting...'
					: selectedProject.roles.length && !selectedRoleId
						? 'Select your role'
						: `Clock in at ${selectedProject.name}`}
			</button>
		{/if}

		<a
			href="/"
			class="mt-6 block text-center text-sm text-muted-foreground hover:text-foreground"
		>
			← Back to time tracking
		</a>
	{/if}
</div>
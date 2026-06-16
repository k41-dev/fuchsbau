<script lang="ts">
	import ProjectCover from '$lib/components/ProjectCover.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let showCreateForm = $state(false);
	let backgroundPreview = $state<string | null>(null);

	function handleBackgroundSelect(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) {
			backgroundPreview = null;
			return;
		}
		backgroundPreview = URL.createObjectURL(file);
	}
</script>

<div class="max-w-5xl mx-auto px-6 py-10">
	<div class="flex items-end justify-between mb-8 gap-4">
		<div>
			<h1 class="text-4xl font-semibold tracking-tighter">Job sites</h1>
			<p class="text-muted-foreground mt-1">Manage job sites, crew, and on-site roles</p>
		</div>
		<button
			onclick={() => (showCreateForm = !showCreateForm)}
			class="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
		>
			{showCreateForm ? 'Cancel' : '+ New job site'}
		</button>
	</div>

	{#if showCreateForm}
		<form
			method="POST"
			action="?/createProject"
			enctype="multipart/form-data"
			class="rounded-2xl border bg-card p-6 shadow-sm mb-8 space-y-4"
		>
			<h2 class="font-semibold text-lg tracking-tight">Create a new job site</h2>

			{#if form?.error}
				<div class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
					{form.error}
				</div>
			{/if}

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div class="space-y-2 md:col-span-2">
					<label for="name" class="text-sm font-medium">Site name *</label>
					<input
						id="name"
						name="name"
						type="text"
						required
						placeholder="e.g. Riverside Office Build"
						class="w-full h-11 rounded-xl border bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>

				<div class="space-y-2 md:col-span-2">
					<label for="address" class="text-sm font-medium">Address</label>
					<input
						id="address"
						name="address"
						type="text"
						placeholder="Street, city"
						class="w-full h-11 rounded-xl border bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>

				<div class="space-y-2 md:col-span-2">
					<label for="description" class="text-sm font-medium">Description</label>
					<textarea
						id="description"
						name="description"
						rows="2"
						placeholder="Optional notes about this job site"
						class="w-full rounded-xl border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
					></textarea>
				</div>

				<div class="space-y-2 md:col-span-2">
					<label for="background" class="text-sm font-medium">Cover photo</label>
					<input
						id="background"
						name="background"
						type="file"
						accept="image/jpeg,image/png,image/webp"
						onchange={handleBackgroundSelect}
						class="w-full rounded-xl border bg-background px-4 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
					/>
					<p class="text-xs text-muted-foreground">Optional. JPG, PNG, or WebP up to 5 MB.</p>
					{#if backgroundPreview}
						<div class="rounded-2xl overflow-hidden border h-40">
							<img src={backgroundPreview} alt="Cover preview" class="h-full w-full object-cover" />
						</div>
					{/if}
				</div>
			</div>

			<button
				type="submit"
				class="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
			>
				Create job site
			</button>
		</form>
	{/if}

	{#if data.staleAlerts.length > 0}
		<div class="rounded-2xl border border-amber-200 bg-amber-50 p-5 mb-8">
			<h2 class="font-semibold text-amber-950 mb-2">Forgotten clock-outs</h2>
			<p class="text-sm text-amber-900 mb-4">
				These workers may still be running a shift. Open the site to clock them out.
			</p>
			<div class="space-y-2">
				{#each data.staleAlerts as alert}
					<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
						<div>
							<span class="font-medium text-amber-950">{alert.userName || alert.userEmail}</span>
							<span class="text-amber-800"> · {alert.projectName}</span>
							<span class="text-amber-700 block sm:inline sm:ml-2">{alert.staleReason}</span>
						</div>
						<a
							href="/projects/{alert.projectId}"
							class="font-medium text-amber-950 underline shrink-0"
						>
							Open site
						</a>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if data.projects.length === 0}
		<div class="rounded-2xl border bg-card p-12 text-center">
			<div
				class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted text-3xl"
			>
				📁
			</div>
			<p class="text-lg text-muted-foreground">No job sites yet.</p>
			<p class="text-sm text-muted-foreground mt-1">Create your first job site to get started.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each data.projects as proj}
				<a
					href="/projects/{proj.id}"
					class="group block rounded-2xl border shadow-sm transition-all hover:shadow-md hover:border-primary/30 overflow-hidden"
				>
					<ProjectCover
						projectId={proj.id}
						hasBackgroundImage={proj.hasBackgroundImage}
						class="min-h-[220px] flex flex-col justify-end"
					>
						<div class="p-6">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<div
										class="font-semibold text-xl tracking-tight truncate {proj.hasBackgroundImage
											? 'text-white'
											: 'group-hover:text-primary transition-colors'}"
									>
										{proj.name}
									</div>
									{#if proj.address}
										<p
											class="text-sm mt-1 truncate {proj.hasBackgroundImage
												? 'text-white/80'
												: 'text-muted-foreground'}"
										>
											{proj.address}
										</p>
									{/if}
									{#if proj.description}
										<p
											class="text-sm mt-2 line-clamp-2 {proj.hasBackgroundImage
												? 'text-white/75'
												: 'text-muted-foreground'}"
										>
											{proj.description}
										</p>
									{/if}
								</div>
								<div
									class="text-3xl shrink-0 {proj.hasBackgroundImage
										? 'text-white/80'
										: 'opacity-40 group-hover:opacity-70 transition'}"
								>
									→
								</div>
							</div>

							<div class="mt-8 flex items-center justify-between gap-2 text-xs">
								<div
									class="flex items-center gap-2 min-w-0 {proj.hasBackgroundImage
										? 'text-white/80'
										: 'text-muted-foreground'}"
								>
									<div
										class="h-2 w-2 rounded-full shrink-0"
										style="background-color: {proj.color ?? '#3b82f6'}"
									></div>
									<span class="truncate">
										{proj.userId === data.currentUserId
											? 'You manage this site'
											: 'Assigned crew member'}
									</span>
								</div>
								{#if proj.staleAlertCount > 0}
									<span
										class="shrink-0 px-2 py-0.5 rounded-full font-medium {proj.hasBackgroundImage
											? 'bg-amber-400/90 text-amber-950'
											: 'bg-amber-100 text-amber-900'}"
									>
										{proj.staleAlertCount} alert{proj.staleAlertCount === 1 ? '' : 's'}
									</span>
								{/if}
							</div>
						</div>
					</ProjectCover>
				</a>
			{/each}
		</div>
	{/if}

	<div class="mt-12 rounded-2xl border bg-card p-6 shadow-sm">
		<h2 class="font-semibold text-lg tracking-tight mb-1">Supervisor access</h2>
		<p class="text-sm text-muted-foreground mb-4">
			Grant another registered user permission to manage job sites and reports.
		</p>

		{#if form?.promoted}
			<div class="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 mb-4">
				Supervisor access granted.
			</div>
		{:else if form?.error}
			<div class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 mb-4">
				{form.error}
			</div>
		{/if}

		<form method="POST" action="?/promoteSupervisor" class="flex flex-col sm:flex-row gap-2">
			<input
				type="email"
				name="email"
				placeholder="user@example.com"
				required
				class="flex-1 h-10 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
			/>
			<button
				type="submit"
				class="h-10 px-4 rounded-xl border text-sm font-medium hover:bg-muted transition-colors shrink-0"
			>
				Make supervisor
			</button>
		</form>
	</div>
</div>
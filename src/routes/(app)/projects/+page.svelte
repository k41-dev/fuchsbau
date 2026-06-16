<script lang="ts">
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let showCreateForm = $state(false);
</script>

<div class="max-w-5xl mx-auto px-6 py-10">
	<div class="flex items-end justify-between mb-8 gap-4">
		<div>
			<h1 class="text-4xl font-semibold tracking-tighter">Job sites</h1>
			<p class="text-muted-foreground mt-1">Your assigned construction projects</p>
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
			</div>

			<button
				type="submit"
				class="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
			>
				Create job site
			</button>
		</form>
	{/if}

	{#if data.projects.length === 0}
		<div class="rounded-2xl border bg-card p-12 text-center">
			<div
				class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted text-3xl"
			>
				📁
			</div>
			<p class="text-lg text-muted-foreground">No job sites yet.</p>
			<p class="text-sm text-muted-foreground mt-1">
				Create your first job site or ask your site manager to add you to a crew.
			</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each data.projects as proj}
				<a
					href="/projects/{proj.id}"
					class="group block rounded-2xl border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/30"
				>
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<div
								class="font-semibold text-xl tracking-tight group-hover:text-primary transition-colors truncate"
							>
								{proj.name}
							</div>
							{#if proj.address}
								<p class="text-sm text-muted-foreground mt-1 truncate">{proj.address}</p>
							{/if}
							{#if proj.description}
								<p class="text-sm text-muted-foreground mt-2 line-clamp-2">
									{proj.description}
								</p>
							{/if}
						</div>
						<div class="text-3xl opacity-40 group-hover:opacity-70 transition shrink-0">→</div>
					</div>

					<div class="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
						<div
							class="h-2 w-2 rounded-full"
							style="background-color: {proj.color ?? '#3b82f6'}"
						></div>
						{proj.userId === data.currentUserId ? 'You manage this site' : 'Assigned crew member'}
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
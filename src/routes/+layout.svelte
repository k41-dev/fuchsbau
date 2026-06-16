<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import type { LayoutData } from './$types';
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';

	let { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props();

	const session = authClient.useSession();

	async function signOut() {
		await authClient.signOut();
		await goto('/login');
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<nav class="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
	<div class="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
		<a href="/" class="font-semibold tracking-tight hover:opacity-80 transition-opacity">
			Fuchsbau
		</a>

		<div class="flex items-center gap-2 sm:gap-3 text-sm">
			<a href="/projects" class="hidden sm:inline px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
				Projects
			</a>
			<a href="/reports" class="hidden sm:inline px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
				Reports
			</a>

			{#if data.user || $session.data?.user}
				<span class="text-muted-foreground hidden sm:inline">
					{data.user?.name ?? $session.data?.user.name ?? data.user?.email}
				</span>
				<button
					onclick={signOut}
					class="px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors"
				>
					Sign out
				</button>
			{:else}
				<a href="/login" class="px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors">
					Sign in
				</a>
			{/if}
		</div>
	</div>
</nav>

{@render children()}

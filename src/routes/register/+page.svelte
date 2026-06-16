<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let isLoading = $state(false);

	$effect(() => {
		if (data.invite?.email) {
			email = data.invite.email;
		}
	});

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		isLoading = true;
		error = null;

		const { error: signUpError } = await authClient.signUp.email({
			name,
			email,
			password,
			callbackURL: '/'
		});

		if (signUpError) {
			error = signUpError.message ?? 'Registration failed';
			isLoading = false;
			return;
		}

		await goto('/');
	}
</script>

<div class="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-12">
	<div class="w-full max-w-sm">
		<div class="mb-8 text-center">
			<h1 class="text-3xl font-semibold tracking-tight">Create account</h1>
			{#if data.isBootstrap}
				<p class="text-muted-foreground mt-1">Set up the first supervisor account for your team</p>
			{:else if data.invite}
				<p class="text-muted-foreground mt-1">
					You were invited to <strong>{data.invite.projectName}</strong>
				</p>
			{:else}
				<p class="text-muted-foreground mt-1">Worker accounts require an invite from a supervisor</p>
			{/if}
		</div>

		{#if !data.canRegister}
			<div class="rounded-2xl border bg-card p-6 shadow-sm text-center space-y-4">
				<p class="text-sm text-muted-foreground">
					Ask your supervisor to invite you by email. They will send a registration link for your
					job site.
				</p>
				<a href="/login" class="inline-block text-sm font-medium hover:underline">Back to sign in</a>
			</div>
		{:else}
			<form onsubmit={handleSubmit} class="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
				{#if error}
					<div class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
						{error}
					</div>
				{/if}

				<div class="space-y-2">
					<label for="name" class="text-sm font-medium">Name</label>
					<input
						id="name"
						bind:value={name}
						type="text"
						autocomplete="name"
						required
						class="w-full h-11 rounded-xl border bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>

				<div class="space-y-2">
					<label for="email" class="text-sm font-medium">Email</label>
					<input
						id="email"
						bind:value={email}
						type="email"
						autocomplete="email"
						required
						readonly={Boolean(data.invite)}
						class="w-full h-11 rounded-xl border bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring {data.invite
							? 'text-muted-foreground'
							: ''}"
					/>
				</div>

				<div class="space-y-2">
					<label for="password" class="text-sm font-medium">Password</label>
					<input
						id="password"
						bind:value={password}
						type="password"
						autocomplete="new-password"
						required
						minlength="8"
						class="w-full h-11 rounded-xl border bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>

				<button
					type="submit"
					disabled={isLoading}
					class="w-full h-11 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-70 transition-colors"
				>
					{isLoading ? 'Creating account...' : 'Create account'}
				</button>
			</form>
		{/if}

		<p class="text-center text-sm text-muted-foreground mt-6">
			Already have an account?
			<a href="/login" class="text-foreground font-medium hover:underline">Sign in</a>
		</p>
	</div>
</div>
<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let isLoading = $state(false);

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
			<p class="text-muted-foreground mt-1">Start tracking time with Fuchsbau</p>
		</div>

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
					class="w-full h-11 rounded-xl border bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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

		<p class="text-center text-sm text-muted-foreground mt-6">
			Already have an account?
			<a href="/login" class="text-foreground font-medium hover:underline">Sign in</a>
		</p>
	</div>
</div>
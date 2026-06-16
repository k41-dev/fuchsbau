<script lang="ts">
	import { getProjectImageUrl } from '$lib/project-image';

	let {
		projectId,
		hasBackgroundImage,
		class: className = '',
		overlay = 'card',
		children
	}: {
		projectId: number;
		hasBackgroundImage?: boolean;
		class?: string;
		overlay?: 'card' | 'hero';
		children?: import('svelte').Snippet;
	} = $props();

	const imageUrl = $derived(getProjectImageUrl(projectId, hasBackgroundImage));

	const overlayClass = $derived(
		overlay === 'hero'
			? 'bg-gradient-to-t from-black/75 via-black/45 to-black/20'
			: 'bg-gradient-to-t from-black/80 via-black/50 to-black/25'
	);
</script>

<div class={`relative overflow-hidden ${imageUrl ? '' : 'bg-card'} ${className}`}>
	{#if imageUrl}
		<img src={imageUrl} alt="" class="absolute inset-0 h-full w-full object-cover" />
		<div class={`absolute inset-0 ${overlayClass}`}></div>
	{/if}
	<div class={`relative z-10 ${imageUrl ? 'text-white' : ''}`}>
		{@render children?.()}
	</div>
</div>
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			includeAssets: ['pwa-icon.svg', 'robots.txt'],
			manifest: {
				name: 'Fuchsbau',
				short_name: 'Fuchsbau',
				description: 'Construction crew time tracking on site',
				theme_color: '#059669',
				background_color: '#ffffff',
				display: 'standalone',
				orientation: 'portrait',
				start_url: '/',
				scope: '/',
				icons: [
					{
						src: '/pwa-icon.svg',
						sizes: 'any',
						type: 'image/svg+xml',
						purpose: 'any maskable'
					}
				]
			},
			workbox: {
				navigateFallback: '/',
				navigateFallbackDenylist: [/^\/api\//, /^\/projects/, /^\/reports/, /^\/login/, /^\/register/]
			},
			devOptions: {
				enabled: true,
				suppressWarnings: true
			}
		}),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
			// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
			// See https://svelte.dev/docs/kit/adapters for more information about adapters.
			adapter: adapter()
		})
	]
});

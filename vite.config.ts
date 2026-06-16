import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		host: true,
		allowedHosts: true
	},
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
		sveltekit()
	]
});

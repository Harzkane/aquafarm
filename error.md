05:58:35.322 Running build in Washington, D.C., USA (East) – iad1
05:58:35.322 Build machine configuration: 2 cores, 8 GB
05:58:35.466 Cloning github.com/Harzkane/aquafarm (Branch: main, Commit: bf3e09b)
05:58:36.605 Cloning completed: 1.139s
05:58:37.431 Restored build cache from previous deployment (ieGLCL6dc5hD7R85JhnELveV5oRj)
05:58:38.410 Running "vercel build"
05:58:38.985 Vercel CLI 50.28.0
05:58:39.290 Installing dependencies...
05:58:40.568 
05:58:40.570 up to date in 1s
05:58:40.570 
05:58:40.571 156 packages are looking for funding
05:58:40.571   run `npm fund` for details
05:58:40.650 Detected Next.js version: 14.2.5
05:58:40.658 Running "npm run build"
05:58:40.766 
05:58:40.767 > aquafarm@0.1.0 build
05:58:40.767 > next build
05:58:40.767 
05:58:41.443   ▲ Next.js 14.2.5
05:58:41.444 
05:58:41.466    Creating an optimized production build ...
05:58:57.068  ✓ Compiled successfully
05:58:57.069    Linting and checking validity of types ...
05:59:10.457    Collecting page data ...
05:59:12.471    Generating static pages (0/42) ...
05:59:13.199    Generating static pages (10/42) 
05:59:13.488    Generating static pages (20/42) 
05:59:14.266    Generating static pages (31/42) 
05:59:14.591  ⨯ useSearchParams() should be wrapped in a suspense boundary at page "/plans". Read more: https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
05:59:14.595     at o (/vercel/path0/.next/server/chunks/4466.js:1:11134)
05:59:14.596     at s (/vercel/path0/.next/server/chunks/4466.js:1:22131)
05:59:14.596     at N (/vercel/path0/.next/server/app/plans/page.js:11:1563)
05:59:14.597     at nj (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:12:46251)
05:59:14.597     at nM (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:12:47571)
05:59:14.597     at nN (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:12:64546)
05:59:14.598     at nI (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:12:47010)
05:59:14.598     at nM (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:12:47717)
05:59:14.599     at nM (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:12:61546)
05:59:14.599     at nN (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:12:64546)
05:59:14.600 
05:59:14.600 Error occurred prerendering page "/plans". Read more: https://nextjs.org/docs/messages/prerender-error
05:59:14.600 
05:59:14.602 
05:59:14.602 > Export encountered errors on following paths:
05:59:14.602 	/plans/page: /plans
05:59:14.602  ✓ Generating static pages (42/42)
05:59:14.636 Error: Command "npm run build" exited with 1
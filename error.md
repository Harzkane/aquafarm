❯ clear
❯ npm run dev

> aquafarm@0.1.0 dev
> next dev

  ▲ Next.js 14.2.5
  - Local:        http://localhost:3000
  - Environments: .env.local

 ✓ Starting...
 ✓ Ready in 4.7s
 ✓ Compiled /middleware in 149ms (73 modules)
 ○ Compiling /api/auth/[...nextauth] ...
 ✓ Compiled /api/auth/[...nextauth] in 571ms (269 modules)
 GET /api/auth/session 200 in 1089ms
 ○ Compiling /settings/billing ...
 ✓ Compiled /settings/billing in 2.8s (901 modules)
 POST /api/auth/_log 200 in 2886ms
 ✓ Compiled in 358ms (336 modules)
 GET /settings/billing 200 in 3238ms
 ✓ Compiled /manifest.webmanifest in 248ms (596 modules)
 GET /manifest.webmanifest 200 in 311ms
 ✓ Compiled /api/billing/status in 118ms (622 modules)
 GET /api/auth/session 200 in 437ms
 GET /api/auth/session 200 in 424ms
 GET /api/billing/status 200 in 500ms
 GET /api/billing/status 200 in 533ms
 ✓ Compiled /api/billing/checkout in 204ms (624 modules)
 ⨯ app/api/billing/checkout/route.ts (81:20) @ body
 ⨯ ReferenceError: body is not defined
    at eval (webpack-internal:///(rsc)/./app/api/billing/checkout/route.ts:97:18)
    at (rsc)/./app/api/billing/checkout/route.ts (/Users/harz/Downloads/aquafarm/.next/server/app/api/billing/checkout/route.js:192:1)
    at __webpack_require__ (/Users/harz/Downloads/aquafarm/.next/server/webpack-runtime.js:33:43)
    at eval (webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fbilling%2Fcheckout%2Froute&page=%2Fapi%2Fbilling%2Fcheckout%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fbilling%2Fcheckout%2Froute.ts&appDir=%2FUsers%2Fharz%2FDownloads%2Faquafarm%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fharz%2FDownloads%2Faquafarm&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!:15:122)
    at (rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fbilling%2Fcheckout%2Froute&page=%2Fapi%2Fbilling%2Fcheckout%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fbilling%2Fcheckout%2Froute.ts&appDir=%2FUsers%2Fharz%2FDownloads%2Faquafarm%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fharz%2FDownloads%2Faquafarm&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D! (/Users/harz/Downloads/aquafarm/.next/server/app/api/billing/checkout/route.js:182:1)
    at __webpack_require__ (/Users/harz/Downloads/aquafarm/.next/server/webpack-runtime.js:33:43)
    at __webpack_exec__ (/Users/harz/Downloads/aquafarm/.next/server/app/api/billing/checkout/route.js:242:39)
    at /Users/harz/Downloads/aquafarm/.next/server/app/api/billing/checkout/route.js:243:470
    at __webpack_require__.X (/Users/harz/Downloads/aquafarm/.next/server/webpack-runtime.js:168:21)
    at /Users/harz/Downloads/aquafarm/.next/server/app/api/billing/checkout/route.js:243:47
    at Object.<anonymous> (/Users/harz/Downloads/aquafarm/.next/server/app/api/billing/checkout/route.js:246:3)
    at Module._compile (node:internal/modules/cjs/loader:1706:14)
    at Module._extensions..js (node:internal/modules/cjs/loader:1839:10)
    at Module.load (node:internal/modules/cjs/loader:1441:32)
    at Module._load (node:internal/modules/cjs/loader:1263:12)
    at TracingChannel.traceSync (node:diagnostics_channel:328:14)
    at wrapModuleLoad (node:internal/modules/cjs/loader:237:24)
    at Module.require (node:internal/modules/cjs/loader:1463:12)
    at mod.require (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/require-hook.js:65:28)
    at require (node:internal/modules/helpers:147:16)
    at requirePage (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/require.js:109:84)
    at /Users/harz/Downloads/aquafarm/node_modules/next/dist/server/load-components.js:98:84
    at async loadComponentsImpl (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/load-components.js:98:26)
    at async DevServer.findPageComponentsImpl (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/next-server.js:710:36)
    at async DevServer.findPageComponents (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/dev/next-dev-server.js:577:20)
    at async DevServer.renderPageComponent (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/base-server.js:1917:24)
    at async DevServer.renderToResponseImpl (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/base-server.js:1969:32)
    at async DevServer.pipeImpl (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/base-server.js:920:25)
    at async NextNodeServer.handleCatchallRenderRequest (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/next-server.js:272:17)
    at async DevServer.handleRequestImpl (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/base-server.js:816:17)
    at async /Users/harz/Downloads/aquafarm/node_modules/next/dist/server/dev/next-dev-server.js:339:20
    at async Span.traceAsyncFn (/Users/harz/Downloads/aquafarm/node_modules/next/dist/trace/trace.js:154:20)
    at async DevServer.handleRequest (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/dev/next-dev-server.js:336:24)
    at async invokeRender (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/lib/router-server.js:174:21)
    at async handleRequest (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/lib/router-server.js:353:24)
    at async requestHandlerImpl (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/lib/router-server.js:377:13)
    at async Server.requestListener (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/lib/start-server.js:141:13) {
  page: '/api/billing/checkout'
}
  79 |   });
  80 | }
> 81 |   const returnTo = body.returnTo === "billing" ? "billing" : "plans";
     |                    ^
  82 |
 ○ Compiling /_error ...
 ✓ Compiled /_error in 630ms (1170 modules)
 POST /api/billing/checkout 500 in 1196ms
 GET /settings/billing?_rsc=1kvxk 200 in 620ms
 GET /settings/billing?_rsc=1kvxk 200 in 16ms

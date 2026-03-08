❯ clear
❯ npm run dev

> aquafarm@0.1.0 dev
> next dev

  ▲ Next.js 14.2.5
  - Local:        http://localhost:3000
  - Environments: .env.local

 ✓ Starting...
 ✓ Ready in 4.4s
 ○ Compiling /api/auth/[...nextauth] ...
 ✓ Compiled /api/auth/[...nextauth] in 1345ms (269 modules)
 GET /api/auth/session 200 in 2577ms
 ○ Compiling /financials ...
 ✓ Compiled /financials in 9s (1909 modules)
 POST /api/auth/_log 200 in 7298ms
 ⚠ Unsupported metadata themeColor is configured in metadata export in /financials. Please move it to viewport export instead.
Read more: https://nextjs.org/docs/app/api-reference/functions/generate-viewport
 GET /financials 200 in 9754ms
 ⚠ Unsupported metadata themeColor is configured in metadata export in /financials. Please move it to viewport export instead.
Read more: https://nextjs.org/docs/app/api-reference/functions/generate-viewport
 GET /financials 200 in 135ms
 ○ Compiling /api/financials ...
 ✓ Compiled /api/batches in 2.1s (1928 modules)
 ⚠ Unsupported metadata themeColor is configured in metadata export in /manifest.json. Please move it to viewport export instead.
Read more: https://nextjs.org/docs/app/api-reference/functions/generate-viewport
 GET /api/auth/session 200 in 827ms
 GET /manifest.json 404 in 1337ms
 GET /api/financials 200 in 943ms
 GET /api/batches 200 in 946ms
 GET /api/batches 200 in 927ms
 GET /api/financials 200 in 948ms
 GET /api/auth/session 200 in 70ms
 ⚠ Unsupported metadata themeColor is configured in metadata export in /financials. Please move it to viewport export instead.
Read more: https://nextjs.org/docs/app/api-reference/functions/generate-viewport
 GET /financials?_rsc=s2nwy 200 in 96ms
 GET /api/auth/session 200 in 14ms
 GET /api/auth/session 200 in 15ms
 ⨯ Error: Financial validation failed: expenses.3.batchId: Cast to ObjectId failed for value "" (type string) at path "batchId" because of "BSONError"
    at ValidationError.inspect (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/error/validation.js:52:26)
    at formatValue (node:internal/util/inspect:897:19)
    at inspect (node:internal/util/inspect:409:10)
    at formatWithOptionsInternal (node:internal/util/inspect:2590:40)
    at formatWithOptions (node:internal/util/inspect:2452:10)
    at console.value (node:internal/console/constructor:345:14)
    at console.error (node:internal/console/constructor:412:61)
    at prefixedLog (/Users/harz/Downloads/aquafarm/node_modules/next/dist/build/output/log.js:80:31)
    at Object.error (/Users/harz/Downloads/aquafarm/node_modules/next/dist/build/output/log.js:90:5)
    at doRender (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/base-server.js:1412:30)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async cacheEntry.responseCache.get.routeKind (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/base-server.js:1599:28)
    at async DevServer.renderToResponseWithComponentsImpl (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/base-server.js:1507:28)
    at async DevServer.renderPageComponent (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/base-server.js:1931:24)
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
  errors: {
    'expenses.3.batchId': CastError: Cast to ObjectId failed for value "" (type string) at path "batchId" because of "BSONError"
        at SchemaObjectId.cast (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/schema/objectId.js:253:11)
        at SchemaType.applySetters (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/schemaType.js:1288:12)
        at EmbeddedDocument.$set (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/document.js:1456:22)
        at EmbeddedDocument.$set (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/document.js:1150:16)
        at EmbeddedDocument.Document (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/document.js:180:12)
        at EmbeddedDocument.Subdocument (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/types/subdocument.js:48:12)
        at EmbeddedDocument.ArraySubdocument [as constructor] (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/types/arraySubdocument.js:44:15)
        at new EmbeddedDocument (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/schema/documentArray.js:150:17)
        at Proxy._cast (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/types/documentArray/methods/index.js:109:17)
        at Proxy._mapCast (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/types/array/methods/index.js:301:17)
        at Arguments.map (<anonymous>)
        at Proxy.push (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/types/array/methods/index.js:735:21)
        at Proxy.push (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/types/documentArray/methods/index.js:221:35)
        at POST (webpack-internal:///(rsc)/./app/api/financials/route.ts:51:42)
        at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
        at async /Users/harz/Downloads/aquafarm/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:55038
        at async ek.execute (/Users/harz/Downloads/aquafarm/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:45808)
        at async ek.handle (/Users/harz/Downloads/aquafarm/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:56292)
        at async doRender (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/base-server.js:1377:42)
        at async cacheEntry.responseCache.get.routeKind (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/base-server.js:1599:28)
        at async DevServer.renderToResponseWithComponentsImpl (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/base-server.js:1507:28)
        at async DevServer.renderPageComponent (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/base-server.js:1931:24)
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
      stringValue: '""',
      messageFormat: undefined,
      kind: 'ObjectId',
      value: '',
      path: 'batchId',
      reason: BSONError: input must be a 24 character hex string, 12 byte Uint8Array, or an integer
          at new ObjectId (/Users/harz/Downloads/aquafarm/node_modules/bson/lib/bson.cjs:2538:23)
          at castObjectId (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/cast/objectid.js:25:12)
          at SchemaObjectId.cast (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/schema/objectId.js:251:12)
          at SchemaType.applySetters (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/schemaType.js:1288:12)
          at EmbeddedDocument.$set (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/document.js:1456:22)
          at EmbeddedDocument.$set (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/document.js:1150:16)
          at EmbeddedDocument.Document (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/document.js:180:12)
          at EmbeddedDocument.Subdocument (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/types/subdocument.js:48:12)
          at EmbeddedDocument.ArraySubdocument [as constructor] (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/types/arraySubdocument.js:44:15)
          at new EmbeddedDocument (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/schema/documentArray.js:150:17)
          at Proxy._cast (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/types/documentArray/methods/index.js:109:17)
          at Proxy._mapCast (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/types/array/methods/index.js:301:17)
          at Arguments.map (<anonymous>)
          at Proxy.push (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/types/array/methods/index.js:735:21)
          at Proxy.push (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/types/documentArray/methods/index.js:221:35)
          at POST (webpack-internal:///(rsc)/./app/api/financials/route.ts:51:42)
          at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
          at async /Users/harz/Downloads/aquafarm/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:55038
          at async ek.execute (/Users/harz/Downloads/aquafarm/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:45808)
          at async ek.handle (/Users/harz/Downloads/aquafarm/node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js:6:56292)
          at async doRender (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/base-server.js:1377:42)
          at async cacheEntry.responseCache.get.routeKind (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/base-server.js:1599:28)
          at async DevServer.renderToResponseWithComponentsImpl (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/base-server.js:1507:28)
          at async DevServer.renderPageComponent (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/base-server.js:1931:24)
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
          at async Server.requestListener (/Users/harz/Downloads/aquafarm/node_modules/next/dist/server/lib/start-server.js:141:13),
      valueType: 'string'
    }
  },
  _message: 'Financial validation failed'
}
 POST /api/financials 500 in 48ms

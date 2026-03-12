❯ clear
❯ npm run dev

> aquafarm@0.1.0 dev
> next dev

  ▲ Next.js 14.2.5
  - Local:        http://localhost:3000
  - Environments: .env.local

 ✓ Starting...
 ✓ Ready in 32.9s
 ✓ Compiled /middleware in 331ms (172 modules)
 ○ Compiling /api/auth/[...nextauth] ...
 ✓ Compiled /api/auth/[...nextauth] in 753ms (269 modules)
 GET /api/auth/session 200 in 1303ms
 ○ Compiling /settings/ops ...
 ✓ Compiled /settings/ops in 2.6s (919 modules)
 ✓ Compiled in 550ms (345 modules)
 GET /settings/ops 200 in 3153ms
 POST /api/auth/_log 200 in 30ms
 GET /api/auth/session 200 in 54ms
 GET /api/auth/session 200 in 57ms
 POST /api/auth/_log 200 in 13ms
 ○ Compiling /manifest.webmanifest ...
 ✓ Compiled /manifest.webmanifest in 1066ms (605 modules)
 GET /manifest.webmanifest 200 in 1292ms
 ○ Compiling /api/alerts ...
 ✓ Compiled /api/auth/[...nextauth] in 2.9s (306 modules)
 ✓ Compiled (311 modules)
 GET /api/auth/session 200 in 4217ms
 GET /api/auth/session 200 in 3094ms
 GET /api/alerts?limit=5&counts=1 200 in 3936ms
 GET /api/alerts?limit=5&counts=1 200 in 5630ms
 GET /api/ops/cron-runs?limit=120 200 in 3982ms
 GET /api/ops/cron-runs?limit=120 200 in 5137ms
 GET /api/auth/session 200 in 105ms
 ○ Compiling /api/ops/cron-health ...
 ✓ Compiled /api/ops/cron-health in 2s (313 modules)
 GET /api/ops/cron-health?hours=24 200 in 2975ms
 ○ Compiling /alerts ...
 ✓ Compiled /alerts in 9.4s (952 modules)
 ⨯ MongoBulkWriteError: Updating the path 'triggerCount' would create a conflict at 'triggerCount'
    at UnorderedBulkOperation.handleWriteError (/Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/bulk/common.js:804:19)
    at UnorderedBulkOperation.handleWriteError (/Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/bulk/unordered.js:17:22)
    at executeCommands (/Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/bulk/common.js:350:19)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async /Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/bulk/common.js:790:24
    at async MongoClient.withSession (/Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/mongo_client.js:477:20)
    at async UnorderedBulkOperation.execute (/Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/bulk/common.js:789:20)
    at async Collection.bulkWrite (/Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/collection.js:224:16)
    at async Function.bulkWrite (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/model.js:3512:20)
    at async syncAlertsForUser (webpack-internal:///(rsc)/./lib/alerts.ts:455:9)
    at async GET (webpack-internal:///(rsc)/./app/api/alerts/route.ts:39:24)
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
  errorLabelSet: Set(0) {},
  errorResponse: {
    message: "Updating the path 'triggerCount' would create a conflict at 'triggerCount'",
    code: 40,
    writeErrors: [ [WriteError] ]
  },
  code: 40,
  writeErrors: [ WriteError { err: [Object] } ],
  result: BulkWriteResult {
    insertedCount: 0,
    matchedCount: 0,
    modifiedCount: 0,
    deletedCount: 0,
    upsertedCount: 0,
    upsertedIds: {},
    insertedIds: {}
  }
}
 GET /api/alerts?limit=100&counts=1&refresh=1 500 in 528ms
 ⨯ MongoBulkWriteError: Updating the path 'triggerCount' would create a conflict at 'triggerCount'
    at UnorderedBulkOperation.handleWriteError (/Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/bulk/common.js:804:19)
    at UnorderedBulkOperation.handleWriteError (/Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/bulk/unordered.js:17:22)
    at executeCommands (/Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/bulk/common.js:350:19)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async /Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/bulk/common.js:790:24
    at async MongoClient.withSession (/Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/mongo_client.js:477:20)
    at async UnorderedBulkOperation.execute (/Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/bulk/common.js:789:20)
    at async Collection.bulkWrite (/Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/collection.js:224:16)
    at async Function.bulkWrite (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/model.js:3512:20)
    at async syncAlertsForUser (webpack-internal:///(rsc)/./lib/alerts.ts:455:9)
    at async GET (webpack-internal:///(rsc)/./app/api/alerts/route.ts:39:24)
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
  errorLabelSet: Set(0) {},
  errorResponse: {
    message: "Updating the path 'triggerCount' would create a conflict at 'triggerCount'",
    code: 40,
    writeErrors: [ [WriteError] ]
  },
  code: 40,
  writeErrors: [ WriteError { err: [Object] } ],
  result: BulkWriteResult {
    insertedCount: 0,
    matchedCount: 0,
    modifiedCount: 0,
    deletedCount: 0,
    upsertedCount: 0,
    upsertedIds: {},
    insertedIds: {}
  }
}
 GET /api/alerts?limit=100&counts=1&refresh=1 500 in 699ms

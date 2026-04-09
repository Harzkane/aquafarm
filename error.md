❯ clear
❯ npm run dev

> aquafarm@0.1.0 dev
> next dev

  ▲ Next.js 14.2.5
  - Local:        http://localhost:3000
  - Environments: .env.local

 ✓ Starting...
 ✓ Ready in 4.4s
 ✓ Compiled /middleware in 384ms (172 modules)
 ○ Compiling /api/auth/[...nextauth] ...
 ✓ Compiled /api/auth/[...nextauth] in 1498ms (269 modules)
 GET /api/auth/session 200 in 2038ms
 ○ Compiling /alerts ...
 ✓ Compiled /alerts in 7.6s (922 modules)
 POST /api/auth/_log 200 in 7037ms
 ✓ Compiled in 1012ms (346 modules)
 GET /alerts 200 in 8688ms
 ○ Compiling /manifest.webmanifest ...
 ✓ Compiled /api/alerts in 3.5s (607 modules)
 ✓ Compiled (653 modules)
 GET /manifest.webmanifest 200 in 4010ms
 GET /api/auth/session 200 in 3200ms
 GET /api/alerts?limit=5&counts=1 200 in 3467ms
 GET /api/alerts?limit=5&counts=1 200 in 3544ms
 ⨯ MongoBulkWriteError: Updating the path 'acknowledgedAt' would create a conflict at 'acknowledgedAt'
    at UnorderedBulkOperation.handleWriteError (/Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/bulk/common.js:804:19)
    at UnorderedBulkOperation.handleWriteError (/Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/bulk/unordered.js:17:22)
    at executeCommands (/Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/bulk/common.js:350:19)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async /Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/bulk/common.js:790:24
    at async MongoClient.withSession (/Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/mongo_client.js:477:20)
    at async UnorderedBulkOperation.execute (/Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/bulk/common.js:789:20)
    at async Collection.bulkWrite (/Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/collection.js:224:16)
    at async Function.bulkWrite (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/model.js:3512:20)
    at async syncAlertsForUser (webpack-internal:///(rsc)/./lib/alerts.ts:285:9)
    at async GET (webpack-internal:///(rsc)/./app/api/alerts/route.ts:41:24)
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
    message: "Updating the path 'acknowledgedAt' would create a conflict at 'acknowledgedAt'",
    code: 40,
    writeErrors: [ [WriteError] ]
  },
  code: 40,
  writeErrors: [ WriteError { err: [Object] } ],
  result: BulkWriteResult {
    insertedCount: 0,
    matchedCount: 1,
    modifiedCount: 1,
    deletedCount: 0,
    upsertedCount: 0,
    upsertedIds: {},
    insertedIds: {}
  }
}
 GET /api/alerts?limit=100&counts=1&refresh=1 500 in 3777ms
 GET /api/alerts?counts=1&limit=5 200 in 3786ms
 GET /api/auth/session 200 in 95ms
 ⨯ MongoBulkWriteError: Updating the path 'acknowledgedAt' would create a conflict at 'acknowledgedAt'
    at UnorderedBulkOperation.handleWriteError (/Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/bulk/common.js:804:19)
    at UnorderedBulkOperation.handleWriteError (/Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/bulk/unordered.js:17:22)
    at executeCommands (/Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/bulk/common.js:350:19)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async /Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/bulk/common.js:790:24
    at async MongoClient.withSession (/Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/mongo_client.js:477:20)
    at async UnorderedBulkOperation.execute (/Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/bulk/common.js:789:20)
    at async Collection.bulkWrite (/Users/harz/Downloads/aquafarm/node_modules/mongodb/lib/collection.js:224:16)
    at async Function.bulkWrite (/Users/harz/Downloads/aquafarm/node_modules/mongoose/lib/model.js:3512:20)
    at async syncAlertsForUser (webpack-internal:///(rsc)/./lib/alerts.ts:285:9)
    at async GET (webpack-internal:///(rsc)/./app/api/alerts/route.ts:41:24)
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
    message: "Updating the path 'acknowledgedAt' would create a conflict at 'acknowledgedAt'",
    code: 40,
    writeErrors: [ [WriteError] ]
  },
  code: 40,
  writeErrors: [ WriteError { err: [Object] } ],
  result: BulkWriteResult {
    insertedCount: 0,
    matchedCount: 1,
    modifiedCount: 1,
    deletedCount: 0,
    upsertedCount: 0,
    upsertedIds: {},
    insertedIds: {}
  }
}
 GET /api/alerts?limit=100&counts=1&refresh=1 500 in 435ms
 GET /api/alerts?counts=1&limit=5 200 in 440ms

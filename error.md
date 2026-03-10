05:50:50.301 Running build in Washington, D.C., USA (East) – iad1
05:50:50.301 Build machine configuration: 2 cores, 8 GB
05:50:50.451 Cloning github.com/Harzkane/aquafarm (Branch: main, Commit: 6a2565e)
05:50:50.755 Cloning completed: 304.000ms
05:50:52.131 Restored build cache from previous deployment (ieGLCL6dc5hD7R85JhnELveV5oRj)
05:50:53.365 Running "vercel build"
05:50:53.968 Vercel CLI 50.28.0
05:50:54.267 Installing dependencies...
05:50:56.327 
05:50:56.328 up to date in 2s
05:50:56.328 
05:50:56.329 156 packages are looking for funding
05:50:56.329   run `npm fund` for details
05:50:56.357 Detected Next.js version: 14.2.5
05:50:56.362 Running "npm run build"
05:50:56.458 
05:50:56.458 > aquafarm@0.1.0 build
05:50:56.459 > next build
05:50:56.459 
05:50:57.135   ▲ Next.js 14.2.5
05:50:57.136 
05:50:57.162    Creating an optimized production build ...
05:51:12.784  ✓ Compiled successfully
05:51:12.786    Linting and checking validity of types ...
05:51:26.094 Failed to compile.
05:51:26.094 
05:51:26.094 ./app/(dashboard)/calendar/page.tsx:206:69
05:51:26.094 Type error: This comparison appears to be unintentional because the types '"partial" | "active"' and '"harvested"' have no overlap.
05:51:26.094 
05:51:26.094 [0m [90m 204 |[39m         [36mconst[39m confirmation [33m=[39m eventsByKey[key][33m;[39m[0m
05:51:26.094 [0m [90m 205 |[39m         [36mconst[39m doneByEvent [33m=[39m milestone[33m.[39mkind [33m===[39m [32m"sort"[39m [33m&&[39m [33mBoolean[39m(confirmation)[33m;[39m[0m
05:51:26.095 [0m[31m[1m>[22m[39m[90m 206 |[39m         [36mconst[39m doneByHarvestStatus [33m=[39m milestone[33m.[39mkind [33m===[39m [32m"harvest"[39m [33m&&[39m batch[33m.[39mstatus [33m===[39m [32m"harvested"[39m[33m;[39m[0m
05:51:26.095 [0m [90m     |[39m                                                                     [31m[1m^[22m[39m[0m
05:51:26.095 [0m [90m 207 |[39m         [36mif[39m (doneByEvent [33m||[39m doneByHarvestStatus) [36mcontinue[39m[33m;[39m[0m
05:51:26.095 [0m [90m 208 |[39m[0m
05:51:26.095 [0m [90m 209 |[39m         [36mconst[39m dueDate [33m=[39m startOfDay(addWeeks(stockDate[33m,[39m milestone[33m.[39mweek))[33m;[39m[0m
05:51:26.159 Error: Command "npm run build" exited with 1
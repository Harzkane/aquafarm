17:27:31.916 Running build in Washington, D.C., USA (East) – iad1
17:27:31.917 Build machine configuration: 2 cores, 8 GB
17:27:32.205 Cloning github.com/Harzkane/aquafarm (Branch: main, Commit: 7f853d0)
17:27:32.839 Cloning completed: 633.000ms
17:27:33.399 Restored build cache from previous deployment (D18VZ2LVf9qs1oTAuENs4RT5hV94)
17:27:33.667 Running "vercel build"
17:27:34.571 Vercel CLI 50.37.1
17:27:34.794 Installing dependencies...
17:27:36.105 
17:27:36.106 up to date in 1s
17:27:36.107 
17:27:36.107 156 packages are looking for funding
17:27:36.107   run `npm fund` for details
17:27:36.136 Detected Next.js version: 14.2.5
17:27:36.141 Running "npm run build"
17:27:36.243 
17:27:36.243 > aquafarm@0.1.0 build
17:27:36.243 > next build
17:27:36.244 
17:27:36.913   ▲ Next.js 14.2.5
17:27:36.914 
17:27:36.936    Creating an optimized production build ...
17:27:46.574  ✓ Compiled successfully
17:27:46.575    Linting and checking validity of types ...
17:27:54.522 
17:27:54.523 ./app/(dashboard)/settings/audit/page.tsx
17:27:54.523 71:6  Warning: React Hook useEffect has missing dependencies: 'load' and 'loading'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
17:27:54.524 
17:27:54.524 ./app/(dashboard)/settings/ops/page.tsx
17:27:54.524 97:6  Warning: React Hook useEffect has missing dependencies: 'load' and 'loading'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
17:27:54.524 
17:27:54.524 info  - Need to disable some ESLint rules? Learn more here: https://nextjs.org/docs/basic-features/eslint#disabling-rules
17:28:02.174 Failed to compile.
17:28:02.174 
17:28:02.175 ./app/(dashboard)/dashboard/page.tsx:397:11
17:28:02.175 Type error: Type '{ totalFish: any; totalInitial: any; totalFeedToday: number; totalMortality30d: number; totalExpenses: any; totalRevenue: any; activeBatches: number; totalTanks: number; chartDataByRange: { ...; }; ... 9 more ...; plan: "free" | ... 1 more ... | "commercial"; }' is not assignable to type 'Props'.
17:28:02.175   Types of property 'chartDataByRange' are incompatible.
17:28:02.175     Type '{ [k: string]: { date: string; feed: number; mortality: number; }[]; }' is missing the following properties from type 'Record<DashboardTimeframe, ChartPoint[]>': 7, 14, 30, 90
17:28:02.175 
17:28:02.175 [0m [90m 395 |[39m   }[33m;[39m[0m
17:28:02.176 [0m [90m 396 |[39m[0m
17:28:02.176 [0m[31m[1m>[22m[39m[90m 397 |[39m   [36mreturn[39m [33m<[39m[33mDashboardClient[39m {[33m...[39mprops} [33m/[39m[33m>[39m[33m;[39m[0m
17:28:02.176 [0m [90m     |[39m           [31m[1m^[22m[39m[0m
17:28:02.176 [0m [90m 398 |[39m }[0m
17:28:02.176 [0m [90m 399 |[39m[0m
17:28:02.239 Error: Command "npm run build" exited with 1
export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-8 w-56 bg-slate-200 rounded-lg" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-slate-100 rounded-xl p-5 space-y-3">
            <div className="flex justify-between">
              <div className="h-4 w-24 bg-slate-200 rounded" />
              <div className="h-6 w-6 bg-slate-200 rounded-full" />
            </div>
            <div className="h-8 w-32 bg-slate-200 rounded" />
            <div className="h-3 w-20 bg-slate-200 rounded" />
          </div>
        ))}
      </div>

      <div className="bg-slate-100 rounded-xl h-64" />

      <div className="bg-slate-100 rounded-xl h-48" />
    </div>
  );
}

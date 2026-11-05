// Skeleton shown while an app section loads.
export default function AppLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading</span>
      <div aria-hidden>
        <div className="skeleton h-9 w-56 sm:h-10 sm:w-72" />
        <div className="skeleton mt-3 h-4 w-80 max-w-full" />

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>

        <div className="skeleton mt-10 h-7 w-44" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="card p-4">
              <div className="skeleton aspect-[3/2] w-full" />
              <div className="skeleton mt-4 h-4 w-3/4" />
              <div className="skeleton mt-2 h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

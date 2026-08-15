export function Spinner() {
  return (
    <span
      role="status"
      className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent"
    >
      <span className="sr-only">Loading</span>
    </span>
  );
}

// The "not yet known" state of a route guard. It fills the viewport so nothing else paints
// first — which is exactly what stops the login page appearing for a signed-in user.
export function FullPageLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg">
      <Spinner />
    </div>
  );
}

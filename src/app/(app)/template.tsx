// Templates re-mount on every navigation, so each section switch gets a
// short fade-and-rise. The animation is disabled under reduced motion.
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}

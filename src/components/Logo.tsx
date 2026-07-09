export function MeshWord({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-mesh bg-gradient-to-r from-[#00ffa3] to-[#00ffd1] bg-clip-text text-transparent ${className}`}
    >
      Mesh
    </span>
  );
}

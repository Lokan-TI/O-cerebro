import DepartmentMenu from "@/components/nav/DepartmentMenu";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <DepartmentMenu />
      {children}
    </div>
  );
}
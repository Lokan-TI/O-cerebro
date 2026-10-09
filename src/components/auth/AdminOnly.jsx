import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { isAdmin } from "@/lib/access";

export default function AdminOnly({ children }) {
  const { user } = useAuth();
  if (!isAdmin(user)) return <Navigate to="/ErpCrmDashboard?tab=executiva" replace />;
  return children;
}
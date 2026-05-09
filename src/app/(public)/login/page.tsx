import LoginShell from "@/components/auth/LoginShell";

/** Default entry: student portal (backward compatible). Switch to alumni via in-page tabs. */
export default function LoginPage() {
  return <LoginShell mode="student" />;
}

import { AntdRegistry } from "@ant-design/nextjs-registry";
import { getRole } from "@/lib/role";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Wagamori" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const role = await getRole();

  if (!role) {
    return (
      <div style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>管理者専用 / Admins only</h1>
          <p style={{ color: "#9b7a80" }}>
            権限がありません。管理者アカウントでログインしてください。
            <br />
            You don&apos;t have access. Sign in with an admin account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AntdRegistry>
      <div style={{ background: "#fff", minHeight: "100vh" }}>{children}</div>
    </AntdRegistry>
  );
}

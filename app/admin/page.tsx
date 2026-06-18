import Link from "next/link";

export default function AdminHome() {
  const cards = [
    { href: "/admin/orders", title: "注文管理", desc: "注文一覧・フィルタ/並び替え/検索・ステータスと追跡番号の更新" },
    { href: "/admin/designs", title: "デザイン管理", desc: "設計の版履歴・CS手動稿のアップ・採用版の指定" },
    { href: "/admin/showcase", title: "実物投稿（買家秀）", desc: "お客様の実物投稿の確認・非表示/削除" },
    { href: "/admin/blog", title: "ブログ管理", desc: "記事 zip のアップロード・公開/下書き・削除（再デプロイ不要）" },
  ];
  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Wagamori 管理</h1>
      <p style={{ color: "#9b7a80", marginBottom: 24 }}>注文とデザインの管理</p>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            style={{
              display: "block",
              padding: 20,
              border: "1px solid #f1ddd9",
              borderRadius: 16,
              background: "#fff",
              textDecoration: "none",
              color: "#4a2530",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 600 }}>{c.title}</div>
            <div style={{ marginTop: 6, fontSize: 13, color: "#9b7a80" }}>{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

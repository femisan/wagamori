"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ProTable, type ProColumns } from "@ant-design/pro-components";
import { Tag, Button, Upload, message, Space, Popconfirm } from "antd";

interface Row {
  slug: string;
  title: string;
  status: string;
  date: string | null;
  coverUrl: string | null;
  updatedAt: string;
}

export default function AdminBlogPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await fetch("/api/admin/blog").then((r) => r.json());
      if (j.ok) setRows(j.data);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch list on mount
    load();
  }, [load]);

  const uploadZip = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/blog/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (j.ok) {
        message.success(`公開しました：${j.title}（${j.status}）`);
        load();
      } else {
        message.error(`アップ失敗：${j.error}`);
      }
    } catch {
      message.error("アップに失敗しました");
    } finally {
      setUploading(false);
    }
  };

  const act = async (slug: string, action: "publish" | "draft" | "delete") => {
    const res = await fetch("/api/admin/blog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, slug }),
    });
    if (res.ok) {
      message.success("更新しました");
      load();
    } else {
      message.error("操作に失敗しました");
    }
  };

  const columns: ProColumns<Row>[] = [
    {
      title: "記事",
      dataIndex: "title",
      render: (_, r) => (
        <div>
          <a href={`/blog/${r.slug}`} target="_blank" rel="noreferrer">
            {r.title}
          </a>
          <div style={{ fontSize: 11, color: "#999" }}>
            /{r.slug} · {r.date || "—"}
          </div>
        </div>
      ),
    },
    {
      title: "状態",
      dataIndex: "status",
      width: 100,
      render: (_, r) => (r.status === "published" ? <Tag color="green">公開</Tag> : <Tag>下書き</Tag>),
    },
    {
      title: "操作",
      width: 220,
      key: "op",
      render: (_, r) => (
        <Space>
          {r.status === "published" ? (
            <a onClick={() => act(r.slug, "draft")}>下書きに</a>
          ) : (
            <a onClick={() => act(r.slug, "publish")}>公開</a>
          )}
          <Popconfirm title="削除しますか？" onConfirm={() => act(r.slug, "delete")} okText="削除" cancelText="やめる">
            <a style={{ color: "#c0392b" }}>削除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>ブログ管理</h1>
      <p style={{ color: "#9b7a80", marginBottom: 16, fontSize: 13 }}>
        記事の zip をアップすると、再デプロイなしで即公開されます。
      </p>

      <Upload
        accept=".zip"
        showUploadList={false}
        beforeUpload={(f) => {
          uploadZip(f as File);
          return false;
        }}
      >
        <Button type="primary" loading={uploading}>
          記事 zip をアップロード
        </Button>
      </Upload>

      <div
        style={{ marginTop: 12, marginBottom: 20, fontSize: 12, color: "#9b7a80", background: "#fff7f8", padding: 12, borderRadius: 10, lineHeight: 1.7 }}
      >
        <strong>zip の中身：</strong>
        <br />・ <code>index.md</code>（先頭にタイトル等のフロントマター）または <code>index.html</code> + <code>meta.json</code>
        <br />・ <code>cover.jpg</code>（任意・カバー画像）
        <br />・ <code>images/◯◯.jpg</code>（任意・本文中で参照する画像）
        <br />画像は自動で Blob にアップされ、本文のパスが置き換わります。
      </div>

      <ProTable<Row>
        rowKey="slug"
        loading={loading}
        dataSource={rows}
        columns={columns}
        search={false}
        options={{ reload: () => load(), setting: false, density: false }}
        pagination={{ pageSize: 20 }}
      />
    </div>
  );
}

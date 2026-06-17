"use client";

import { useEffect, useState, useCallback } from "react";
import { ProTable, type ProColumns } from "@ant-design/pro-components";
import { Tag, Image, Drawer, Button, Upload, message, Space } from "antd";

interface DesignRow {
  id: string;
  userId: string;
  status: string;
  thumb: string | null;
  count: number;
  updatedAt: string;
}
interface Version {
  id: string;
  round: number;
  source: string;
  instruction: string | null;
  imageUrl: string;
  selected: boolean;
}

const SOURCE_LABEL: Record<string, string> = { ai: "AI", edit: "編集", cs: "CS手動稿", customer: "お客様" };

export default function AdminDesignsPage() {
  const [rows, setRows] = useState<DesignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<DesignRow | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [vLoading, setVLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await fetch("/api/admin/designs").then((r) => r.json());
      if (j.ok) setRows(j.data);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch list on mount
    load();
  }, [load]);

  const loadVersions = useCallback(async (id: string) => {
    setVLoading(true);
    try {
      const j = await fetch(`/api/admin/designs?id=${encodeURIComponent(id)}`).then((r) => r.json());
      if (j.ok) setVersions(j.versions);
    } finally {
      setVLoading(false);
    }
  }, []);

  const openDrawer = (r: DesignRow) => {
    setOpen(r);
    setVersions([]);
    loadVersions(r.id);
  };

  const select = async (versionId: string) => {
    if (!open) return;
    const res = await fetch("/api/admin/designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "select", designId: open.id, versionId }),
    });
    if (res.ok) {
      message.success("採用版を更新しました");
      loadVersions(open.id);
      load();
    }
  };

  const uploadCs = async (file: File) => {
    if (!open) return;
    const dataUrl: string = await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.readAsDataURL(file);
    });
    const res = await fetch("/api/admin/designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upload", designId: open.id, dataUrl }),
    });
    if (res.ok) {
      message.success("CS手動稿をアップしました");
      loadVersions(open.id);
      load();
    } else {
      message.error("アップに失敗しました");
    }
  };

  const columns: ProColumns<DesignRow>[] = [
    {
      title: "プレビュー",
      dataIndex: "thumb",
      width: 70,
      render: (_, r) =>
        r.thumb ? <Image src={r.thumb} alt="プレビュー" width={48} height={48} style={{ objectFit: "cover", borderRadius: 8 }} /> : "—",
    },
    {
      title: "設計",
      dataIndex: "id",
      width: 230,
      render: (_, r) => (
        <div style={{ whiteSpace: "nowrap" }}>
          <div style={{ fontFamily: "monospace", fontSize: 12 }}>{r.id.slice(0, 8)}…</div>
          <div style={{ fontSize: 11, color: "#999" }}>user {r.userId.slice(-6)}</div>
          <div style={{ fontSize: 11, color: "#999" }}>{new Date(r.updatedAt).toLocaleString("ja-JP")}</div>
        </div>
      ),
    },
    { title: "状態", dataIndex: "status", width: 100, render: (_, r) => <Tag>{r.status}</Tag> },
    { title: "版数", dataIndex: "count", width: 70, sorter: (a, b) => a.count - b.count },
    { title: "操作", width: 80, key: "op", render: (_, r) => <a onClick={() => openDrawer(r)}>詳細</a> },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>デザイン管理</h1>
      <ProTable<DesignRow>
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={columns}
        search={false}
        scroll={{ x: 620 }}
        options={{ reload: () => load(), setting: true, density: true }}
        pagination={{ pageSize: 20 }}
      />

      <Drawer
        title="調整履歴 / 版管理"
        open={!!open}
        onClose={() => setOpen(null)}
        width={Math.min(520, typeof window !== "undefined" ? window.innerWidth : 520)}
      >
        <Upload accept="image/*" showUploadList={false} beforeUpload={(f) => (uploadCs(f), false)}>
          <Button type="primary">CS手動稿をアップ</Button>
        </Upload>
        <div style={{ marginTop: 16 }}>
          {vLoading ? (
            <p>読み込み中…</p>
          ) : (
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              {versions.map((v) => (
                <div key={v.id} style={{ display: "flex", gap: 12, borderTop: "1px solid #f1ddd9", paddingTop: 12 }}>
                  <Image src={v.imageUrl} alt={`版 ${v.round}`} width={84} height={84} style={{ objectFit: "cover", borderRadius: 10 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "#999" }}>
                      #{v.round} · <Tag>{SOURCE_LABEL[v.source] ?? v.source}</Tag>
                    </div>
                    {v.instruction && <div style={{ fontSize: 13, marginTop: 4 }}>“{v.instruction}”</div>}
                    <div style={{ marginTop: 8 }}>
                      {v.selected ? (
                        <Tag color="gold">✓ 採用中</Tag>
                      ) : (
                        <Button size="small" onClick={() => select(v.id)}>
                          この版を採用
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {versions.length === 0 && <p style={{ color: "#999" }}>版がありません。</p>}
            </Space>
          )}
        </div>
      </Drawer>
    </div>
  );
}

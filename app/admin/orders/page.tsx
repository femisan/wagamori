"use client";

import { useEffect, useState, useCallback } from "react";
import { ProTable, type ProColumns } from "@ant-design/pro-components";
import { Tag, Image, Modal, Select, Input, Button, message, Space } from "antd";

interface Row {
  id: string;
  created: number;
  email: string;
  amount: number;
  paid: boolean;
  status: string;
  tracking: string;
  approval: string;
  artwork: string;
  original: string;
  proof: string;
  spec: string;
  notes: string;
  address: string;
  addressCopy: string;
  phone: string;
}

const STATUS_LABEL: Record<string, string> = {
  received: "受付",
  proof: "デザイン確認",
  crafting: "制作中",
  shipped: "発送済み",
};
const STATUS_OPTS = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }));

export default function AdminOrdersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [kw, setKw] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [editStatus, setEditStatus] = useState("received");
  const [editTracking, setEditTracking] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await fetch("/api/admin/orders").then((r) => r.json());
      if (j.ok) setRows(j.data);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch list on mount
    load();
  }, [load]);

  const openEdit = (r: Row) => {
    setEditing(r);
    setEditStatus(r.status || "received");
    setEditTracking(r.tracking || "");
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: editing.id, fulfillment: editStatus, tracking: editTracking }),
      });
      if (res.ok) {
        message.success("更新しました");
        setEditing(null);
        load();
      } else {
        message.error("更新に失敗しました");
      }
    } finally {
      setSaving(false);
    }
  };

  const copyAddress = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success("住所をコピーしました");
    } catch {
      message.error("コピーに失敗しました");
    }
  };

  const filtered = kw
    ? rows.filter((r) => `${r.email} ${r.id} ${r.spec} ${r.address} ${r.phone}`.toLowerCase().includes(kw.toLowerCase()))
    : rows;

  const columns: ProColumns<Row>[] = [
    {
      title: "作品",
      dataIndex: "artwork",
      width: 64,
      search: false,
      render: (_, r) =>
        r.artwork ? <Image src={r.artwork} alt="作品" width={48} height={48} style={{ objectFit: "cover", borderRadius: 8 }} /> : "—",
    },
    {
      title: "注文",
      dataIndex: "email",
      width: 230,
      render: (_, r) => (
        <div style={{ whiteSpace: "nowrap" }}>
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 210 }}>{r.email || "—"}</div>
          <div style={{ fontSize: 11, color: "#999", fontFamily: "monospace" }}>{r.id.slice(0, 16)}…</div>
          <div style={{ fontSize: 11, color: "#999" }}>{new Date(r.created).toLocaleString("ja-JP")}</div>
        </div>
      ),
    },
    { title: "仕様", dataIndex: "spec", width: 200, ellipsis: true },
    {
      title: "お届け先",
      dataIndex: "address",
      width: 260,
      render: (_, r) => (
        <div style={{ whiteSpace: "normal", fontSize: 12 }}>
          <div>{r.address || "—"}</div>
          {r.phone && <div style={{ color: "#666", marginTop: 2 }}>TEL: {r.phone}</div>}
          {r.addressCopy && (
            <a
              onClick={() => copyAddress(r.addressCopy)}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 12 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="9" y="9" width="11" height="11" rx="2" />
                <path d="M5 15V5a2 2 0 0 1 2-2h10" strokeLinecap="round" />
              </svg>
              住所をコピー
            </a>
          )}
        </div>
      ),
    },
    {
      title: "金額",
      dataIndex: "amount",
      width: 100,
      sorter: (a, b) => a.amount - b.amount,
      render: (_, r) => "¥" + r.amount.toLocaleString("ja-JP"),
    },
    {
      title: "支払",
      dataIndex: "paid",
      width: 80,
      filters: [
        { text: "支払済", value: true },
        { text: "未", value: false },
      ],
      onFilter: (v, r) => r.paid === v,
      render: (_, r) => (r.paid ? <Tag color="green">支払済</Tag> : <Tag>未</Tag>),
    },
    {
      title: "状態",
      dataIndex: "status",
      width: 110,
      filters: STATUS_OPTS.map((o) => ({ text: o.label, value: o.value })),
      onFilter: (v, r) => r.status === v,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Tag color="gold">{STATUS_LABEL[r.status] ?? r.status}</Tag>
          {r.tracking && <span style={{ fontSize: 11, color: "#999" }}>{r.tracking}</span>}
        </Space>
      ),
    },
    {
      title: "操作",
      width: 90,
      key: "op",
      render: (_, r) => (
        <a onClick={() => openEdit(r)}>編集</a>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>注文管理</h1>
      <ProTable<Row>
        rowKey="id"
        loading={loading}
        dataSource={filtered}
        columns={columns}
        search={false}
        scroll={{ x: 1040 }}
        options={{ reload: () => load(), setting: true, density: true }}
        headerTitle={
          <Input.Search
            placeholder="メール / ID / 仕様 / 住所で検索"
            allowClear
            style={{ width: 320 }}
            onChange={(e) => setKw(e.target.value)}
          />
        }
        pagination={{ pageSize: 20, showSizeChanger: true }}
      />

      <Modal
        title="注文を更新"
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={save}
        confirmLoading={saving}
        okText="更新"
        cancelText="キャンセル"
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <div>
            <div style={{ fontSize: 12, color: "#999" }}>制作ステータス</div>
            <Select value={editStatus} onChange={setEditStatus} options={STATUS_OPTS} style={{ width: "100%" }} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#999" }}>追跡番号</div>
            <Input value={editTracking} onChange={(e) => setEditTracking(e.target.value)} placeholder="例) 1234-5678-9012" />
          </div>
          {editing?.proof && (
            <a href={editing.proof} target="_blank" rel="noopener noreferrer">
              現在の校正を見る
            </a>
          )}
          {editing?.original && (
            <a href={editing.original} target="_blank" rel="noopener noreferrer">
              元写真を見る
            </a>
          )}
          <Button
            type="link"
            href={`/track?id=${editing?.id}`}
            target="_blank"
            style={{ paddingLeft: 0 }}
          >
            顧客の追跡ページを開く
          </Button>
        </Space>
      </Modal>
    </div>
  );
}

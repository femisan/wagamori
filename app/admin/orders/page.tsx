"use client";

import { useEffect, useState, useCallback } from "react";
import { ProTable, type ProColumns } from "@ant-design/pro-components";
import { Tag, Image, Modal, Select, Input, Button, message, Space } from "antd";

interface Item {
  artwork: string;
  original: string;
  material: string;
  metal: string;
  form: string;
  engraving: string;
  notes: string;
  price: number | null;
  designId: string;
  designMode: "ai" | "human";
  brief: string;
}

interface Row {
  id: string;
  orderId: string;
  created: number;
  email: string;
  amount: number;
  discount: number;
  promoCode: string;
  paid: boolean;
  status: string;
  tracking: string;
  approval: string;
  proof: string;
  items: Item[];
  human: boolean;
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
const MATERIAL_LABEL: Record<string, string> = { alloy: "合金", silver: "シルバー925" };
const METAL_LABEL: Record<string, string> = {
  gold: "ゴールド",
  rosegold: "ローズゴールド",
  silver: "シルバー",
  acrylic: "アクリル(終了)",
};
const FORM_LABEL: Record<string, string> = { necklace: "ネックレス", bracelet: "ブレスレット", keychain: "キーホルダー" };
const specOf = (it: Item) =>
  [
    FORM_LABEL[it.form] ?? it.form,
    [MATERIAL_LABEL[it.material], METAL_LABEL[it.metal] ?? it.metal].filter(Boolean).join("・"),
    it.engraving ? `刻印「${it.engraving}」` : "",
  ]
    .filter(Boolean)
    .join(" · ");

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
    ? rows.filter((r) =>
        `${r.email} ${r.id} ${r.orderId} ${r.items.map(specOf).join(" ")} ${r.address} ${r.phone} ${r.promoCode}`
          .toLowerCase()
          .includes(kw.toLowerCase()),
      )
    : rows;

  const columns: ProColumns<Row>[] = [
    {
      title: "アイテム",
      dataIndex: "items",
      width: 150,
      search: false,
      render: (_, r) => (
        <Image.PreviewGroup>
          <Space size={4} wrap>
            {r.items.slice(0, 3).map((it, i) =>
              it.artwork ? (
                <Image key={i} src={it.artwork} alt={`作品${i + 1}`} width={44} height={44} style={{ objectFit: "cover", borderRadius: 8 }} />
              ) : (
                <span key={i}>—</span>
              ),
            )}
            {r.items.length > 3 && <Tag>+{r.items.length - 3}</Tag>}
          </Space>
        </Image.PreviewGroup>
      ),
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
    {
      title: "仕様",
      dataIndex: "items",
      key: "spec",
      width: 220,
      render: (_, r) => (
        <div style={{ fontSize: 12, whiteSpace: "normal" }}>
          {r.items.map((it, i) => (
            <div key={i}>
              {r.items.length > 1 && <b>#{i + 1} </b>}
              {it.designMode === "human" && (
                <Tag color="purple" style={{ marginRight: 4 }}>
                  人工デザイン
                </Tag>
              )}
              {specOf(it)}
            </div>
          ))}
        </div>
      ),
    },
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
      render: (_, r) => (
        <div>
          <div>¥{r.amount.toLocaleString("ja-JP")}</div>
          {r.discount > 0 && (
            <div style={{ fontSize: 11, color: "#cf1322" }}>
              −¥{r.discount.toLocaleString("ja-JP")}
              {r.promoCode ? ` (${r.promoCode})` : ""}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "支払",
      dataIndex: "paid",
      width: 80,
      filters: [
        { text: "支払済", value: true },
        { text: "未", value: false },
      ],
      defaultFilteredValue: [true],
      onFilter: (v, r) => r.paid === v,
      render: (_, r) => (r.paid ? <Tag color="green">支払済</Tag> : <Tag>未</Tag>),
    },
    {
      title: "デザイン",
      dataIndex: "human",
      width: 110,
      filters: [
        { text: "人工デザイン", value: true },
        { text: "AI案", value: false },
      ],
      onFilter: (v, r) => r.human === v,
      render: (_, r) =>
        r.human ? (
          <Space direction="vertical" size={0}>
            <Tag color="purple">人工デザイン</Tag>
            {r.status === "received" && <span style={{ fontSize: 11, color: "#cf1322" }}>校正待ち</span>}
          </Space>
        ) : (
          <Tag>AI案</Tag>
        ),
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
            placeholder="メール / ID / 仕様 / 住所 / クーポンで検索"
            allowClear
            style={{ width: 320 }}
            onChange={(e) => setKw(e.target.value)}
          />
        }
        pagination={{ pageSize: 20, showSizeChanger: true }}
        expandable={{
          expandedRowRender: (r) => (
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
              {r.items.map((it, i) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: 10, border: "1px solid #f1ddd9", borderRadius: 12, background: "#fff" }}>
                  <Image.PreviewGroup>
                    {it.artwork ? (
                      <Image src={it.artwork} alt="制作する版" width={88} height={88} style={{ objectFit: "cover", borderRadius: 10 }} />
                    ) : (
                      <div style={{ width: 88 }}>—</div>
                    )}
                    {it.original && (
                      <Image src={it.original} alt="元写真" width={56} height={56} style={{ objectFit: "cover", borderRadius: 8, opacity: 0.9 }} />
                    )}
                  </Image.PreviewGroup>
                  <div style={{ fontSize: 12, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>
                      #{i + 1} {specOf(it)}
                      {it.designMode === "human" && (
                        <Tag color="purple" style={{ marginLeft: 6 }}>
                          人工デザイン
                        </Tag>
                      )}
                    </div>
                    {it.designMode === "human" && (
                      <div style={{ marginTop: 4, padding: 6, background: "#f9f0ff", borderRadius: 6, whiteSpace: "pre-wrap" }}>
                        要望：{it.brief || "（記入なし）"}
                        {it.artwork && <div style={{ color: "#999" }}>※ 画像はお客様が参考に選んだAI案</div>}
                      </div>
                    )}
                    {it.price != null && <div>¥{it.price.toLocaleString("ja-JP")}</div>}
                    {it.notes && <div style={{ color: "#666", marginTop: 4 }}>備考：{it.notes}</div>}
                    <Space size={8} style={{ marginTop: 6 }}>
                      {it.artwork && (
                        <a href={it.artwork} target="_blank" rel="noopener noreferrer">
                          版を保存
                        </a>
                      )}
                      {it.original && (
                        <a href={it.original} target="_blank" rel="noopener noreferrer">
                          原件を保存
                        </a>
                      )}
                    </Space>
                  </div>
                </div>
              ))}
              {r.notes && <div style={{ fontSize: 12, color: "#666" }}>注文備考：{r.notes}</div>}
            </div>
          ),
        }}
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
          {editing?.items.map((it, i) => (
            <Space key={i} size={8}>
              <span style={{ fontSize: 12, color: "#999" }}>#{i + 1}</span>
              {it.artwork && (
                <a href={it.artwork} target="_blank" rel="noopener noreferrer">
                  制作する版
                </a>
              )}
              {it.original && (
                <a href={it.original} target="_blank" rel="noopener noreferrer">
                  元写真（原件）
                </a>
              )}
            </Space>
          ))}
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

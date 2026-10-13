"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { ProTable, type ProColumns } from "@ant-design/pro-components";
import {
  Tag,
  Image,
  Drawer,
  Button,
  Upload,
  message,
  Space,
  Segmented,
  Input,
  InputNumber,
  Checkbox,
  Modal,
  Alert,
  Statistic,
  Card,
  Tooltip,
} from "antd";

interface LeadRow {
  designId: string;
  userId: string | null;
  email: string | null;
  status: string;
  metal: string | null;
  originalUrl: string | null;
  thumb: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  orderedAt: string | null;
  optIn: boolean;
  unsubscribed: boolean;
  lastSentAt: string | null;
  lastPromo: string | null;
}
interface Version {
  id: string;
  round: number;
  source: string;
  instruction: string | null;
  baseVersionId: string | null;
  imageUrl: string;
  metal: string | null;
  selected: boolean;
  createdAt: string;
}

const SOURCE_LABEL: Record<string, string> = { ai: "AI", edit: "編集(旧)", cs: "CS作成デザイン", customer: "お客様" };
// Metal COLOUR of the artwork (the material is chosen at checkout).
const METAL_LABEL: Record<string, string> = {
  gold: "ゴールド",
  rosegold: "ローズゴールド",
  silver: "シルバー",
  acrylic: "アクリル(終了)",
};

const DEFAULT_SUBJECT = "【Wagamori】保存中のデザイン、{percent}%OFFでお仕立てしませんか";
const DEFAULT_MESSAGE =
  "先日はWagamoriでデザインを作っていただき、ありがとうございました。\n\n作っていただいたデザインと元のお写真は、そのまま保存しています。「価格が気になって迷っている」という方のために、期間限定で使える{percent}%OFFクーポンをお届けします。\n\nボタンから前回の続きをご覧いただき、お支払い画面でクーポンコードを入力してください。";

function ago(iso: string | null) {
  if (!iso) return "—";
  const d = (Date.now() - new Date(iso).getTime()) / 86400_000;
  if (d < 1) return "今日";
  if (d < 30) return `${Math.floor(d)}日前`;
  return new Date(iso).toLocaleDateString("ja-JP");
}

export default function AdminLeadsPage() {
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"open" | "ordered" | "all">("open");
  const [onlyReachable, setOnlyReachable] = useState(false);
  const [minAttempts, setMinAttempts] = useState<number>(1);
  const [kw, setKw] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);

  const [open, setOpen] = useState<LeadRow | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [vLoading, setVLoading] = useState(false);

  const [mailOpen, setMailOpen] = useState(false);
  const [percent, setPercent] = useState(10);
  const [days, setDays] = useState(7);
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_MESSAGE);
  const [preview, setPreview] = useState<{ eligible: string[]; skipped: { email: string; reason: string }[] } | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await fetch("/api/admin/leads").then((r) => r.json());
      if (j.ok) setRows(j.data);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch list on mount
    load();
  }, [load]);

  const stats = useMemo(() => {
    const openRows = rows.filter((r) => r.status !== "ordered");
    return {
      total: rows.length,
      open: openRows.length,
      openWithEmail: openRows.filter((r) => r.email).length,
      reachable: openRows.filter((r) => r.email && r.optIn).length,
      ordered: rows.length - openRows.length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = kw.trim().toLowerCase();
    return rows.filter((r) => {
      if (view === "open" && r.status === "ordered") return false;
      if (view === "ordered" && r.status !== "ordered") return false;
      if (onlyReachable && !(r.email && r.optIn)) return false;
      if (r.attempts < minAttempts) return false;
      if (q && !`${r.email ?? ""} ${r.designId}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, view, onlyReachable, minAttempts, kw]);

  const selectedRows = useMemo(() => rows.filter((r) => selectedKeys.includes(r.designId)), [rows, selectedKeys]);

  const loadVersions = useCallback(async (id: string) => {
    setVLoading(true);
    try {
      const j = await fetch(`/api/admin/designs?id=${encodeURIComponent(id)}`).then((r) => r.json());
      if (j.ok) setVersions(j.versions);
    } finally {
      setVLoading(false);
    }
  }, []);

  const openDrawer = (r: LeadRow) => {
    setOpen(r);
    setVersions([]);
    loadVersions(r.designId);
  };

  const select = async (versionId: string) => {
    if (!open) return;
    const res = await fetch("/api/admin/designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "select", designId: open.designId, versionId }),
    });
    if (res.ok) {
      message.success("採用版を更新しました");
      loadVersions(open.designId);
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
      body: JSON.stringify({ action: "upload", designId: open.designId, dataUrl }),
    });
    if (res.ok) {
      message.success("CS作成デザインをアップしました");
      loadVersions(open.designId);
      load();
    } else {
      message.error("アップに失敗しました");
    }
  };

  const payload = (dryRun: boolean) => ({
    dryRun,
    percentOff: percent,
    days,
    subject: subject.replaceAll("{percent}", String(percent)),
    message: body.replaceAll("{percent}", String(percent)),
    targets: selectedRows.map((r) => ({ email: r.email, designId: r.designId, thumb: r.thumb, userId: r.userId })),
  });

  const openMail = async () => {
    setMailOpen(true);
    setPreview(null);
    const j = await fetch("/api/admin/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload(true)),
    }).then((r) => r.json());
    if (j.ok) setPreview({ eligible: j.eligible, skipped: j.skipped });
    else message.error(j.error || "確認に失敗しました");
  };

  const send = () => {
    if (!preview?.eligible.length) return;
    Modal.confirm({
      title: `${preview.eligible.length}名に${percent}%OFFクーポンを送信します`,
      content: "Stripe に本番のクーポンが作成され、メールが送信されます。取り消しはできません。",
      okText: "送信する",
      cancelText: "やめる",
      onOk: async () => {
        setSending(true);
        try {
          const j = await fetch("/api/admin/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload(false)),
          }).then((r) => r.json());
          if (!j.ok) {
            message.error(j.error || "送信に失敗しました");
            return;
          }
          if (j.failed?.length) message.warning(`送信 ${j.sent.length}件 / 失敗 ${j.failed.length}件`);
          else message.success(`${j.sent.length}件送信しました`);
          setMailOpen(false);
          setSelectedKeys([]);
          load();
        } finally {
          setSending(false);
        }
      },
    });
  };

  const columns: ProColumns<LeadRow>[] = [
    {
      title: "最新案 / 元写真",
      dataIndex: "thumb",
      width: 128,
      render: (_, r) => (
        <Image.PreviewGroup>
          <Space size={6}>
            {r.thumb ? (
              <Image src={r.thumb} alt="最新案" width={52} height={52} style={{ objectFit: "cover", borderRadius: 8 }} />
            ) : (
              "—"
            )}
            {r.originalUrl && (
              <Image src={r.originalUrl} alt="元写真" width={40} height={40} style={{ objectFit: "cover", borderRadius: 6, opacity: 0.85 }} />
            )}
          </Space>
        </Image.PreviewGroup>
      ),
    },
    {
      title: "お客様",
      dataIndex: "email",
      width: 250,
      render: (_, r) => (
        <div style={{ whiteSpace: "nowrap" }}>
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 230 }}>
            {r.email ?? <span style={{ color: "#999" }}>ゲスト（未ログイン）</span>}
          </div>
          <Space size={4} style={{ marginTop: 2 }}>
            {r.email &&
              (r.unsubscribed ? (
                <Tag>配信停止</Tag>
              ) : r.optIn ? (
                <Tag color="green">配信同意</Tag>
              ) : (
                <Tag>同意なし</Tag>
              ))}
            <span style={{ fontSize: 11, color: "#999", fontFamily: "monospace" }}>{r.designId.slice(0, 8)}</span>
          </Space>
        </div>
      ),
    },
    { title: "金属色", dataIndex: "metal", width: 110, render: (_, r) => (r.metal ? METAL_LABEL[r.metal] ?? r.metal : "—") },
    {
      title: "試作",
      dataIndex: "attempts",
      width: 80,
      sorter: (a, b) => a.attempts - b.attempts,
      render: (_, r) => <span style={{ fontWeight: r.attempts >= 3 ? 600 : 400 }}>{r.attempts}回</span>,
    },
    {
      title: "最終操作",
      dataIndex: "updatedAt",
      width: 100,
      defaultSortOrder: "descend",
      sorter: (a, b) => +new Date(a.updatedAt) - +new Date(b.updatedAt),
      render: (_, r) => <Tooltip title={new Date(r.updatedAt).toLocaleString("ja-JP")}>{ago(r.updatedAt)}</Tooltip>,
    },
    {
      title: "状態",
      dataIndex: "status",
      width: 90,
      render: (_, r) => (r.status === "ordered" ? <Tag color="gold">注文済み</Tag> : <Tag color="volcano">未注文</Tag>),
    },
    {
      title: "前回クーポン",
      dataIndex: "lastSentAt",
      width: 130,
      render: (_, r) =>
        r.lastSentAt ? (
          <div style={{ fontSize: 12 }}>
            <div>{ago(r.lastSentAt)}</div>
            <div style={{ color: "#999", fontFamily: "monospace" }}>{r.lastPromo}</div>
          </div>
        ) : (
          "—"
        ),
    },
    { title: "操作", width: 70, key: "op", render: (_, r) => <a onClick={() => openDrawer(r)}>履歴</a> },
  ];

  const original = open?.originalUrl;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>デザイン・見込み客</h1>
      <p style={{ color: "#9b7a80", marginBottom: 16 }}>
        すべてのプレビュー（元写真＋試作）を保存。何度も試したのに注文していないお客様に、割引クーポンを送れます。
      </p>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", marginBottom: 16 }}>
        <Card size="small"><Statistic title="デザイン総数" value={stats.total} /></Card>
        <Card size="small"><Statistic title="未注文" value={stats.open} /></Card>
        <Card size="small"><Statistic title="未注文・メールあり" value={stats.openWithEmail} /></Card>
        <Card size="small"><Statistic title="未注文・配信同意" value={stats.reachable} valueStyle={{ color: "#3f8600" }} /></Card>
        <Card size="small"><Statistic title="注文済み" value={stats.ordered} /></Card>
      </div>

      <ProTable<LeadRow>
        rowKey="designId"
        loading={loading}
        dataSource={filtered}
        columns={columns}
        search={false}
        scroll={{ x: 1000 }}
        options={{ reload: () => load(), setting: true, density: true }}
        rowSelection={{
          selectedRowKeys: selectedKeys,
          onChange: setSelectedKeys,
          getCheckboxProps: (r) => ({ disabled: !r.email || !r.optIn || r.status === "ordered" }),
        }}
        tableAlertOptionRender={() => (
          <Space>
            <Button type="primary" size="small" onClick={openMail} disabled={selectedRows.length === 0}>
              割引メールを送る（{selectedRows.length}）
            </Button>
            <a onClick={() => setSelectedKeys([])}>選択解除</a>
          </Space>
        )}
        headerTitle={
          <Space wrap>
            <Segmented
              value={view}
              onChange={(v) => setView(v as typeof view)}
              options={[
                { label: "未注文", value: "open" },
                { label: "注文済み", value: "ordered" },
                { label: "すべて", value: "all" },
              ]}
            />
            <Space size={4}>
              <span style={{ fontSize: 13, color: "#666" }}>試作</span>
              <InputNumber min={0} max={50} value={minAttempts} onChange={(v) => setMinAttempts(v ?? 0)} style={{ width: 64 }} />
              <span style={{ fontSize: 13, color: "#666" }}>回以上</span>
            </Space>
            <Checkbox checked={onlyReachable} onChange={(e) => setOnlyReachable(e.target.checked)}>
              配信同意ありのみ
            </Checkbox>
            <Input.Search placeholder="メール / ID" allowClear style={{ width: 220 }} onChange={(e) => setKw(e.target.value)} />
          </Space>
        }
        pagination={{ pageSize: 20, showSizeChanger: true }}
      />

      {/* Discount email composer */}
      <Modal
        title="割引クーポンメール"
        open={mailOpen}
        onCancel={() => setMailOpen(false)}
        onOk={send}
        okText={preview ? `送信（${preview.eligible.length}名）` : "確認中…"}
        okButtonProps={{ disabled: !preview?.eligible.length, loading: sending }}
        cancelText="閉じる"
        width={560}
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Space wrap>
            <span>割引率</span>
            <InputNumber min={5} max={50} step={5} value={percent} onChange={(v) => setPercent(v ?? 10)} addonAfter="%" />
            <span>有効期限</span>
            <InputNumber min={1} max={60} value={days} onChange={(v) => setDays(v ?? 7)} addonAfter="日" />
          </Space>
          <div>
            <div style={{ fontSize: 12, color: "#999" }}>件名（{"{percent}"} は割引率に置換）</div>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#999" }}>本文（クーポンコード・期限・配信停止リンクは自動で入ります）</div>
            <Input.TextArea value={body} onChange={(e) => setBody(e.target.value)} rows={7} maxLength={2000} />
          </div>
          {preview && (
            <Alert
              type={preview.eligible.length ? "info" : "warning"}
              message={`送信対象 ${preview.eligible.length}名${preview.skipped.length ? ` ・ 除外 ${preview.skipped.length}名` : ""}`}
              description={
                preview.skipped.length ? (
                  <div style={{ fontSize: 12 }}>
                    {preview.skipped.map((s) => (
                      <div key={s.email}>
                        {s.email} — {s.reason === "cooldown" ? "14日以内に送信済み" : "配信同意なし / 停止済み"}
                      </div>
                    ))}
                  </div>
                ) : (
                  "お一人ずつ1回限りのクーポンコードを発行します。"
                )
              }
            />
          )}
        </Space>
      </Modal>

      {/* Version history: original pinned on top, then every attempt */}
      <Drawer
        title="試作履歴 / 版管理"
        open={!!open}
        onClose={() => setOpen(null)}
        width={Math.min(560, typeof window !== "undefined" ? window.innerWidth : 560)}
      >
        {open && (
          <Space direction="vertical" size={4} style={{ width: "100%", marginBottom: 16 }}>
            <div>{open.email ?? "ゲスト（未ログイン）"}</div>
            <div style={{ fontSize: 12, color: "#999" }}>
              作成 {new Date(open.createdAt).toLocaleString("ja-JP")} ・ 試作 {open.attempts}回 ・{" "}
              {open.status === "ordered" ? "注文済み" : "未注文"}
            </div>
          </Space>
        )}
        <Upload accept="image/*" showUploadList={false} beforeUpload={(f) => (uploadCs(f), false)}>
          <Button type="primary">CS作成デザインをアップ</Button>
        </Upload>
        <div style={{ marginTop: 16 }}>
          {original && (
            <div style={{ display: "flex", gap: 12, padding: 12, borderRadius: 12, background: "#fdf6f3", marginBottom: 12 }}>
              <Image src={original} alt="元写真" width={84} height={84} style={{ objectFit: "cover", borderRadius: 10 }} />
              <div>
                <Tag color="magenta">元写真</Tag>
                <div style={{ fontSize: 12, color: "#999", marginTop: 6 }}>すべての試作はこの元写真から生成されています。</div>
                <a href={original} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
                  原寸でダウンロード
                </a>
              </div>
            </div>
          )}
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
                      {v.metal && <Tag>{METAL_LABEL[v.metal] ?? v.metal}</Tag>}
                      <Tag color={v.baseVersionId ? "blue" : "default"}>
                        {v.baseVersionId
                          ? `#${versions.find((x) => x.id === v.baseVersionId)?.round ?? "?"} を修正`
                          : v.source === "cs"
                            ? "手動"
                            : "元写真から"}
                      </Tag>
                      {new Date(v.createdAt).toLocaleString("ja-JP")}
                    </div>
                    {v.instruction ? (
                      <div style={{ fontSize: 13, marginTop: 4 }}>“{v.instruction}”</div>
                    ) : (
                      <div style={{ fontSize: 12, marginTop: 4, color: "#bbb" }}>（要望なし）</div>
                    )}
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
              {versions.length === 0 && <p style={{ color: "#999" }}>試作がありません。</p>}
            </Space>
          )}
        </div>
      </Drawer>
    </div>
  );
}

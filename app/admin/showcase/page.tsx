"use client";

import { useEffect, useState, useCallback } from "react";
import { ProTable, type ProColumns } from "@ant-design/pro-components";
import { Tag, Image, Button, Popconfirm, message, Space } from "antd";

interface Row {
  id: string;
  userId: string;
  authorName: string | null;
  imageUrl: string;
  caption: string | null;
  status: string;
  likes: number;
  createdAt: string;
}

export default function AdminShowcasePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await fetch("/api/admin/showcase").then((r) => r.json());
      if (j.ok) setRows(j.data);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch list on mount
    load();
  }, [load]);

  const act = async (id: string, action: "hide" | "show" | "delete") => {
    const res = await fetch("/api/admin/showcase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id }),
    });
    if (res.ok) {
      message.success(action === "delete" ? "削除しました" : "更新しました");
      load();
    } else {
      message.error("操作に失敗しました");
    }
  };

  const columns: ProColumns<Row>[] = [
    {
      title: "写真",
      dataIndex: "imageUrl",
      width: 90,
      render: (_, r) => <Image src={r.imageUrl} alt="投稿写真" width={64} height={64} style={{ objectFit: "cover", borderRadius: 8 }} />,
    },
    {
      title: "投稿",
      dataIndex: "caption",
      width: 280,
      render: (_, r) => (
        <div>
          <div style={{ fontSize: 13 }}>{r.caption || <span style={{ color: "#bbb" }}>（コメントなし）</span>}</div>
          <div style={{ fontSize: 11, color: "#999" }}>
            {r.authorName || `user ${r.userId.slice(-6)}`} · {new Date(r.createdAt).toLocaleString("ja-JP")}
          </div>
        </div>
      ),
    },
    { title: "いいね", dataIndex: "likes", width: 90, sorter: (a, b) => a.likes - b.likes, render: (_, r) => `♥ ${r.likes}` },
    {
      title: "状態",
      dataIndex: "status",
      width: 100,
      filters: [
        { text: "表示中", value: "visible" },
        { text: "非表示", value: "hidden" },
      ],
      onFilter: (v, r) => r.status === v,
      render: (_, r) => (r.status === "visible" ? <Tag color="green">表示中</Tag> : <Tag>非表示</Tag>),
    },
    {
      title: "操作",
      width: 200,
      key: "op",
      render: (_, r) => (
        <Space>
          {r.status === "visible" ? (
            <a onClick={() => act(r.id, "hide")}>非表示</a>
          ) : (
            <a onClick={() => act(r.id, "show")}>表示</a>
          )}
          <Popconfirm title="削除しますか？" onConfirm={() => act(r.id, "delete")} okText="削除" cancelText="やめる">
            <a style={{ color: "#c0392b" }}>削除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>実物投稿（買家秀）の管理</h1>
      <ProTable<Row>
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={columns}
        search={false}
        scroll={{ x: 760 }}
        options={{ reload: () => load(), setting: true, density: true }}
        pagination={{ pageSize: 20 }}
      />
      <Button style={{ marginTop: 12 }} onClick={() => load()}>
        再読み込み
      </Button>
    </div>
  );
}

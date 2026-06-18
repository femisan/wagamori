---
name: wagamori-blog
description: Write a Wagamori (わが守) blog article in the answer-first, SEO/AI-optimized format AND auto-generate a cover + inline brand illustrations (via smart-illustrator / Gemini), then package everything as a 图文并茂 .zip ready to upload at /admin/blog (no redeploy). Use when asked to write/draft a blog post, article, ブログ, 記事, コラム, 配图, with images, or to prepare/package illustrated blog content for upload.
---

# Wagamori Blog — write, illustrate & package an article

Wagamori turns children's drawings & pet photos into handcrafted cloisonné keepsake
jewelry (necklace / bracelet / keychain). Blog articles capture informational search
("子供の絵 収納", "ペット メモリアル", "出産祝い ギフト") and funnel readers to the
free preview at `/studio`. Posts are managed via the DB-backed blog: you write
offline, package a **.zip** (markdown + images), upload it at `/admin/blog` — it goes
live instantly (no redeploy) and is auto-pinged to Bing via IndexNow.

**The deliverable is always an upload-ready zip that is 图文并茂**: answer-first SEO
copy + a cover image + 2–4 inline illustrations, all web-optimized. Never ship a
text-only post unless the user explicitly asks for `--no-images`.

## Workflow (4 steps)

1. **Write** `index.md` (answer-first copy) with image placeholders planned in.
2. **Illustrate** — generate cover + 2–4 inline images with smart-illustrator (Gemini).
3. **Optimize & assemble** — convert to web JPGs, lay out the zip folder.
4. **Package** the `.zip` and hand it to the user (or upload at `/admin/blog`).

---

## 1. Write `index.md`

Start with YAML frontmatter, then the answer-first body. **Plan image slots while
writing**: 1 cover + one inline image roughly every 2 H2 sections.

```markdown
---
title: "〇〇する方法｜サブキーワードを含むタイトル"   # ~30–40字, 主キーワードを前方に
slug: kebab-case-slug                              # 任意。省略時はフォルダ/zip名
description: "検索意図に直接答える1文（120字前後）"  # メタ説明・SEO
date: "2026-06-20"                                  # YYYY-MM-DD
tags: [子供の絵, ギフト]
status: published                                   # published | draft
cover: cover.jpg                                    # ← 自動生成する封面（必須）
---

（本文。H2 のあいだに ![alt](images/01-slug.jpg) を差し込む）
```

### Answer-first writing rules (AI/検索に強い書き方)

1. **冒頭で結論を即答**。1〜2文で、タイトルの問いに直接・自己完結で答える。例:
   `**結論：子供の絵は、スマホで撮ってアップするだけで数秒でネックレスのデザインにできます。**`
   → AI Overviews / ChatGPT / 強調スニペットに抽出されやすい。
2. **H2 は質問または明確なトピック**にし、各セクションも**最初の1文で答え**を述べる。
3. 箇条書き・短文を多用（機械が抽出しやすい）。1文＝1事実。
4. 主キーワードを title / description / 最初の段落 / H2 に自然に含める（詰め込まない）。
5. 事実は正確に（素材=シルバー925＋18金/ローズゴールドコーティング、価格 ¥7,500〜、納期 約14〜20日、送料無料、名入れ可）。**虚偽・誇大・架空のレビューは書かない**（景表法/ステマ規制）。
6. 文末に必ず CTA リンク（コンバージョン導線）: `[無料でプレビューを見る →](/studio)`
7. 関連記事への**内部リンク**を1つ以上（例 `[…](/blog/pet-memorial)`）。
8. 長さの目安: 600〜1200字。言語は日本語（主市場）。

### Image rules (SEO + 法令)

- **alt は説明的に、主キーワードを自然に含める**（例: `![子供の絵をネックレスにした例](images/01-...)`）。これが画像SEO。
- 画像ファイル名は**説明的な kebab-case**（`01-kids-art-necklace.jpg`）。
- 生成画像は**イメージ挿絵**。本物の顧客写真や実物の作例として誤認させない（架空のレビュー・成果の演出は不可＝景表法/ステマ規制）。雰囲気・コンセプトを伝える用途に留める。
- 画像内に**文字・ロゴ・ブランド名・価格を描き込まない**（誤情報・商標事故の防止。文字は本文で表現）。
- カバーは**トップページ（/gallery の AI 例图）や /showcase の実物と重複しない**こと → 毎回新規生成するので自動的に満たされる。

---

## 2. Illustrate — smart-illustrator (Gemini engine)

Wagamori is an **emotional, lifestyle product** brand, so always use the **Gemini**
engine (creative/photographic). Do NOT use Mermaid/Excalidraw here — those are for
technical diagrams. The generator script lives in the smart-illustrator skill:
`~/.claude/skills/smart-illustrator/scripts/generate-image.ts` (needs `GEMINI_API_KEY`
in env and the `bun` runtime; invoke with `bun <script>` — the `npx -y bun` form in
smart-illustrator's own docs does NOT resolve here). Model used: gemini-3-pro-image-preview.

Generate **1 cover (16:9)** + **2–4 inline images (3:2)**. For each image, write a
prompt file using the **Wagamori brand prompt** below, then call the script.

### Wagamori brand prompt (every image starts from this)

```
日本のハンドメイドジュエリーブランド「わが守」のブログ用イメージ挿絵。
雰囲気：やわらかな自然光、温かく優しい、清潔感のあるライフスタイル。
配色：ローズ（くすみピンク）とゴールド/シャンパンを基調にした上品なトーン。
質感：手仕事の七宝（クロワゾネ）エナメルの繊細さ、上質な紙やリネンの背景。
構図：余白を活かし、主役をやわらかくフォーカス。被写体の正面の顔は中心に置かない。

【この画像の内容】：{ここに各図の具体的な被写体・シーンを書く}

厳守事項：
- 画像内に文字・ロゴ・ブランド名・価格・透かしを一切入れない。
- 実在の特定ブランド/人物を描かない。広告的・誇張的な演出をしない。
- 写真風または上品なイラスト風。リアルな商品写真として誤認させる細工はしない。
```

### Commands

Work inside the post folder (e.g. `my-post/`). Use a tmp dir under
`$CLAUDE_JOB_DIR/tmp` for prompt files when available.

```bash
POST=my-post                 # folder containing index.md
mkdir -p "$POST/images"
TMP="${CLAUDE_JOB_DIR:-/tmp}/tmp"; mkdir -p "$TMP"

# --- Cover (16:9) ---
cat > "$TMP/cover-prompt.txt" <<'EOF'
{Wagamori brand prompt 全文}
【この画像の内容】：{記事テーマを象徴するヒーローシーン}
EOF
GEMINI_API_KEY=$GEMINI_API_KEY bun ~/.claude/skills/smart-illustrator/scripts/generate-image.ts \
  --prompt-file "$TMP/cover-prompt.txt" --output "$POST/cover.png" --aspect-ratio 16:9

# --- Inline image NN (3:2) — repeat per slot ---
cat > "$TMP/img-01.txt" <<'EOF'
{Wagamori brand prompt 全文}
【この画像の内容】：{該当 H2 セクションのシーン}
EOF
GEMINI_API_KEY=$GEMINI_API_KEY bun ~/.claude/skills/smart-illustrator/scripts/generate-image.ts \
  --prompt-file "$TMP/img-01.txt" --output "$POST/images/01-slug.png" --aspect-ratio 3:2
```

**No `GEMINI_API_KEY`?** Fall back to `--prompt-only` (smart-illustrator copies the
JSON prompt to clipboard) and tell the user to generate on Gemini Web, drop the PNGs
into `images/`, then continue from step 3. Don't ship a text-only post silently.

---

## 3. Optimize & assemble (web-friendly = SEO)

Gemini outputs large 2K PNGs. Convert to right-sized JPGs (faster pages = better SEO/UX).
`sips` is macOS-native (avoids any shell-proxy garbling on `convert`):

```bash
# Cover → max 1600px wide JPG, q82
sips -s format jpeg -s formatOptions 82 -Z 1600 "$POST/cover.png" --out "$POST/cover.jpg" >/dev/null
rm "$POST/cover.png"

# Each inline → max 1200px JPG, q82
for f in "$POST"/images/*.png; do
  sips -s format jpeg -s formatOptions 82 -Z 1200 "$f" --out "${f%.png}.jpg" >/dev/null && rm "$f"
done
```

Then make sure `index.md` references match the **.jpg** files:
- frontmatter `cover: cover.jpg`
- body `![説明的なalt（キーワード含む）](images/01-slug.jpg)` placed right after the relevant H2.

Target final folder:

```
my-post/
├── index.md            # 必須・answer-first・cover と images を参照
├── cover.jpg           # 自動生成・封面（主页/showcase と重複しない）
└── images/
    ├── 01-slug.jpg     # 本文挿絵（2〜4枚）
    ├── 02-slug.jpg
    └── 03-slug.jpg
```

> HTML派: `index.md` の代わりに `index.html` + `meta.json`（title/slug/description/date/tags/cover）も可。画像参照は同じく相対パス。

---

## 4. Package the .zip

```bash
cd my-post && zip -q -r ../my-post.zip index.md cover.jpg images/
```

Hand the zip to the user (SendUserFile) and/or guide the upload below. The uploader
auto-uploads every image in the zip to Vercel Blob and rewrites `cover`/`![](...)`
paths to Blob URLs — so relative paths in the zip are correct.

---

## 5. Upload (公開)

1. `/admin/blog`（管理者ログイン）を開く
2. **「記事 zip をアップロード」** で zip を選択
3. 自動で: 解凍 → 画像を Blob へ → markdown を HTML 化 → DB 保存 → **即公開**
4. 公開時に **IndexNow** で Bing 等へ自動通知、**sitemap** にも自動反映
5. 重要記事は公開後、**Google Search Console** で該当 URL を「インデックス登録をリクエスト」すると収録が早い

---

## Template (コピーして使う — 图文并茂)

```markdown
---
title: "ペットの似顔絵キーホルダーとは？作り方と人気の理由"
slug: pet-keychain-guide
description: "ペットの写真から作る似顔絵キーホルダーについて、作り方・素材・納期をわかりやすく解説します。"
date: "2026-06-20"
tags: [ペット, キーホルダー, オーダーメイド]
status: published
cover: cover.jpg
---

**結論：ペットの似顔絵キーホルダーは、写真をアップロードして数秒の無料プレビュー後、職人が手作りで仕上げる世界に一つのグッズです。** バッグや鍵に着けて、いつも一緒に持ち歩けます。

![ペットの写真から作った似顔絵キーホルダーのイメージ](images/01-pet-keychain.jpg)

## 似顔絵キーホルダーって何？
ペットの写真を七宝（クロワゾネ）エナメルのチャームにし、キーリングで仕上げたグッズです。

## 作り方（かんたん3ステップ）
1. 写真をアップロード（登録不要）
2. 数秒で無料プレビュー
3. 色・形を選んで注文 → 職人が手作り

![スマホで写真をアップしてプレビューする流れのイメージ](images/02-upload-preview.jpg)

## 素材・価格・納期
- 素材: シルバー925＋18金/ローズゴールドコーティング、金属アレルギー対応
- 価格: ¥7,500〜・送料無料
- 納期: ご注文・デザイン確定後 約14〜20日

関連: [ペットの写真を“形”に残す方法](/blog/pet-memorial)

[無料でプレビューを見る →](/studio)
```
```

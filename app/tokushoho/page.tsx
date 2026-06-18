import LegalShell from "@/components/LegalShell";
import { SITE } from "@/lib/site";

export const metadata = { title: "特定商取引法に基づく表記 | Wagamori" };

const ROWS: [string, string][] = [
  ["販売事業者", "ラ ウンジュ"],
  ["運営責任者", "ラ ウンジュ"],
  ["所在地", "〒154-0023 東京都世田谷区若林5-19-7 ハウス柏木301"],
  ["電話番号", "ご請求をいただいた場合に、遅滞なくメールにて開示します（お問い合わせは下記メールアドレスへ）。"],
  ["メールアドレス", SITE.email],
  ["ホームページURL", SITE.url],
  ["販売価格", "各商品ページに表示する価格（消費税込）。ネックレス本体 ¥7,500〜"],
  ["商品代金以外の必要料金", "送料無料（価格に含む）。海外配送時の関税・輸入税はお客様のご負担となる場合があります。お急ぎ便（加急）をご希望の場合は別途料金がかかります。"],
  ["お支払い方法", "クレジットカード（Stripe決済：Visa / Mastercard / American Express / JCB ほか）"],
  ["お支払い時期", "ご注文時に決済が確定します。"],
  ["商品の引渡し時期", "ご注文・デザイン確定（校正のご承認）後、通常14〜20日以内に発送します。お急ぎの場合は備考欄に希望日をご記入ください。"],
  [
    "返品・交換・キャンセル",
    "一点ずつのオーダーメイド商品のため、お客様都合による返品・交換・キャンセルはお受けできません。ただし、不良品・配送中の破損・当方の制作ミスの場合は、商品到着後7日以内にご連絡いただければ、無償で再制作または返金いたします。",
  ],
  ["不良品について", "上記のとおり、当方の責による不良品は再制作または返金で対応します。"],
];

export default function TokushohoPage() {
  return (
    <LegalShell title="特定商取引法に基づく表記" updated="制定日：2026年6月">
      <p>
        特定商取引法に基づき、以下のとおり表記します。電話番号は、ご請求をいただいた場合に遅滞なくメールにて開示いたします。
      </p>
      <div className="card divide-y divide-line">
        {ROWS.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4">
            <span className="shrink-0 font-medium text-foreground sm:w-44">{k}</span>
            <span className="flex-1">{v}</span>
          </div>
        ))}
      </div>
    </LegalShell>
  );
}

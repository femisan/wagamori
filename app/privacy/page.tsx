import LegalShell, { Section } from "@/components/LegalShell";
import { SITE } from "@/lib/site";

export const metadata = { title: "プライバシーポリシー | Wagamori" };

export default function PrivacyPage() {
  return (
    <LegalShell title="プライバシーポリシー" updated="制定日：2026年6月（テンプレート・要確認）">
      <p>
        {SITE.name}（以下「当方」）は、お客様の個人情報を適切に取り扱うことが社会的責務であると考え、本プライバシーポリシーを定めます。<strong>【 】</strong>
        の項目はご自身の情報・運用に合わせて調整してください。
      </p>

      <Section heading="1. 取得する情報">
        <ul className="list-disc space-y-1 pl-5">
          <li>お名前、メールアドレス、配送先住所、電話番号</li>
          <li>ご注文内容・取引履歴</li>
          <li>お客様がアップロードした画像（お子さまの絵・写真など）およびデザインの調整履歴</li>
          <li>決済情報（クレジットカード番号等は当方では保持せず、決済代行会社が処理します）</li>
          <li>Cookie、アクセスログ、端末情報等（サービス改善・不正防止のため）</li>
        </ul>
      </Section>

      <Section heading="2. 利用目的">
        <ul className="list-disc space-y-1 pl-5">
          <li>商品の制作・発送、ご注文管理、お客様対応のため</li>
          <li>アップロード画像をもとにしたデザイン生成・制作のため</li>
          <li>制作状況のご連絡、追跡リンクの送付のため</li>
          <li>サービスの提供・改善、不正利用の防止のため</li>
          <li>法令に基づく対応のため</li>
        </ul>
      </Section>

      <Section heading="3. 第三者提供・業務委託">
        <p>当方は、サービス提供に必要な範囲で、以下の外部サービスに個人情報の取扱いを委託します。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>決済処理：Stripe, Inc.</li>
          <li>メール送信：Resend</li>
          <li>ログイン認証：Clerk</li>
          <li>ホスティング・画像保存：Vercel / Neon</li>
          <li>制作委託先（提携工房）：商品制作に必要な画像・仕様・配送先情報</li>
        </ul>
        <p>法令に基づく場合を除き、上記以外の第三者へお客様の同意なく個人情報を提供することはありません。</p>
      </Section>

      <Section heading="4. アップロード画像の取り扱い">
        <p>
          お客様がアップロードした画像は、デザイン生成・商品制作・ご注文対応の目的にのみ使用します。お客様ご自身が「みんなの実物（買家秀）」へ投稿された画像のみ、サイト上で公開されます。お客様の同意なく、アップロード画像を広告・宣伝に使用することはありません。
        </p>
      </Section>

      <Section heading="5. Cookie・アクセス解析">
        <p>
          本サイトは、利便性向上・不正防止・利用状況の把握のためにCookie等を使用する場合があります。ブラウザの設定でCookieを無効にできますが、一部機能がご利用いただけない場合があります。
        </p>
      </Section>

      <Section heading="6. 安全管理">
        <p>当方は、個人情報の漏えい・滅失・毀損の防止に努め、取得した情報を適切に管理します。</p>
      </Section>

      <Section heading="7. 開示・訂正・削除等のご請求">
        <p>
          お客様は、ご自身の個人情報の開示・訂正・利用停止・削除をご請求いただけます。下記お問い合わせ窓口までご連絡ください。本人確認のうえ、法令に従い速やかに対応します。
        </p>
      </Section>

      <Section heading="8. お問い合わせ窓口">
        <p>
          {SITE.name}　【氏名】<br />
          メール：{SITE.email}
        </p>
      </Section>

      <Section heading="9. 改定">
        <p>本ポリシーの内容は、法令の変更やサービス内容に応じて改定することがあります。改定後の内容は本ページに掲載した時点で効力を生じます。</p>
      </Section>

      <p className="text-xs text-muted">
        ※ 本テンプレートは一般的な記載例であり、法的助言ではありません。事業内容に合わせて専門家のご確認をおすすめします。
      </p>
    </LegalShell>
  );
}

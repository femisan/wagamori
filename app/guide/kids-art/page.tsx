import Link from "next/link";
import LegalShell, { Section } from "@/components/LegalShell";
import { SITE } from "@/lib/site";

export const metadata = {
  title: "子供の絵の収納・飾り方アイデア集｜ずっと残す方法",
  description:
    "増えていく子供の絵、どう収納・整理する？飾り方やデジタル保存、刺繍やアクセサリーにして残す方法まで。お気に入りの一枚をずっとそばに残すアイデアを紹介します。",
  alternates: { canonical: `${SITE.url}/guide/kids-art` },
  openGraph: {
    title: "子供の絵の収納・飾り方アイデア集",
    description: "収納・飾り方・デジタル保存・刺繍・アクセサリー。子供の絵をずっと残すアイデア集。",
    url: `${SITE.url}/guide/kids-art`,
  },
};

export default function KidsArtGuidePage() {
  return (
    <LegalShell title="子供の絵の収納・飾り方アイデア集" updated="ずっと残すための保存アイデア">
      <p>
        子供が描いた絵は、どれも宝物。でも気づけばどんどん増えて「どう収納しよう」「捨てられないけど飾る場所がない」と悩みますよね。ここでは、子供の絵を
        <strong>収納・整理する方法</strong>から<strong>飾り方</strong>、そして
        <strong>形にしてずっと残す方法</strong>まで、無理なく続けられるアイデアを紹介します。
      </p>

      <Section heading="1. 紙のまま収納・整理する">
        <ul className="list-disc space-y-1 pl-5">
          <li>クリアファイルや作品収納ボックスに、日付・年齢を書いて時系列で保管</li>
          <li>増えすぎたら「お気に入りベスト3」を本人に選んでもらって厳選</li>
          <li>大きい作品は丸めて筒に、量が多い家庭は無印・100均の収納が便利</li>
        </ul>
      </Section>

      <Section heading="2. 飾って楽しむ">
        <ul className="list-disc space-y-1 pl-5">
          <li>額縁に入れて壁に。複数並べると「おうちギャラリー」に</li>
          <li>麻ひもとクリップでガーランド風に吊るす（季節ごとに入れ替え）</li>
          <li>マスキングテープで気軽に貼り替え。子供も喜びます</li>
        </ul>
      </Section>

      <Section heading="3. デジタルで保存する">
        <p>
          原画は場所を取るので、<strong>写真に撮る・スキャンする</strong>のが定番。フォトブックにまとめれば一冊で何年分も残せます。色あせや紛失の心配もなく、データなら家族と共有も簡単です。
        </p>
      </Section>

      <Section heading="4. 形にして残す（刺繍・グッズ・アクセサリー）">
        <p>
          最近は、お気に入りの一枚を<strong>刺繍</strong>やマグカップ・Tシャツなどの
          <strong>オリジナルグッズ</strong>にする方も増えています。中でも人気なのが、絵を
          <strong>アクセサリーにして身につける</strong>方法。紙やデータと違って、毎日そばに連れていけるのが魅力です。
        </p>
      </Section>

      <Section heading="5.「身につけて、いつもそばに」— わが守のオーダーメイド">
        <p>
          {SITE.name}では、お子さまが描いた絵やペットの写真を、職人がひとつずつ手作りの
          <strong>七宝（クロワゾネ）アクセサリー</strong>に仕上げます。
          <strong>ネックレス・ブレスレット・キーホルダー</strong>から選べるので、小さなお子さまに引っぱられやすいご家庭は手首やバッグに着けるタイプも。名入れ・刻印にも対応します。
        </p>
        <p>
          作る前に、<strong>アップロードして数秒で無料プレビュー</strong>。仕上がりイメージを見てから決められます。お子さまへのプレゼントにすると「自分の絵が本物になった！」と大よろこびしてくれますよ。
        </p>
        <div className="pt-2">
          <Link
            href="/studio"
            className="btn-primary inline-block cursor-pointer rounded-full px-7 py-3.5 text-base font-medium"
          >
            無料でプレビューを見る →
          </Link>
        </div>
      </Section>
    </LegalShell>
  );
}

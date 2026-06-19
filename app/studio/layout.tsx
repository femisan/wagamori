import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "無料プレビュー — 子供の絵・ペット写真からネックレスを作る",
  description:
    "写真や絵をアップロードするだけ。数秒でネックレスのデザインプレビューが完成。登録不要・無料。",
  alternates: { canonical: `${SITE.url}/studio` },
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}

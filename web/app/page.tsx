import Link from "next/link";
import Image from "next/image";
import { SiteHeader } from "@/components/landing/SiteHeader";

const WORKSPACE = "/home";

export default function LandingPage() {
  return (
    <div className="desk-page">
      <SiteHeader />

      <section className="desk-hero">
        <div className="desk-hero-copy desk-enter">
          <h1 className="desk-display">
            和你的猫猫，
            <span className="desk-display-accent">写下第一个故事</span>
          </h1>
          <p className="desk-lede">
            剧本、分镜、角色，放在同一张书桌上。
          </p>
          <Link href={WORKSPACE} className="desk-cta">
            开始写作
          </Link>
        </div>

        <div className="desk-hero-asset desk-enter desk-enter-delay">
          <div className="desk-plate">
            <div className="desk-plate-cat">
              <Image
                src="/icon.png"
                alt="DRAMO 猫猫，正在写本子"
                fill
                sizes="(max-width: 768px) 80vw, 420px"
                className="object-contain"
                style={{ filter: "invert(1) brightness(0.92)" }}
                priority
              />
            </div>
            <aside className="desk-excerpt" aria-label="示例场次">
              <p className="desk-excerpt-loc">深夜。书桌。台灯只照得见稿纸。</p>
              <p className="desk-excerpt-char">猫</p>
              <p className="desk-excerpt-line">（把笔推过来）先写一句。剩下的我陪你。</p>
            </aside>
          </div>
        </div>
      </section>

      <section className="desk-section">
        <h2 className="desk-section-title">打开就是一张稿纸</h2>
        <p className="desk-section-body">
          用一句话起稿。场次、对白和镜头在同一处铺开，改一句就能往下走。
        </p>
        <div className="desk-sheet">
          <div className="desk-sheet-col">
            <p className="desk-sheet-kicker">场次</p>
            <p className="desk-sheet-text">内景。创作者的工作室。夜。</p>
            <p className="desk-sheet-text">台灯亮着。键盘旁蜷着一只猫。</p>
          </div>
          <div className="desk-sheet-col desk-sheet-col-warm">
            <p className="desk-sheet-kicker">对白</p>
            <p className="desk-sheet-text">写下来。别等它自己成型。</p>
            <p className="desk-sheet-text">先有一句，才有一场戏。</p>
          </div>
        </div>
      </section>

      <section className="desk-section desk-section-tight">
        <div className="desk-split">
          <article className="desk-tile desk-tile-lead">
            <h3>剧本</h3>
            <p>按场次写下动作和对白，导出后可以直接进组。</p>
          </article>
          <div className="desk-tile-stack">
            <article className="desk-tile">
              <h3>分镜</h3>
              <p>一场戏拆成镜头，画面和文字并排改。</p>
            </article>
            <article className="desk-tile">
              <h3>角色</h3>
              <p>档案、关系、外形，写的时候随时对照。</p>
            </article>
          </div>
        </div>
      </section>

      <section className="desk-close">
        <h2 className="desk-display desk-display-close">稿纸已经铺好。</h2>
        <Link href={WORKSPACE} className="desk-cta">
          开始写作
        </Link>
      </section>

      <footer className="desk-footer">
        <span className="desk-wordmark">DRAMO</span>
        <span>本地创作台</span>
      </footer>
    </div>
  );
}

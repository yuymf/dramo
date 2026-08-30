import Link from "next/link";
import Image from "next/image";

export function SiteHeader() {
  return (
    <header className="desk-header">
      <Link href="/" className="desk-brand">
        <span className="desk-brand-mark">
          <Image
            src="/icon.png"
            alt=""
            width={28}
            height={28}
            className="desk-brand-icon"
          />
        </span>
        <span className="desk-wordmark">DRAMO</span>
      </Link>
      <Link href="/home" className="desk-cta desk-cta-header">
        开始写作
      </Link>
    </header>
  );
}

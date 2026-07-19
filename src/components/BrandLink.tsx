"use client";

import Image from "next/image";
import Link from "next/link";

export function BrandLink({
  className = "",
  imageClassName = "h-8 w-8",
  textClassName = "text-sm sm:text-base",
  gapClassName = "gap-2",
}: {
  className?: string;
  imageClassName?: string;
  textClassName?: string;
  gapClassName?: string;
}) {
  return (
    <Link href="/" className={`flex min-w-0 items-center ${gapClassName} ${className}`}>
      <Image
        src="/brand/check-in-champions-logo.png"
        alt=""
        width={32}
        height={32}
        unoptimized
        priority
        className={`shrink-0 object-contain ${imageClassName}`}
      />
      <span className={`font-display whitespace-nowrap leading-tight tracking-tight text-cyan-bright ${textClassName}`}>
        CHECK-IN CHAMPIONS
      </span>
    </Link>
  );
}

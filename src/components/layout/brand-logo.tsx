import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/madimadi-logo.webp"
      alt="마디마디"
      width={2172}
      height={724}
      sizes="(max-width: 640px) 192px, 160px"
      className={cn("h-auto w-32", className)}
    />
  );
}

import { Suspense } from "react";
import { KaraokeClient } from "@/app/karaoke/KaraokeClient";

export default function KaraokePage() {
  return (
    <Suspense>
      <KaraokeClient />
    </Suspense>
  );
}

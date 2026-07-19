import { Suspense } from "react";
import { PacksClient } from "@/app/packs/PacksClient";

export default function PacksPage() {
  return (
    <Suspense>
      <PacksClient />
    </Suspense>
  );
}

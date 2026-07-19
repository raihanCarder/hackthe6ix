import { DuelRoomClient } from "@/app/duel/[id]/DuelRoomClient";

export default async function DuelRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DuelRoomClient duelId={id} />;
}

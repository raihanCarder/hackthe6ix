import { KaraokeRoomClient } from "@/app/karaoke/[id]/KaraokeRoomClient";

export default async function KaraokeRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <KaraokeRoomClient duelId={id} />;
}

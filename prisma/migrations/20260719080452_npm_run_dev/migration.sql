-- DropForeignKey
ALTER TABLE "KaraokeDuel" DROP CONSTRAINT "KaraokeDuel_player2Id_fkey";

-- AddForeignKey
ALTER TABLE "KaraokeDuel" ADD CONSTRAINT "KaraokeDuel_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

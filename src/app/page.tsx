import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
        <p className="eyebrow">Matchday · live inventory</p>
        <h1 className="font-display mt-4 max-w-3xl text-4xl leading-[1.05] sm:text-6xl">
          <span className="text-chalk">HOTELS COMPETE</span>
          <br />
          <span className="text-gold-bright">FOR YOUR BOOKING.</span>
        </h1>
        <p className="mt-6 max-w-xl text-base text-chalk-dim sm:text-lg">
          Search a real trip. Open a pack of live, bookable hotel cards. Run a 16-team World Cup
          bracket where every stat comes from real listing data — then book the champion.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/search" className="btn-gold rounded-lg px-8 py-3 text-lg">
            Kick off a trip
          </Link>
          <Link href="/collection" className="btn-chalk rounded-lg px-6 py-3">
            My collection
          </Link>
        </div>
      </section>

      <div className="chalk-line" />

      <section className="grid gap-8 py-14 sm:grid-cols-3">
        {[
          {
            step: "1st half",
            title: "Open a Trip Pack",
            body: "Five collectible cards, each one a real hotel available for your dates. VIBE, LEGACY, VALUE — every stat is derived from live listing attributes.",
          },
          {
            step: "2nd half",
            title: "Run the bracket",
            body: "Sixteen contenders, four groups, knockouts. A deterministic recommendation engine scores every hotel against your answers — the drama is animated, never faked.",
          },
          {
            step: "Full time",
            title: "Book the champion",
            body: "The trophy lift is a genuine recommendation with the evidence to prove it, plus a live booking link for your exact trip.",
          },
        ].map((item) => (
          <div key={item.title} className="panel rounded-xl p-6">
            <p className="eyebrow">{item.step}</p>
            <h2 className="font-display mt-2 text-lg text-chalk">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-chalk-dim">{item.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

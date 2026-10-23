import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Petrichor collects, why, who can see it, and how to have it deleted.",
};

const CONTACT = "hello@thepetrichor.app";
const UPDATED = "October 23, 2026";

/** The privacy policy. Keep it in step with what the app actually stores and shares. */
export default function PrivacyPage() {
  return (
    <article className="mx-auto w-full max-w-2xl px-6 pt-6 pb-24">
      <h1 className="font-serif text-4xl tracking-tight">Privacy Policy</h1>
      <p className="text-muted-foreground mt-2 text-sm">Last updated {UPDATED}</p>

      <p className="mt-8 leading-relaxed">
        Petrichor (thepetrichor.app) lets you make music keepsake cards, keep them in your
        collection, and send them to others. This policy explains what we collect, why, who can see
        it, and how to have it deleted. If anything is unclear, write to us at <Mail />.
      </p>

      <Section title="What we collect">
        <List>
          <li>
            <strong>Your account.</strong> Your email address. If you sign in with Google, also your
            name and profile picture from Google. The username and display name you choose, and
            whether others can find you in search.
          </li>
          <li>
            <strong>Cards you make.</strong> The song and artist, the photo, message, signature and
            moment you add, the card&apos;s colour, the date it was made and your time zone (so the
            printed date matches your day), and who made and owns each card.
          </li>
          <li>
            <strong>Collections.</strong> The photos you upload to your collections and their
            captions.
          </li>
          <li>
            <strong>Sending cards.</strong> Who sent a card to whom, and whether it was accepted.
          </li>
          <li>
            <strong>On your device.</strong> Cookies that keep you signed in, a cookie that remembers
            your wall colour, and local storage that remembers cards you made before signing in and
            small display preferences. We don&apos;t use advertising or analytics cookies.
          </li>
        </List>
        <p className="mt-4 leading-relaxed">
          We don&apos;t collect payment details, we don&apos;t show ads, and we never sell your
          information.
        </p>
      </Section>

      <Section title="How we use it">
        <List>
          <li>To run Petrichor: show your cards, keep track of who owns them, deliver cards you send, and sign you in.</li>
          <li>
            To find a card&apos;s song on YouTube and Spotify. We send only the song&apos;s title and
            artist to their search services, never anything about you.
          </li>
          <li>To email you sign-in codes and messages about your account.</li>
        </List>
      </Section>

      <Section title="Who can see what">
        <List>
          <li>
            <strong>Cards</strong> can be seen by anyone with their link, including the photo,
            message and signature, with the owner&apos;s @username beneath. Who made a card is never
            shown, unless they signed it. A card&apos;s share image shows the card, its owner&apos;s
            @username and a QR code to its link.
          </li>
          <li>
            <strong>Your profile</strong> (username, display name and picture) can be found by
            others in recipient search, unless you turn this off in Settings.
          </li>
          <li>
            <strong>Collections</strong> can only be opened by you. Their photos are stored at long,
            unguessable addresses; anyone you give such an address to could open that photo.
          </li>
        </List>
      </Section>

      <Section title="Services we rely on">
        <List>
          <li>
            <strong>Vercel</strong> hosts the site. <strong>Neon</strong> runs our database and
            sign-in, with data stored in Singapore. <strong>Cloudflare</strong> stores photos and runs
            our domain and email. <strong>Google</strong> handles &ldquo;Sign in with Google&rdquo;.
          </li>
          <li>
            <strong>Music players.</strong> YouTube (in its privacy-enhanced mode), Spotify and Apple
            Music players load from those services when they&apos;re shown or played, and may set
            their own cookies under their own policies: <Out href="https://policies.google.com/privacy">Google</Out>,{" "}
            <Out href="https://www.spotify.com/legal/privacy-policy/">Spotify</Out> and{" "}
            <Out href="https://www.apple.com/legal/privacy/">Apple</Out>.
          </li>
          <li>
            <strong>YouTube API Services.</strong> Petrichor uses YouTube API Services to find songs
            on YouTube and play them. By using these features you agree to the{" "}
            <Out href="https://www.youtube.com/t/terms">YouTube Terms of Service</Out>, and the{" "}
            <Out href="https://policies.google.com/privacy">Google Privacy Policy</Out> applies.
            Petrichor doesn&apos;t access your YouTube account.
          </li>
        </List>
      </Section>

      <Section title="Keeping and deleting your information">
        <p className="leading-relaxed">
          Cards are keepsakes: they can&apos;t be changed once made, and we keep your account, cards
          and collections for as long as you have an account. To delete your account, along with
          the cards you own and your collections and photos, email <Mail /> from your
          account&apos;s email address. Cards you made that now belong to someone else stay theirs,
          with no link back to you.
        </p>
      </Section>

      <Section title="Your rights">
        <p className="leading-relaxed">
          You can ask us for a copy of your information, to correct it, or to delete it, by emailing{" "}
          <Mail />. Depending on where you live (for example in the EU, the UK, Singapore or
          California), you may have further rights under local law, and we&apos;ll honour them.
        </p>
      </Section>

      <Section title="Children">
        <p className="leading-relaxed">
          Petrichor isn&apos;t meant for children under 13, and we don&apos;t knowingly collect their
          information. If you think a child has given us information, email <Mail /> and we&apos;ll
          delete it.
        </p>
      </Section>

      <Section title="Changes">
        <p className="leading-relaxed">
          If we change this policy, we&apos;ll update this page and the date at the top. For
          significant changes, we&apos;ll let you know by email or on the site.
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-3 pl-5 leading-relaxed marker:text-muted-foreground">{children}</ul>;
}

function Mail() {
  return (
    <a href={`mailto:${CONTACT}`} className="underline underline-offset-2">
      {CONTACT}
    </a>
  );
}

function Out({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
      {children}
    </a>
  );
}

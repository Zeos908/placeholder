import type { Metadata } from "next";
import Link from "next/link";
import { Contact, LegalPage, List, Section } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms of Service · placeholder" };

/** Public: no sign-in required (see PUBLIC_PREFIXES in lib/supabase/proxy.ts). */
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={
        <p>
          These terms are the rules for using placeholder. By creating an account or using the app, you agree to them
          and to our{" "}
          <Link href="/privacy" className="font-semibold text-link">
            Privacy Policy
          </Link>
          . If you don&apos;t agree, please don&apos;t use placeholder.
        </p>
      }
    >
      <Section title="Who can use placeholder">
        <p>
          You must be at least 13 years old to create an account. If you&apos;re under 18, you need permission from a
          parent or guardian, who should read these terms with you.
        </p>
      </Section>

      <Section title="Your account">
        <List>
          <li>Give accurate information and keep your password private.</li>
          <li>One account per person. Don&apos;t share it or use someone else&apos;s.</li>
          <li>You&apos;re responsible for what happens on your account. Tell us if you think someone else is using it.</li>
        </List>
      </Section>

      <Section title="What placeholder is (and isn't)">
        <List>
          <li>
            placeholder helps you discover opportunities run by other organizations. We don&apos;t run those programs,
            and we can&apos;t guarantee you&apos;ll be accepted or that a listing is complete, current or accurate.
          </li>
          <li>
            Always check the original listing (the &quot;Open original listing&quot; button) for the real deadlines,
            requirements and details before you apply.
          </li>
          <li>
            Some listings in this version of the app are <strong>sample data</strong> for demonstration, and the
            organizations in them are fictional.
          </li>
        </List>
      </Section>

      <Section title="The AI assistant">
        <List>
          <li>
            The assistant can make mistakes. It is not professional, legal, financial or medical advice. Double-check
            anything important.
          </li>
          <li>There is a daily limit on questions, which resets at midnight in your time zone.</li>
          <li>Don&apos;t share sensitive personal information (such as passwords or ID numbers) in chats.</li>
        </List>
      </Section>

      <Section title="Be respectful">
        <p>When you use placeholder, don&apos;t:</p>
        <List>
          <li>Harass, bully, threaten or impersonate anyone.</li>
          <li>Post or share anything hateful, sexual, violent, illegal or otherwise inappropriate, including in your username, bio, photo or messages.</li>
          <li>Send spam or scams, or share listings you know are fake.</li>
          <li>Try to break, overload, scrape or get around the app&apos;s security or limits.</li>
          <li>Use the app for anything illegal.</li>
        </List>
        <p>
          You can block or report anyone. We may remove content, hide listings, or suspend or delete accounts that break
          these rules.
        </p>
      </Section>

      <Section title="Your content">
        <p>
          You own what you add to placeholder, such as your profile, photo and messages. You give us permission to store
          and display it as needed to run the app, for example showing your profile to other users or a shared post to
          the friend you sent it to. That permission ends when you delete the content or your account.
        </p>
      </Section>

      <Section title="Other people's content and links">
        <p>
          Listings link to other websites that we don&apos;t control and aren&apos;t responsible for. Photos and videos
          in posts come from openly licensed or free-to-use sources and belong to their creators, who are credited on
          each listing.
        </p>
      </Section>

      <Section title="Ending your account">
        <p>
          You can delete your account at any time in Settings → Delete account. We may suspend or end accounts that
          break these terms, or if we stop running the app.
        </p>
      </Section>

      <Section title="Disclaimers">
        <p>
          placeholder is a student-built project provided &quot;as is&quot; and &quot;as available.&quot; Features may
          change, break or stop working, and the app may be unavailable at times. To the fullest extent allowed by law,
          we make no warranties of any kind, and we aren&apos;t liable for losses from using the app, including missed
          deadlines or decisions made based on listings or AI answers.
        </p>
      </Section>

      <Section title="Changes to these terms">
        <p>
          If we change these terms, we&apos;ll update the date at the top. For significant changes, we&apos;ll also let
          you know in the app. Continuing to use placeholder means you accept the updated terms.
        </p>
      </Section>

      <Section title="Contact">
        <Contact />
      </Section>
    </LegalPage>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Contact, LegalPage, List, Section } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · placeholder" };

/** Public: no sign-in required (see PUBLIC_PREFIXES in lib/supabase/proxy.ts). */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <>
          <p>
            placeholder helps high school and college students find internships, volunteering, events and scholarships.
            This policy explains what information the app collects, how it&apos;s used, who can see it, and the choices
            you have. placeholder is a student-built project. We keep the data we collect to what the app needs to work,
            and we never sell it or use it for advertising.
          </p>
        </>
      }
    >
      <Section title="Information you give us">
        <List>
          <li>
            <strong>Account details.</strong> Your email address and password (passwords are stored only in hashed form
            by our authentication provider). If you sign in with Google, we receive your name, email address and profile
            photo from Google.
          </li>
          <li>
            <strong>Guest accounts.</strong> If you choose &quot;Continue as guest,&quot; we create an account with no
            email or password, tied to your browser&apos;s sign-in cookie. Guests are hidden from other users and
            can&apos;t use friend or sharing features. Signing out ends the guest session, and its data can no longer be
            reached.
          </li>
          <li>
            <strong>Profile.</strong> Your username, plus anything you choose to add: display name, profile photo, grade
            or year, school, zip code and search radius, interests, skills and a short bio. Everything except your
            username is optional.
          </li>
          <li>
            <strong>Activity in the app.</strong> Opportunities you view, save or pass on, your application status for
            saved items, items you hide from friends, reminders and checklists.
          </li>
          <li>
            <strong>AI assistant chats.</strong> Questions you ask the assistant about a saved opportunity, and its
            answers.
          </li>
          <li>
            <strong>Friends and sharing.</strong> Friend requests, your friends list, posts you share and any message you
            add, people you block, and reports you send.
          </li>
          <li>
            <strong>Settings.</strong> Your theme, time zone, whether friends can see your saves, and, if you turn them
            on, push notification details for your device.
          </li>
        </List>
      </Section>

      <Section title="Information collected automatically">
        <List>
          <li>
            <strong>Sign-in cookies</strong> that keep you logged in. We don&apos;t use advertising cookies, analytics
            trackers or third-party ad networks.
          </li>
          <li>
            <strong>Settings stored on your device</strong> (such as sound effects and which badges you&apos;ve already
            seen), kept in your browser&apos;s local storage.
          </li>
          <li>
            <strong>Basic technical logs</strong>, such as IP address and request times, kept by our hosting and database
            providers to run and secure the service.
          </li>
        </List>
      </Section>

      <Section title="How we use your information">
        <List>
          <li>
            To build your feed: ranking opportunities by your interests, grade, distance and the posts you save or pass
            on.
          </li>
          <li>To run friend features: requests, activity, shared posts, and showing which friends saved something.</li>
          <li>To send the reminders and notifications you ask for.</li>
          <li>To answer your questions in the AI assistant.</li>
          <li>
            To keep people safe: handling reports and blocks, and automatically hiding listings that several people
            report.
          </li>
          <li>To keep the app working, secure and free of abuse.</li>
        </List>
      </Section>

      <Section title="Who can see what">
        <List>
          <li>
            <strong>Other signed-in users</strong> can see your public profile: username, display name, profile photo,
            school, grade, interests and bio. People you&apos;ve blocked, or who have blocked you, can&apos;t see you at
            all.
          </li>
          <li>
            <strong>Your friends</strong> can see the opportunities you save and your application progress, unless you
            turn off &quot;Share my saves with friends&quot; or hide a specific item.
          </li>
          <li>
            <strong>Nobody else</strong> ever sees your email address, zip code, location, skills, AI chats, reminders or
            checklists.
          </li>
        </List>
      </Section>

      <Section title="Services we rely on">
        <p>We share information with these providers only as needed to run placeholder:</p>
        <List>
          <li>
            <strong>Supabase</strong> stores the app&apos;s database, handles sign-in, stores uploaded photos and sends
            account emails.
          </li>
          <li>
            <strong>Render</strong> hosts the app.
          </li>
          <li>
            <strong>NVIDIA</strong> runs the AI model behind the assistant. When you ask a question, we send it the
            opportunity&apos;s details, your question, recent messages from that chat, the profile fields you filled in
            (name, grade, school, interests, skills, bio), and the titles, deadlines and statuses of up to 20 of your
            other saved items. We never send your email address, zip code or location.
          </li>
          <li>
            <strong>Google</strong>, only if you choose to sign in with Google.
          </li>
          <li>
            <strong>Zippopotam.us</strong> receives only your zip code, to look up its approximate coordinates for
            distance filtering.
          </li>
          <li>
            <strong>Your browser&apos;s push service</strong> (for example Google, Apple or Mozilla), only if you turn
            on push notifications.
          </li>
          <li>
            <strong>Photo and video sources.</strong> Some post images load directly from their original hosts (such as
            Flickr and StockSnap), which, like any website image, can see your IP address. Credits are shown on each
            listing.
          </li>
        </List>
        <p>
          We may also disclose information if required by law, or to protect the safety of our users or others.
        </p>
      </Section>

      <Section title="Keeping and deleting your data">
        <p>
          We keep your information for as long as your account exists. You can delete your account at any time in{" "}
          <strong>Settings → Delete account</strong>. This permanently deletes your profile, uploaded photo, saves,
          chats, reminders, checklists, friendships, shares and notifications. Copies in our providers&apos; backups are
          removed on their normal backup schedule. Reports other people filed about your account may be kept so we can
          keep the community safe.
        </p>
      </Section>

      <Section title="Your choices">
        <List>
          <li>Edit or clear any optional profile field in Settings → Edit profile.</li>
          <li>Turn &quot;Share my saves with friends&quot; off, or hide individual saved items.</li>
          <li>Block or report anyone, and manage blocked users in Settings.</li>
          <li>Turn push notifications on or off for each device.</li>
          <li>Delete your account and its data at any time.</li>
        </List>
      </Section>

      <Section title="Children and teens">
        <p>
          placeholder is not meant for children under 13, and they may not create an account. If we learn that someone
          under 13 has signed up, we will delete the account and its data. If you&apos;re under 18, please review this
          policy with a parent or guardian before using the app.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Data is encrypted in transit (HTTPS), and the database only lets each user reach their own private data. No
          system is perfectly secure, so please use a strong, unique password and tell us if you notice anything wrong.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          If we change this policy, we&apos;ll update the date at the top. For significant changes, we&apos;ll also let
          you know in the app.
        </p>
      </Section>

      <Section title="Contact">
        <Contact />
        <p>
          See also our{" "}
          <Link href="/terms" className="font-semibold text-link">
            Terms of Service
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  );
}

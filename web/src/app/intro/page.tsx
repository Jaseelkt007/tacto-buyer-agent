import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./intro.css";

export const metadata: Metadata = {
  title: "Meet ProcuDeal · Every Move, A Reason",
  description: "ProcuDeal helps manufacturers cut procurement costs through autonomous, evidence-backed negotiations with transparent, explainable decisions.",
};

const team = [
  { name: "Siddharth Pachpor", photo: "/team/siddharth.png", width: 302, height: 436,
    qualifications: ["MBA (FSFM, Stanford)", "M.Sc. TU Berlin"] },
  { name: "Mohammed Jaseel", photo: "/team/jaseel.png", width: 650, height: 908,
    qualifications: ["M.Sc. Universität Stuttgart"] },
];

export default function Intro() {
  return (
    <main className="intro-page">
      <div className="intro-canvas">
        <header className="intro-masthead">
          <Link href="/" className="intro-brand">ProcuDeal<span>.</span></Link>
          <span className="intro-kicker">MEET THE TEAM</span>
        </header>
        <section className="intro-stage" aria-labelledby="intro-title">
          <div className="intro-message">
            <p className="intro-eyebrow"><span /> AUTONOMOUS PROCUREMENT</p>
            <h1 id="intro-title">Every Move,<br /><span>A Reason.</span></h1>
            <p className="intro-description">ProcuDeal helps manufacturers <strong>cut procurement costs</strong> through <strong>autonomous, evidence-backed negotiations</strong> with transparent, explainable decisions.</p>
            <div className="intro-actions">
              <Link href="/" className="intro-primary">See our results <span aria-hidden="true">↗</span></Link>
              <Link href="/demo" className="intro-secondary">Start the demo <span aria-hidden="true">→</span></Link>
            </div>
          </div>
          <div className="intro-team" aria-label="The ProcuDeal team">
            {team.map((person) => (
              <article key={person.name} className="intro-person">
                <div className="intro-portrait">
                  <Image src={person.photo} alt={person.name} width={person.width} height={person.height} sizes="(max-width: 540px) 80vw, (max-width: 1050px) 40vw, 25vw" />
                </div>
                <div className="intro-person-info">
                  <h2>{person.name}</h2>
                  {person.qualifications.map((qualification) => <p key={qualification}>{qualification}</p>)}
                </div>
              </article>
            ))}
          </div>
        </section>
        <footer className="intro-footer">
          <span>Built for manufacturers.</span>
          <div><span>Autonomous negotiations</span><span>Evidence-backed offers</span><span>Explainable decisions</span></div>
        </footer>
      </div>
    </main>
  );
}

import React from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { usePublicSiteText } from '../publicSiteI18n';

const FALLBACK_COPY = {
  title: 'Chivi voice: ask for what you need to play.',
  text: 'Talk to the app in simple words. Chivi understands your request, guides you and takes you to the next step without making you browse every screen.',
  'items.ask.title': 'Ask a question',
  'items.ask.text': 'Tap the microphone and speak as you would to a person.',
  'items.guide.title': 'Ask for help to play',
  'items.guide.text': 'Ask about courts, open matches or upcoming tournaments.',
  'items.result.title': 'Follow the next step',
  'items.result.text': 'Chivi replies in text and guides you inside the experience.',
  note: 'Microphone use requires your permission and depends on each device\'s compatibility.',
  demoLabel: 'CHIVI · VOICE ASSISTANT',
  demoPrompt: '“Find me a court tomorrow around 8 PM.”',
  demoAnswer: 'I can help you find options and continue with the booking.',
};

function VoiceWave() {
  return (
    <div className="ps-voice-visual" aria-hidden="true">
      <div className="ps-voice-visual__halo" />
      <div className="ps-voice-visual__mic">⌁</div>
      <div className="ps-voice-visual__wave">
        {Array.from({ length: 13 }, (_, index) => <i key={index} />)}
      </div>
    </div>
  );
}

export default function VoiceAssistantSection() {
  const config = PUBLIC_SITE_SECTIONS.voice;
  const translate = usePublicSiteText();
  const text = (key) => {
    const value = translate(`publicSite.voice.${key}`);
    return value === `publicSite.voice.${key}` ? FALLBACK_COPY[key] : value;
  };

  return (
    <section id={config.id} className="ps-section ps-section--voice" aria-labelledby="ps-voice-title">
      <div className="public-site__shell">
        <div className="ps-voice-layout">
          <div>
            <header className="ps-section__intro">
              <p className="ps-section__eyebrow">{text('demoLabel')}</p>
              <h2 id="ps-voice-title">{text('title')}</h2>
              <p>{text('text')}</p>
            </header>
            <div className="ps-voice-cards">
              {config.items.map(({ key }, index) => (
                <article className="ps-voice-card" key={key} data-ps-reveal data-ps-reveal-order={index}>
                  <span className="ps-voice-card__number" aria-hidden>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                  <h3>{text(`items.${key}.title`)}</h3>
                  <p>{text(`items.${key}.text`)}</p>
                  </div>
                </article>
              ))}
            </div>
            <p className="ps-voice-note">{text('note')}</p>
          </div>
          <div className="ps-voice-demo" data-ps-reveal data-ps-reveal-order="3">
            <VoiceWave />
            <p className="ps-voice-demo__label">{text('demoLabel')}</p>
            <p className="ps-voice-demo__prompt">{text('demoPrompt')}</p>
            <p className="ps-voice-demo__answer">{text('demoAnswer')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

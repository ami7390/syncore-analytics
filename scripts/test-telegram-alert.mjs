import { isPerformanceDrop, sendTelegramMessage } from './telegram-alerts.mjs';

const previous = 100;
const current = 60;
if (!isPerformanceDrop(previous, current)) {
  throw new Error('Echec du test du seuil de baisse de performance');
}
await sendTelegramMessage([
  '🧪 TEST — Syncore Analytics',
  'Simulation de baisse de performance (aucun audit reel modifie)',
  'Score Lighthouse fictif : 100 → 60',
  'Baisse simulee : 40 points',
  'Detection du seuil : OK',
  'Envoi Telegram depuis GitHub Actions : OK',
  'Ceci est un test, aucune intervention necessaire.',
].join('\n'));
console.log('Telegram simulation alert sent successfully.');

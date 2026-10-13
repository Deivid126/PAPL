/**
 * Síntese de fala para a aplicação do protocolo.
 *
 * Navegadores de tablet e celular só executam speechSynthesis a partir de
 * um gesto do usuário. Como a pergunta é lida automaticamente ao entrar no
 * item, sem nenhum toque naquele instante, a chamada seria descartada.
 *
 * A saída é destravar o motor no primeiro toque da sessão, em qualquer
 * lugar do aplicativo — por isso o listener é instalado na raiz, e não na
 * tela da tarefa: quando o avaliador chega ao teste já tocou na tela
 * várias vezes, e esses toques é que liberam a fala.
 */

type SpeakOptions = {
  rate?: number;
  pitch?: number;
};

const LANG = 'pt-BR';

let primed = false;

export function supportsSpeech(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Escolhe uma voz em português quando houver.
 *
 * Em Android as vozes carregam de forma assíncrona e getVoices() costuma
 * vir vazio nas primeiras chamadas; nesse caso falamos sem voz explícita
 * e o motor resolve pelo lang do enunciado.
 */
function pickVoice(): SpeechSynthesisVoice | null {
  try {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;
    return (
      voices.find((v) => v.lang?.replace('_', '-') === LANG) ??
      voices.find((v) => v.lang?.toLowerCase().startsWith('pt')) ??
      null
    );
  } catch {
    return null;
  }
}

/**
 * Destrava o motor de fala dentro de um gesto do usuário.
 *
 * O enunciado tem um espaço, e não string vazia: enunciado vazio é
 * descartado por vários motores, e aí o desbloqueio não acontece.
 */
export function primeSpeech(): void {
  if (primed || !supportsSpeech()) return;
  primed = true;
  try {
    const synth = window.speechSynthesis;
    synth.resume();
    const warmup = new SpeechSynthesisUtterance(' ');
    warmup.lang = LANG;
    warmup.volume = 0;
    synth.speak(warmup);
    // Algumas versões do Chrome em Android deixam a fila presa depois do
    // aquecimento; o resume seguinte a libera.
    synth.resume();
  } catch {
    // Sem fala disponível: o botão de ouvir na tela continua valendo.
  }
}

/** Instala o desbloqueio no primeiro gesto da sessão. */
export function installSpeechPriming(): void {
  if (!supportsSpeech()) return;
  const events: Array<keyof DocumentEventMap> = ['pointerdown', 'touchstart', 'keydown'];
  const handler = () => {
    primeSpeech();
    for (const event of events) {
      document.removeEventListener(event, handler, true);
    }
  };
  for (const event of events) {
    document.addEventListener(event, handler, { capture: true, passive: true });
  }
}

/**
 * Espera as vozes aparecerem.
 *
 * Em Android a lista carrega de forma assíncrona e as primeiras chamadas
 * a getVoices() voltam vazias. Falar nesse intervalo é descartado em
 * silêncio, que foi o que aconteceu no tablet.
 */
function whenVoicesReady(callback: () => void): void {
  try {
    const synth = window.speechSynthesis;
    if (synth.getVoices().length > 0) {
      callback();
      return;
    }
    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      synth.removeEventListener?.('voiceschanged', run);
      callback();
    };
    synth.addEventListener?.('voiceschanged', run);
    // Alguns aparelhos nunca disparam o evento, e outros não têm nenhuma
    // voz instalada. Tentamos mesmo assim: sem voz explícita o motor pode
    // resolver pelo lang do enunciado.
    window.setTimeout(run, 1200);
  } catch {
    callback();
  }
}

/** Último erro de fala observado, para diagnóstico na própria tela. */
let lastError: string | null = null;

export function getSpeechError(): string | null {
  return lastError;
}

/** Lê um texto em voz alta, se o navegador permitir. */
export function speak(text: string, options: SpeakOptions = {}): void {
  if (!supportsSpeech() || !text.trim()) return;
  whenVoicesReady(() => {
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      // O Chrome em Android pode manter a fila pausada após a aba voltar
      // do segundo plano; sem isto o enunciado entra na fila e nunca toca.
      synth.resume();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = LANG;
      utterance.rate = options.rate ?? 0.85;
      utterance.pitch = options.pitch ?? 1.05;
      const voice = pickVoice();
      if (voice) utterance.voice = voice;
      utterance.onerror = (event) => {
        lastError = (event as SpeechSynthesisErrorEvent).error ?? 'desconhecido';
      };
      utterance.onstart = () => {
        lastError = null;
      };
      synth.speak(utterance);
      synth.resume();
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'falha ao falar';
    }
  });
}

/** Resumo do estado da fala no aparelho, para apoio ao diagnóstico. */
export function describeSpeechSupport(): {
  suportado: boolean;
  vozes: number;
  vozesPt: string[];
  erro: string | null;
} {
  if (!supportsSpeech()) {
    return { suportado: false, vozes: 0, vozesPt: [], erro: 'sem speechSynthesis' };
  }
  let voices: SpeechSynthesisVoice[] = [];
  try {
    voices = window.speechSynthesis.getVoices() ?? [];
  } catch {
    voices = [];
  }
  return {
    suportado: true,
    vozes: voices.length,
    vozesPt: voices
      .filter((v) => v.lang?.toLowerCase().startsWith('pt'))
      .map((v) => `${v.name} (${v.lang})`),
    erro: lastError,
  };
}

/** Interrompe qualquer leitura em andamento. */
export function cancelSpeech(): void {
  if (!supportsSpeech()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // nada a fazer
  }
}

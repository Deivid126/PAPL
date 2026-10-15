import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import { cancelSpeech, speak, speechUnavailable } from '../lib/speech';
import type {
  Application,
  ApplicationItem,
  ApplicationResult,
  ProtocolStep,
  ProtocolSubstep,
} from '../lib/types';
import { Alert, Modal, ProgressBar, Spinner } from '../components/ui';
import { IconArrowLeft, IconArrowRight, IconClock, IconSave } from '../components/Icons';
import { formatDate } from '../lib/format';
import { resumeCursor } from '../lib/resume';

interface Unit {
  itemNumber: number;
  substep: ProtocolSubstep;
  prompt: string | null;
  expectedAnswer: string | null;
  responseType: string;
  isPending: boolean;
  imageKey: string | null;
}

function buildUnits(stepNumber: number, protocol: ProtocolStep[]): Unit[] {
  const step = protocol.find((s) => s.stepNumber === stepNumber);
  if (!step) return [];
  let global = 0;
  const units: Unit[] = [];
  for (const sub of step.substeps) {
    for (const item of sub.items) {
      global += 1;
      units.push({
        itemNumber: global,
        substep: sub,
        prompt: item.prompt,
        expectedAnswer: item.expectedAnswer,
        responseType: item.responseType,
        isPending: item.isPending,
        imageKey: item.imageKey,
      });
    }
  }
  return units;
}

interface UnitState {
  prompt: string;
  expectedAnswer: string;
  childAnswer: string;
  isCorrect: boolean | null;
  notes: string;
  responseTimeMs: number | null;
}

function itemToState(item: ApplicationItem | undefined): UnitState {
  return {
    prompt: item?.prompt ?? '',
    expectedAnswer: item?.expectedAnswer ?? '',
    childAnswer: item?.childAnswer ?? '',
    isCorrect: item?.isCorrect ?? null,
    notes: item?.notes ?? '',
    responseTimeMs: item?.responseTimeMs ?? null,
  };
}

const SKILL_LABELS: Record<string, string> = {
  conhecimento_alfabeto: 'Conhecimento do alfabeto',
  habilidades_metafonologicas: 'Habilidades metafonológicas',
  memoria_operacional_fonologica: 'Memória operacional fonológica',
  nomeacao_automatica_rapida: 'Nomeação automática rápida',
  compreensao_auditiva_sentencas: 'Compreensão auditiva de sentenças',
};

const timersRef: Record<string, { start: number }> = {};

const EMPTY_STATE: UnitState = {
  prompt: '',
  expectedAnswer: '',
  childAnswer: '',
  isCorrect: null,
  notes: '',
  responseTimeMs: null,
};

const VOWELS = ['A', 'E', 'I', 'O', 'U'];
const CONSONANTS = ['B', 'C', 'D', 'F', 'G', 'J', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'V', 'X', 'Z'];

/**
 * Embaralha de verdade (Fisher-Yates).
 *
 * sort(() => Math.random() - 0.5) parece aleatório mas é enviesado: o
 * comparador é inconsistente e, com poucos itens, a ordem original tende
 * a sobreviver. Num teste em que a posição da figura certa não pode
 * carregar informação, esse viés falseia a medida.
 */
function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function ApplicationRunPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [app, setApp] = useState<Application | null>(null);
  const [protocol, setProtocol] = useState<ProtocolStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [alphabetPhase, setAlphabetPhase] = useState<'TRAINING' | 'TEST'>('TRAINING');
  const [alphabetGroup, setAlphabetGroup] = useState(1);
  const [alphabetIndex, setAlphabetIndex] = useState(0);
  const [synthesisPhase, setSynthesisPhase] = useState<'TRAINING' | 'TEST'>('TRAINING');
  const [synthesisIndex, setSynthesisIndex] = useState(0);
  const [segmentationPhase, setSegmentationPhase] = useState<'TRAINING' | 'TEST'>('TRAINING');
  const [segmentationIndex, setSegmentationIndex] = useState(0);
  const [phonemePhase, setPhonemePhase] = useState<'TRAINING' | 'TEST'>('TRAINING');
  const [phonemeIndex, setPhonemeIndex] = useState(0);
  const [productionPhase, setProductionPhase] = useState<'TRAINING' | 'TEST'>('TRAINING');
  const [productionIndex, setProductionIndex] = useState(0);
  const [comprehensionPhase, setComprehensionPhase] = useState<'TRAINING' | 'TEST'>('TRAINING');
  const [comprehensionIndex, setComprehensionIndex] = useState(0);
  const [step2Substep, setStep2Substep] = useState<1 | 2 | 3 | 4>(1);
  const [states, setStates] = useState<Record<string, UnitState>>({});
  const statesRef = useRef(states);
  statesRef.current = states;
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [stepStatus, setStepStatus] = useState<string>('NOT_STARTED');
  const [confirmStepOpen, setConfirmStepOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedSignaturesRef = useRef<Record<string, string>>({});
  const flushChainRef = useRef<Promise<void>>(Promise.resolve());
  const resumeStepRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [appRes, protocolRes] = await Promise.all([
        api<Application>(`/applications/${id}`),
        api<ProtocolStep[]>('/protocol/steps'),
      ]);
      setApp(appRes);
      setProtocol(protocolRes);
      const cursor = resumeCursor(appRes, protocolRes);
      if (cursor) {
        resumeStepRef.current = cursor.stepNumber;
        setCurrentStep(Math.min(Math.max(cursor.stepNumber, 1), 5));
        if (cursor.stepNumber === 1) {
          setAlphabetGroup(cursor.substepOrder);
          setAlphabetPhase('TEST');
          setAlphabetIndex(cursor.localIndex);
        } else if (cursor.stepNumber === 2) {
          setStep2Substep(Math.min(Math.max(cursor.substepOrder, 1), 4) as 1 | 2 | 3 | 4);
          if (cursor.substepOrder === 1) {
            setSynthesisPhase('TEST');
            setSynthesisIndex(cursor.localIndex);
          } else if (cursor.substepOrder === 2) {
            setSegmentationPhase('TEST');
            setSegmentationIndex(cursor.localIndex);
          } else if (cursor.substepOrder === 3) {
            setPhonemePhase('TEST');
            setPhonemeIndex(cursor.localIndex);
          } else {
            setProductionPhase('TEST');
            setProductionIndex(cursor.localIndex);
          }
        } else if (cursor.stepNumber === 4) {
          setComprehensionPhase('TEST');
          setComprehensionIndex(cursor.unitIndex);
        }
      } else {
        setCurrentStep(Math.min(Math.max(appRes.currentStep, 1), 5));
      }
      setStepStatus(appRes.steps?.find((s) => s.stepNumber === (cursor?.stepNumber ?? appRes.currentStep))?.status ?? 'NOT_STARTED');
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (resumeStepRef.current === currentStep) {
      resumeStepRef.current = null;
      return;
    }
    resumeStepRef.current = null;
    setAlphabetPhase('TRAINING');
    setAlphabetGroup(1);
    setAlphabetIndex(0);
    setSynthesisPhase('TRAINING');
    setSynthesisIndex(0);
    setSegmentationPhase('TRAINING');
    setSegmentationIndex(0);
    setPhonemePhase('TRAINING');
    setPhonemeIndex(0);
    setProductionPhase('TRAINING');
    setProductionIndex(0);
    setComprehensionPhase('TRAINING');
    setComprehensionIndex(0);
    setStep2Substep(1);
  }, [currentStep]);

  const units = useMemo(
    () => (protocol.length > 0 ? buildUnits(currentStep, protocol) : []),
    [protocol, currentStep],
  );

  const alphabetGroups = useMemo(() => {
    const groups = new Map<number, Unit[]>();
    for (const unit of units) {
      const order = unit.substep.order;
      groups.set(order, [...(groups.get(order) ?? []), unit]);
    }
    return [...groups.entries()].sort(([a], [b]) => a - b).map(([, group]) => group);
  }, [units]);

  const synthesisUnits = useMemo(
    () => units.filter((unit) => unit.substep.order === 1),
    [units],
  );

  const segmentationUnits = useMemo(
    () => units.filter((unit) => unit.substep.order === 2),
    [units],
  );

  const phonemeUnits = useMemo(
    () => units.filter((unit) => unit.substep.order === 3),
    [units],
  );

  const productionUnits = useMemo(
    () => units.filter((unit) => unit.substep.order === 4),
    [units],
  );

  const currentStepData = useMemo(
    () => app?.steps?.find((s) => s.stepNumber === currentStep) ?? null,
    [app, currentStep],
  );

  const isTimerStep = currentStep === 3;

  // Destinos de navegação rápida: cada subetapa do protocolo + revisão.
  const jumpTargets = useMemo(() => {
    const targets: Array<{ stepNumber: number; substepOrder: number | null; label: string }> = [];
    for (const step of protocol) {
      for (const sub of step.substeps) {
        targets.push({
          stepNumber: step.stepNumber,
          substepOrder: sub.order,
          label: `${step.stepNumber}.${sub.order} ${sub.title.replace(/^\d+\.\d+\s*/, '')}`,
        });
      }
    }
    targets.sort((a, b) => a.stepNumber - b.stepNumber || (a.substepOrder ?? 0) - (b.substepOrder ?? 0));
    targets.push({ stepNumber: 5, substepOrder: null, label: 'Revisão e finalização' });
    return targets;
  }, [protocol]);

  // Inicializa os estados locais quando o step/application carrega
  useEffect(() => {
    if (!app || !currentStepData) return;
    const next: Record<string, UnitState> = {};
    for (const unit of units) {
      const existing = currentStepData.items.find((i) => i.itemNumber === unit.itemNumber);
      next[String(unit.itemNumber)] = itemToState(existing);
    }
    setStates((prev) => {
      const merged = { ...prev };
      for (const k of Object.keys(next)) {
        merged[k] = next[k] as UnitState;
      }
      return merged;
    });
    setStepStatus(currentStepData.status);
  }, [app, currentStepData, units, currentStep]);

  function setUnit(itemNumber: number, patch: Partial<UnitState>) {
    setStates((prev) => {
      const cur = prev[String(itemNumber)] ?? itemToState(undefined);
      return { ...prev, [String(itemNumber)]: { ...cur, ...patch } };
    });
    queueSave();
  }

  function queueSave() {
    setSaving(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void flushAll();
    }, 900);
  }

  /**
   * Enfileira um flush, garantindo que nunca haja dois em andamento.
   *
   * Ao trocar de item dentro da mesma etapa a navegacao nao espera por
   * ele: a tela avanca na hora e a gravacao corre atras, porque a espera
   * de uma ida a rede por item era o que travava a aplicacao. Nas trocas
   * de subetapa e de etapa o flush continua aguardado, ja que ali units e
   * stepNumber mudam e uma gravacao pendente escreveria no lugar errado.
   *
   * flushAll é disparado tanto pelo timer de queueSave quanto por cada
   * botão de avançar. Sem serializar, duas execuções percorrem os itens
   * ao mesmo tempo e ambas leem a assinatura antiga em
   * savedSignaturesRef — que só é gravada depois do await da rede. O
   * resultado é cada resposta sendo enviada em duplicidade, numa rajada
   * que escala as instâncias serverless e esgota as conexões do banco.
   */
  function flushAll(): Promise<void> {
    const next = flushChainRef.current.then(runFlush, runFlush);
    flushChainRef.current = next.catch(() => undefined);
    return next;
  }

  async function runFlush() {
    if (!app) return;
    const stepNumber = currentStep;
    const latest = statesRef.current;

    // Monta tudo que mudou e envia numa requisição só. Antes cada item ia
    // num POST separado, com um await por item: ~255ms de rede vezes o
    // número de itens da etapa, travando o avanço por vários segundos.
    const pending: Array<{
      saveKey: string;
      signature: string;
      body: Record<string, unknown>;
    }> = [];

    for (const unit of units) {
      const st = latest[String(unit.itemNumber)];
      if (!st) continue;
      const saveKey = `${stepNumber}:${unit.itemNumber}`;

      if (isTimerStep) {
        if (st.responseTimeMs == null) continue;
        const signature = JSON.stringify([st.childAnswer, st.isCorrect, st.responseTimeMs, st.notes]);
        if (savedSignaturesRef.current[saveKey] === signature) continue;
        pending.push({
          saveKey,
          signature,
          body: {
            itemNumber: unit.itemNumber,
            childAnswer: st.childAnswer || undefined,
            isCorrect: st.isCorrect ?? undefined,
            responseTimeMs: st.responseTimeMs,
            notes: st.notes || undefined,
          },
        });
      } else {
        const touched =
          st.childAnswer !== '' ||
          st.isCorrect !== null ||
          st.notes !== '' ||
          st.prompt !== (unit.prompt ?? '') ||
          st.expectedAnswer !== (unit.expectedAnswer ?? '');
        if (!touched) continue;
        const signature = JSON.stringify([st.prompt, st.expectedAnswer, st.childAnswer, st.isCorrect, st.notes]);
        if (savedSignaturesRef.current[saveKey] === signature) continue;
        pending.push({
          saveKey,
          signature,
          body: {
            itemNumber: unit.itemNumber,
            prompt: st.prompt || undefined,
            expectedAnswer: st.expectedAnswer || undefined,
            childAnswer: st.childAnswer || undefined,
            isCorrect: st.isCorrect ?? undefined,
            score: st.isCorrect === true ? 1 : st.isCorrect === false ? 0 : undefined,
            notes: st.notes || undefined,
          },
        });
      }
    }

    if (pending.length === 0) {
      setSaving(false);
      return;
    }

    try {
      await api(`/applications/${app.id}/steps/${stepNumber}/items/batch`, {
        method: 'POST',
        body: JSON.stringify({ items: pending.map((p) => p.body) }),
      });
      // Só marca como salvo depois do aceite do servidor.
      for (const p of pending) savedSignaturesRef.current[p.saveKey] = p.signature;
      setSaving(false);
      setSavedAt(new Date().toLocaleTimeString('pt-BR'));
    } catch (err) {
      setSaving(false);
      setModalError(`Não foi possível salvar esta resposta. ${errorMessage(err)}`);
    }
  }

  async function saveApplicationStep(stepNumber: number) {
    await api(`/applications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ currentStep: stepNumber }),
    });
  }

  function requestNext() {
    if (isTimerStep) {
      const timerUnit = units[0];
      const st = states[String(timerUnit.itemNumber)];
      if (st?.responseTimeMs == null) {
        setModalError('Finalize o cronômetro antes de continuar ou registre o tempo manualmente.');
        return;
      }
    }
    setConfirmStepOpen(true);
  }

  async function handleNext() {
    try {
      setConfirmStepOpen(false);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      await flushAll();
      await api(`/applications/${id}/steps/${currentStep}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'COMPLETED' }),
      });
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      await saveApplicationStep(nextStep);
      setStepStatus('NOT_STARTED');
    } catch (err) {
      setModalError(errorMessage(err));
    }
  }

  async function handleBack() {
    // Voltar anda para tras dentro do teste; quem sai da aplicacao e'
    // "Salvar e sair". No primeiro item do protocolo nao ha para onde ir.
    if (currentStep <= 1) return;
    try {
      await flushAll();
      const prev = currentStep - 1;
      setCurrentStep(prev);
      await saveApplicationStep(prev);
    } catch (err) {
      setModalError(errorMessage(err));
    }
  }

  /**
   * Retrocede um passo dentro da tarefa atual.
   *
   * A ordem espelha a do avanco: item anterior; do inicio da prova para o
   * ultimo exemplo do treino; e so no inicio do treino e' que a navegacao
   * cruza para a subetapa anterior, via onStart.
   */
  async function stepBack(options: {
    phase: 'TRAINING' | 'TEST';
    index: number;
    trainingCount: number;
    setPhase: (phase: 'TRAINING' | 'TEST') => void;
    setIndex: (updater: (index: number) => number) => void;
    onStart: () => void | Promise<void>;
  }) {
    const { phase, index, trainingCount, setPhase, setIndex, onStart } = options;
    try {
      if (index > 0) {
        if (phase === 'TEST') void flushAll();
        setIndex((current) => current - 1);
        return;
      }
      if (phase === 'TEST') {
        await flushAll();
        setPhase('TRAINING');
        setIndex(() => Math.max(0, trainingCount - 1));
        return;
      }
      await onStart();
    } catch (err) {
      setModalError(errorMessage(err));
    }
  }

  async function handleSaveAndExit() {
    try {
      await flushAll();
      await saveApplicationStep(currentStep);
      await api(`/applications/${id}/steps/${currentStep}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'IN_PROGRESS' }),
      });
      navigate('/dashboard');
    } catch (err) {
      setModalError(errorMessage(err));
    }
  }

  async function handleFinalize(confirmIncomplete: boolean) {
    try {
      const res = await api<ApplicationResult>(`/applications/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ confirmIncomplete }),
      });
      navigate(`/applications/${id}/result`, { state: { result: res } });
    } catch (err) {
      if (err instanceof Error && (err as { status?: number }).status === 400) {
        setModalError('Existem etapas incompletas. Confirme a finalização para prosseguir mesmo assim.');
      } else {
        setModalError(errorMessage(err));
      }
    }
  }

  if (loading) return <Spinner label="Carregando aplicação" />;

  if (error && !app) {
    return (
      <div className="page">
        <Alert variant="error">{error}</Alert>
        <Link className="btn btn-secondary" to="/dashboard">
          Voltar ao dashboard
        </Link>
      </div>
    );
  }

  if (!app) return null;

  const isReview = currentStep > 4;

  // Salta para uma subetapa: entra na prova no primeiro item sem resposta
  // quando a subetapa já tem respostas salvas; senão, começa no treino.
  async function jumpTo(target: { stepNumber: number; substepOrder: number | null }) {
    try {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      await flushAll();
      const stepNumber = target.stepNumber;
      if (stepNumber !== currentStep) {
        await saveApplicationStep(stepNumber);
        setCurrentStep(stepNumber);
      }
      if (currentStepData && currentStepData.status !== 'COMPLETED') {
        await api(`/applications/${id}/steps/${currentStep}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'IN_PROGRESS' }),
        });
        setStepStatus('IN_PROGRESS');
      }
      if (stepNumber === 5) return;
      const nextStep = protocol.find((s) => s.stepNumber === stepNumber);
      const sub = target.substepOrder == null ? null : nextStep?.substeps.find((s) => s.order === target.substepOrder);
      if (!sub) return;
      const answered = sub.items.some((item) => {
        const st = statesRef.current[String(item.itemNumber)];
        return st && (st.isCorrect !== null || st.childAnswer !== '' || st.responseTimeMs != null);
      });
      const firstUnanswered = sub.items.findIndex((item) => {
        const st = statesRef.current[String(item.itemNumber)];
        return !(st && (st.isCorrect !== null || st.childAnswer !== '' || st.responseTimeMs != null));
      });
      const localIndex = firstUnanswered >= 0 ? firstUnanswered : 0;
      const startInTest = answered;
      if (stepNumber === 1) {
        setAlphabetGroup(target.substepOrder ?? 1);
        setAlphabetPhase(startInTest ? 'TEST' : 'TRAINING');
        setAlphabetIndex(localIndex);
      } else if (stepNumber === 2) {
        setStep2Substep((target.substepOrder ?? 1) as 1 | 2 | 3 | 4);
        if (target.substepOrder === 1) {
          setSynthesisPhase(startInTest ? 'TEST' : 'TRAINING');
          setSynthesisIndex(localIndex);
        } else if (target.substepOrder === 2) {
          setSegmentationPhase(startInTest ? 'TEST' : 'TRAINING');
          setSegmentationIndex(localIndex);
        } else if (target.substepOrder === 3) {
          setPhonemePhase(startInTest ? 'TEST' : 'TRAINING');
          setPhonemeIndex(localIndex);
        } else {
          setProductionPhase(startInTest ? 'TEST' : 'TRAINING');
          setProductionIndex(localIndex);
        }
      }
    } catch (err) {
      setModalError(errorMessage(err));
    }
  }

  return (
    <div className="page page-app page-run">
      <header className="page-header run-rail">
        <div className="run-rail-id">
          <h1>{SKILL_LABELS[currentStepData?.skill ?? ''] ?? `Etapa ${currentStep}`}</h1>
          <p className="page-subtitle">
            {app.child?.name} · Etapa {currentStep} de 4
            {/* Data da aplicação: vem de startedAt, gravado pelo servidor no
                momento em que a aplicação é criada. Fica à vista durante o
                teste, e não só na revisão, para o avaliador conferir que
                está registrando no dia certo. */}
            {app.startedAt ? ` · ${formatDate(app.startedAt)}` : ''}
            {currentStepData?.maxScore ? ` · máx ${currentStepData.maxScore} pts` : ''}
          </p>
        </div>
        <div className="page-actions">
          <label className="jump-nav">
            <span>Ir para</span>
            <select
              className="input"
              value=""
              onChange={(e) => {
                const target = jumpTargets[Number(e.target.value)];
                if (target) void jumpTo(target);
              }}
            >
              <option value="" disabled>
                Parte...
              </option>
              {jumpTargets.map((target, i) => (
                <option key={`${target.stepNumber}-${target.substepOrder}`} value={i}>
                  {target.label}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-secondary" type="button" onClick={handleSaveAndExit}>
            <IconSave /> Salvar e sair
          </button>
          <Link to={`/applications/${id}/result`} className="btn btn-ghost">
            Ver andamento
          </Link>
        </div>
      </header>

      <div className="run-rail-status">
        <ProgressBar value={isReview ? 4 : currentStep} max={4} label="Progresso do protocolo" />
        <p className="save-status" aria-live="polite">
          {saving ? 'Salvando...' : savedAt ? `Salvo ${savedAt}` : 'Salvamento automático'}
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {isReview ? (
        <ReviewView
          app={app}
          onBack={() => setCurrentStep(4)}
          onFinalize={(confirmIncomplete) => handleFinalize(confirmIncomplete)}
          onError={setError}
        />
      ) : (
        currentStep === 1 ? (
          <AlphabetStepView
            phase={alphabetPhase}
            itemIndex={alphabetIndex}
            units={alphabetGroups[alphabetGroup - 1] ?? []}
            groupNumber={alphabetGroup}
            totalGroups={alphabetGroups.length}
            states={states}
            setUnit={setUnit}
            onBack={() =>
              stepBack({
                phase: alphabetPhase,
                index: alphabetIndex,
                trainingCount:
                  (alphabetGroups[alphabetGroup - 1] ?? [])[0]?.substep.trainingExamples.length ?? 0,
                setPhase: setAlphabetPhase,
                setIndex: setAlphabetIndex,
                onStart: async () => {
                  // Inicio do grupo: volta ao ultimo item do grupo anterior.
                  if (alphabetGroup > 1) {
                    const previous = alphabetGroups[alphabetGroup - 2] ?? [];
                    setAlphabetGroup((group) => group - 1);
                    setAlphabetPhase('TEST');
                    setAlphabetIndex(Math.max(0, previous.length - 1));
                    return;
                  }
                  await handleBack();
                },
              })
            }
            onNext={async () => {
              const groupUnits = alphabetGroups[alphabetGroup - 1] ?? [];
              const trainingCount = groupUnits[0]?.substep.trainingExamples.length ?? 0;
              if (alphabetPhase === 'TRAINING' && alphabetIndex < trainingCount - 1) {
                setAlphabetIndex((index) => index + 1);
                return;
              }
              if (alphabetPhase === 'TRAINING') {
                setAlphabetPhase('TEST');
                setAlphabetIndex(0);
                return;
              }
              if (alphabetIndex < groupUnits.length - 1) {
                void flushAll();
                setAlphabetIndex((index) => index + 1);
                return;
              }
              if (alphabetGroup < alphabetGroups.length) {
                setAlphabetGroup((group) => group + 1);
                setAlphabetPhase('TRAINING');
                setAlphabetIndex(0);
                return;
              }
              requestNext();
            }}
          />
        ) : currentStep === 2 && synthesisUnits.length > 0 && step2Substep === 1 ? (
          <SynthesisStepView
            phase={synthesisPhase}
            itemIndex={synthesisIndex}
            units={synthesisUnits}
            showExpectedWord={Boolean(app.child?.doesNotRead)}
            states={states}
            setUnit={setUnit}
            onBack={() =>
              stepBack({
                phase: synthesisPhase,
                index: synthesisIndex,
                trainingCount: synthesisUnits[0]?.substep.trainingExamples.length ?? 0,
                setPhase: setSynthesisPhase,
                setIndex: setSynthesisIndex,
                onStart: handleBack,
              })
            }
            onNext={async () => {
              const trainingCount = synthesisUnits[0]?.substep.trainingExamples.length ?? 0;
              if (synthesisPhase === 'TRAINING' && synthesisIndex < trainingCount - 1) {
                setSynthesisIndex((index) => index + 1);
                return;
              }
              if (synthesisPhase === 'TRAINING') {
                setSynthesisPhase('TEST');
                setSynthesisIndex(0);
                return;
              }
              if (synthesisIndex < synthesisUnits.length - 1) {
                void flushAll();
                setSynthesisIndex((index) => index + 1);
                return;
              }
              if (segmentationUnits.length > 0) {
                await flushAll();
                setStep2Substep(2);
                return;
              }
              requestNext();
            }}
          />
        ) : currentStep === 2 && segmentationUnits.length > 0 && step2Substep === 2 ? (
          <SegmentationStepView
            phase={segmentationPhase}
            itemIndex={segmentationIndex}
            units={segmentationUnits}
            states={states}
            setUnit={setUnit}
            onBack={() =>
              stepBack({
                phase: segmentationPhase,
                index: segmentationIndex,
                trainingCount: segmentationUnits[0]?.substep.trainingExamples.length ?? 0,
                setPhase: setSegmentationPhase,
                setIndex: setSegmentationIndex,
                onStart: async () => {
                  if (synthesisUnits.length > 0) {
                    await flushAll();
                    setStep2Substep(1);
                    return;
                  }
                  await handleBack();
                },
              })
            }
            onNext={async () => {
              const trainingCount = segmentationUnits[0]?.substep.trainingExamples.length ?? 0;
              if (segmentationPhase === 'TRAINING' && segmentationIndex < trainingCount - 1) {
                setSegmentationIndex((index) => index + 1);
                return;
              }
              if (segmentationPhase === 'TRAINING') {
                setSegmentationPhase('TEST');
                setSegmentationIndex(0);
                return;
              }
              if (segmentationIndex < segmentationUnits.length - 1) {
                void flushAll();
                setSegmentationIndex((index) => index + 1);
                return;
              }
              if (phonemeUnits.length > 0) {
                await flushAll();
                setStep2Substep(3);
                return;
              }
              if (productionUnits.length > 0) {
                await flushAll();
                setStep2Substep(4);
                return;
              }
              requestNext();
            }}
          />
        ) : currentStep === 2 && phonemeUnits.length > 0 && step2Substep === 3 ? (
          <SegmentationStepView
            mode="phoneme"
            phase={phonemePhase}
            itemIndex={phonemeIndex}
            units={phonemeUnits}
            states={states}
            setUnit={setUnit}
            onBack={() =>
              stepBack({
                phase: phonemePhase,
                index: phonemeIndex,
                trainingCount: phonemeUnits[0]?.substep.trainingExamples.length ?? 0,
                setPhase: setPhonemePhase,
                setIndex: setPhonemeIndex,
                onStart: async () => {
                  if (segmentationUnits.length > 0) {
                    await flushAll();
                    setStep2Substep(2);
                    return;
                  }
                  await handleBack();
                },
              })
            }
            onNext={async () => {
              const trainingCount = phonemeUnits[0]?.substep.trainingExamples.length ?? 0;
              if (phonemePhase === 'TRAINING' && phonemeIndex < trainingCount - 1) {
                setPhonemeIndex((index) => index + 1);
                return;
              }
              if (phonemePhase === 'TRAINING') {
                setPhonemePhase('TEST');
                setPhonemeIndex(0);
                return;
              }
              if (phonemeIndex < phonemeUnits.length - 1) {
                void flushAll();
                setPhonemeIndex((index) => index + 1);
                return;
              }
              if (productionUnits.length > 0) {
                await flushAll();
                setStep2Substep(4);
                return;
              }
              requestNext();
            }}
          />
        ) : currentStep === 2 && productionUnits.length > 0 && step2Substep === 4 ? (
          <SegmentationStepView
            mode="production"
            phase={productionPhase}
            itemIndex={productionIndex}
            units={productionUnits}
            states={states}
            setUnit={setUnit}
            onBack={() =>
              stepBack({
                phase: productionPhase,
                index: productionIndex,
                trainingCount: productionUnits[0]?.substep.trainingExamples.length ?? 0,
                setPhase: setProductionPhase,
                setIndex: setProductionIndex,
                onStart: async () => {
                  if (phonemeUnits.length > 0) {
                    await flushAll();
                    setStep2Substep(3);
                    return;
                  }
                  await handleBack();
                },
              })
            }
            onNext={async () => {
              const trainingCount = productionUnits[0]?.substep.trainingExamples.length ?? 0;
              if (productionPhase === 'TRAINING' && productionIndex < trainingCount - 1) {
                setProductionIndex((index) => index + 1);
                return;
              }
              if (productionPhase === 'TRAINING') {
                setProductionPhase('TEST');
                setProductionIndex(0);
                return;
              }
              if (productionIndex < productionUnits.length - 1) {
                void flushAll();
                setProductionIndex((index) => index + 1);
                return;
              }
              requestNext();
            }}
          />
        ) : currentStep === 4 ? (
          <SegmentationStepView
            mode="comprehension"
            phase={comprehensionPhase}
            itemIndex={comprehensionIndex}
            units={units}
            states={states}
            setUnit={setUnit}
            onBack={() =>
              stepBack({
                phase: comprehensionPhase,
                index: comprehensionIndex,
                trainingCount: units[0]?.substep.trainingExamples.length ?? 0,
                setPhase: setComprehensionPhase,
                setIndex: setComprehensionIndex,
                onStart: handleBack,
              })
            }
            onNext={async () => {
              const trainingCount = units[0]?.substep.trainingExamples.length ?? 0;
              if (comprehensionPhase === 'TRAINING' && comprehensionIndex < trainingCount - 1) {
                setComprehensionIndex((index) => index + 1);
                return;
              }
              if (comprehensionPhase === 'TRAINING') {
                setComprehensionPhase('TEST');
                setComprehensionIndex(0);
                return;
              }
              if (comprehensionIndex < units.length - 1) {
                void flushAll();
                setComprehensionIndex((index) => index + 1);
                return;
              }
              requestNext();
            }}
          />
        ) : (
          <StepView
            stepNumber={currentStep}
            stepStatus={stepStatus}
            units={units}
            states={states}
            setUnit={setUnit}
            onBack={handleBack}
            onNext={requestNext}
          />
        )
      )}

      <Modal
        open={confirmStepOpen}
        title="Prosseguir para a próxima etapa?"
        onClose={() => setConfirmStepOpen(false)}
        actions={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setConfirmStepOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" type="button" onClick={() => void handleNext()}>
              Confirmar e prosseguir
            </button>
          </>
        }
      >
        <p>As respostas desta etapa serão salvas e a aplicação avançará na ordem do protocolo.</p>
      </Modal>

      <Modal
        open={modalError !== null}
        title="Não foi possível concluir a ação"
        onClose={() => setModalError(null)}
        actions={
          <button className="btn btn-primary" type="button" onClick={() => setModalError(null)}>
            Entendi
          </button>
        }
      >
        <p>{modalError}</p>
      </Modal>
    </div>
  );
}

function trainingTarget(example: string): string {
  return example.includes(':') ? example.split(':').pop()?.trim().toUpperCase() ?? '' : '';
}

const SYNTHESIS_CHOICES = [
  ['café', 'café.png'], ['dedo', 'dedo.png'], ['pato', 'pato.png'], ['rato', 'rato.png'],
  ['bala', 'bala.png'], ['tatu', 'tatu.png'], ['fada', 'fada.png'], ['chupeta', 'chupeta.png'],
  ['gaveta', 'gaveta.png'], ['bolacha', 'bolacha.png'], ['cabelo', 'cabelo.png'], ['tomada', 'tomada.png'],
  ['viola', 'viola.png'], ['fazenda', 'fazenda.png'], ['mamadeira', 'mamadeira.png'],
  ['sabonete', 'sabonete.png'], ['abacate', 'abacate.png'], ['beterraba', 'beterraba.png'],
  ['amarelo', 'amarelo.png'], ['macacada', 'macacada.png'], ['perigoso', 'perigoso.png'],
] as const;

// Base dos assets do protocolo. Em produção aponta para o Vercel Blob
// (VITE_STORAGE_URL); em desenvolvimento usa o proxy do Vite para a API.
const STORAGE_BASE =
  (import.meta.env.VITE_STORAGE_URL as string | undefined)?.replace(/\/+$/, '') || '/storage';

function storageUrl(key: string): string {
  return `${STORAGE_BASE}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

// Compreensão auditiva: [frase, palavra, arquivo correto, distrator 1, distrator 2]
// Espelha COMPREHENSION_ITEMS do seed.
const COMPREHENSION_CHOICES: Array<[string, string, string, string, string]> = [
  // exemplos de treino (bicicleta / osso) — distritores do pool de respostas
  ['A menina anda de ___ (bicicleta)', 'bicicleta', 'bicicleta.png', 'skate.png', 'sapatos.png'],
  ['O cachorro pegou o ___ (osso)', 'osso', 'osso.png', 'bolo.png', 'comida.png'],
  ['O menino está pescando no ___', 'rio', 'rio.png', 'praia.png', 'piscina.png'],
  ['As ___ brincam de roda', 'crianças', 'criancas.png', 'animais.png', 'mulher.png'],
  ['O menino chuta a bola no ___', 'gol', 'gol.png', 'gramado.png', 'pedra.png'],
  ['A girafa passeia com os outros animais na ___', 'floresta', 'floresta.png', 'escola.png', 'praia.png'],
  ['Os ___ estão indo para o rio', 'patos', 'pato.png', 'peixe.png', 'gato.png'],
  ['Os pássaros estão fugindo da ___', 'gaiola', 'gaiola.png', 'casa.png', 'hospital.png'],
  ['As crianças estão brincando com as ___', 'bexigas', 'bexiga.png', 'bola.png', 'desenho.png'],
  ['João e Pedro brincam com os ___', 'barcos', 'barco.png', 'carro.png', 'aviao.png'],
  ['O menino está brincando na ___', 'árvore', 'arvore.png', 'cadeira.png', 'escada.png'],
  ['Pedro e sua mãe foram ao ___ comprar frutas', 'supermercado', 'supermercado.png', 'padaria.png', 'farmacia.png'],
  ['João e Maria estão dançando com a ___', 'música', 'musica.png', 'historia.png', 'desenho.png'],
  ['O menino joga a ___ no cesto', 'bola', 'bola.png', 'bexiga.png', 'comida.png'],
  ['João e seu pai fazem ___ em um dia de sol', 'exercícios', 'fazer_exercicio.png', 'jogo_de_encaixe.png', 'brinquedo.png'],
  ['Artur e seu avô estão indo à ___', 'padaria', 'padaria.png', 'hospital.png', 'escola.png'],
  ['Depois de pescar os ___, Pedro e João foram para casa', 'peixes', 'peixe.png', 'pato.png', 'gato.png'],
  ['Maria está pulando ___', 'corda', 'corda.png', 'pedra.png', 'osso.png'],
  ['O cachorro está indo para ___', 'casa', 'casa.png', 'escola.png', 'cavalo.png'],
  ['Os meninos estão correndo na ___', 'chuva', 'chuva.png', 'cavalo.png', 'ilha.png'],
  ['A menina está molhando a ___ com o regador', 'flor', 'flor.png', 'cavalo.png', 'sapatos.png'],
  ['Os ___ estão segurando as bexigas', 'palhaços', 'palhaco.png', 'medico.png', 'policia.png'],
];
// Produção de palavras: [prompt, palavra aceita, imagem correta, distrator 1, distrator 2]
// Espelha PRODUCTION_ITEMS do seed.
const PRODUCTION_CHOICES: Array<[string, string, string, string, string]> = [
  ['/a/', 'abelha', 'abelha.png', 'elefante.png', 'igreja.png'],
  ['/da/', 'dado', 'dado.png', 'tatu.png', 'vaca.png'],
  ['/ga/', 'gato', 'gato.png', 'pato.png', 'jacare.png'],
  ['/la/', 'lápis', 'lapis.png', 'zebra.png', 'bola.png'],
  ['/o/', 'ovo', 'ovo.png', 'urso.png', 'sol.png'],
  ['/Ra/', 'rato', 'rato.png', 'gato.png', 'bola.png'],
  ['/bo/', 'bola', 'bola.png', 'vaca.png', 'chave.png'],
  ['/e/', 'elefante', 'elefante.png', 'abelha.png', 'faca.png'],
  ['/i/', 'igreja', 'igreja.png', 'lapis.png', 'maca.png'],
  ['/ma/', 'maçã', 'maca.png', 'navio.png', 'dado.png'],
  ['/pa/', 'pato', 'pato.png', 'gato.png', 'cinto.png'],
  ['/s/', 'sapo', 'sapo.png', 'vaca.png', 'tatu.png'],
  ['/ka/', 'cama', 'cama.png', 'maca.png', 'jacare.png'],
  ['/f/', 'faca', 'faca.png', 'chave.png', 'sol.png'],
  ['/ʒ/', 'jacaré', 'jacare.png', 'gato.png', 'pato.png'],
  ['/na/', 'navio', 'navio.png', 'ovo.png', 'igreja.png'],
  ['/ta/', 'tatu', 'tatu.png', 'dado.png', 'ovo.png'],
  ['/u/', 'urso', 'urso.png', 'vaca.png', 'jacare.png'],
  ['/v/', 'vaca', 'vaca.png', 'pato.png', 'elefante.png'],
  ['/ʃ/', 'chave', 'chave.png', 'faca.png', 'bola.png'],
  ['/z/', 'zebra', 'zebra.png', 'lapis.png', 'navio.png'],
];

function SegmentationStepView({
  mode = 'segmentation',
  phase,
  itemIndex,
  units,
  states,
  setUnit,
  onBack,
  onNext,
}: {
  mode?: 'segmentation' | 'phoneme' | 'production' | 'comprehension';
  phase: 'TRAINING' | 'TEST';
  itemIndex: number;
  units: Unit[];
  states: Record<string, UnitState>;
  setUnit: (itemNumber: number, patch: Partial<UnitState>) => void;
  onBack: () => void | Promise<void>;
  onNext: () => void | Promise<void>;
}) {
  const [trainingMark, setTrainingMark] = useState<boolean | null>(null);
  // Resposta salva do item só vale para o autosave; a marcação visual (verde/vermelho)
  // é sempre local da visita atual — ao avançar/voltar, o item volta desmarcado.
  const [visitedMark, setVisitedMark] = useState<boolean | null>(null);
  const [visitedFile, setVisitedFile] = useState<string>('');
  const isPhoneme = mode === 'phoneme';
  const isProduction = mode === 'production';
  const isComprehension = mode === 'comprehension';
  const title = isProduction
    ? 'Produção de palavras (fonema/sílaba inicial)'
    : isPhoneme
      ? 'Identificação de som ou sílaba inicial'
      : isComprehension
        ? 'Compreensão auditiva de sentenças'
        : 'Segmentação silábica';
  const storageDir = isProduction ? 'producao/objetos' : isPhoneme ? 'identificacao_fonema' : 'segmentacao_silabica';
  const currentUnit = units[itemIndex];
  const examples = units[0]?.substep.trainingExamples ?? [];
  const parts = phase === 'TRAINING' ? (examples[itemIndex] ?? '').split('|') : [];
  const word = phase === 'TRAINING' ? parts[2] ?? '' : currentUnit?.expectedAnswer ?? '';
  const syllables = phase === 'TRAINING' ? parts[1] ?? '' : currentUnit?.prompt ?? '';
  const imageKey = phase === 'TRAINING' && parts[3] ? `${storageDir}/${parts[3]}` : currentUnit?.imageKey ?? '';
  const hasImage = imageKey !== '';
  const mark = phase === 'TRAINING' ? trainingMark : states[String(currentUnit?.itemNumber)]?.isCorrect ?? null;

  // Produção: prompts de treino trazem "sapo, cinto, sol..." — separa para exibir e usa a 1ª como alvo.
  const productionExamples = isProduction && phase === 'TRAINING' ? (parts[2] ?? '').split(',').map((s) => s.trim()) : [];

  // Compreensão: imagem da questão (cena) + frase; opções via COMPREHENSION_CHOICES pela frase.
  // No treino o formato é: Exemplo N|frase|palavra|cena (cena já vem com pasta prefixada).
  const comprehensionSentence = isComprehension
    ? (phase === 'TRAINING' ? parts[1] ?? '' : currentUnit?.prompt ?? '')
    : '';
  // A cena da pergunta ja vem no imageKey do item (e, no treino, no
  // quarto campo do exemplo, com a pasta ja prefixada). Antes a tela
  // mostrava so a frase, e a figura ficava sem uso.
  const comprehensionQuestionImage = !isComprehension
    ? ''
    : phase === 'TRAINING'
      ? (parts[3] ?? '')
      : (currentUnit?.imageKey ?? '');

  const comprehensionEntry = isComprehension
    ? COMPREHENSION_CHOICES.find((c) => c[1] === word) ?? null
    : null;
  const comprehensionTargetFile = isComprehension
    ? (comprehensionEntry
        ? comprehensionEntry[2]
        : phase === 'TRAINING'
          ? (parts[2] ?? '') + '.png'
          : (currentUnit?.expectedAnswer ?? '') + '.png')
    : '';
  // Embaralhado: a figura certa vinha sempre no primeiro quadro, e a
  // crianca podia acertar pela posicao em vez de pela frase.
  const comprehensionOptions = useMemo(() => {
    if (!isComprehension || !comprehensionTargetFile) return [];
    const arquivos = (comprehensionEntry
      ? [comprehensionEntry[2], comprehensionEntry[3], comprehensionEntry[4]]
      : [comprehensionTargetFile, '', '']
    ).filter(Boolean);
    return shuffled(arquivos).map((img) => ({
      imageKey: `compreensao_sentencas/respostas/${img}`,
      label: '',
    }));
  }, [isComprehension, comprehensionTargetFile, comprehensionEntry]);

  // Opções (modo produção): imagem correta + dois distratores fixos por item.
  // Figura correta da tarefa de produção. Fica fora do useMemo porque
  // tanto a montagem das opções quanto a conferência da resposta dependem
  // dela — manter as duas derivando da mesma variável evita que voltem a
  // divergir.
  const productionCorrectFile = !isProduction
    ? ''
    : phase === 'TRAINING'
      ? parts[3] ?? ''
      : (currentUnit?.imageKey ?? '').split('/').pop() ?? '';
  const productionCorrectKey = `producao/objetos/${productionCorrectFile}`;

  const productionOptions = useMemo(() => {
    if (!isProduction) return [];
    const entry = PRODUCTION_CHOICES.find((choice) => choice[2] === productionCorrectFile);
    if (!entry) return [{ imageKey: productionCorrectKey, label: word }];
    // A figura certa precisa cair em qualquer das três posições: fixa no
    // primeiro quadro, a criança acerta pela posição e não pela tarefa.
    return shuffled([entry[2], entry[3], entry[4]]).map((img) => ({
      imageKey: `producao/objetos/${img}`,
      label: '',
    }));
  }, [isProduction, productionCorrectFile, productionCorrectKey, word]);

  // Identificacao de som ou silaba inicial: a crianca ve a figura e
  // escolhe entre tres letras com qual delas a palavra comeca. O nome nao
  // aparece escrito — num teste de preditores da leitura, ler a palavra
  // entregaria a resposta.
  const phonemeImage = !isPhoneme
    ? ''
    : phase === 'TRAINING'
      ? (parts[3] ? `identificacao_fonema/${parts[3]}` : '')
      : (currentUnit?.imageKey ?? '');

  // Letra inicial da palavra, sem acento: lapis -> L, robo -> R.
  const phonemeLetter = !isPhoneme
    ? ''
    : (word ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .charAt(0)
        .toUpperCase();

  const phonemeLetterOptions = useMemo(() => {
    if (!isPhoneme || !phonemeLetter) return [];
    const pool = [...VOWELS, ...CONSONANTS].filter((letter) => letter !== phonemeLetter);
    return shuffled([phonemeLetter, ...shuffled(pool).slice(0, 2)]);
  }, [isPhoneme, phonemeLetter]);

  // Figuras dos exemplos aceitos do treino (ex.: sapo, cinto, sol).
  const EXAMPLE_IMAGES: Record<string, string> = {
    sapo: 'sapo.png', cinto: 'cinto.png', sol: 'sol.png',
    vaca: 'vaca.png', vaga: 'vaga.png', vassoura: 'vassoura.png',
  };
  const productionExampleImages = productionExamples
    .map((w) => ({ word: w, image: EXAMPLE_IMAGES[w] }))
    .filter((e) => e.image);

  useEffect(() => {
    setTrainingMark(null);
    setVisitedMark(null);
    setVisitedFile('');
  }, [phase, itemIndex]);


  if (!currentUnit && phase === 'TEST') return null;
  const canContinue = mark !== null;
  // Letra/sílaba grande: fonemas simples usam a pasta letras (A-Z); sílabas aparecem como texto.
  const promptLetter = isProduction ? (syllables.match(/\/([^/]+)\//)?.[1] ?? '') : '';
  const IPA_TO_LETTER: Record<string, string> = {
    a: 'A', e: 'E', i: 'I', o: 'O', u: 'U',
    s: 'S', f: 'F', v: 'V', z: 'Z',
    // /ʃ/ aparece no item cuja resposta é "chave", então o grafema é CH.
    // Antes mapeava para X, e a tela mostrava uma letra que não combina
    // com a palavra esperada.
    'ʒ': 'J', 'ʃ': 'CH', Ra: 'R', R: 'R', '3': 'J',
  };
  const mappedLetter = IPA_TO_LETTER[promptLetter.toLowerCase()];
  // Só há imagem para letras isoladas (A–Z); dígrafos como CH vão como
  // texto, no mesmo tamanho.
  const letterImage =
    isProduction && mappedLetter && mappedLetter.length === 1
      ? `producao/letras/${mappedLetter}.png`
      : null;

  return (
    <div className="step-view segmentation-step-view">
      <section className="task-meta task-meta-stacked" aria-live="polite">
        <p className="task-meta-text">
          {phase === 'TRAINING' ? 'Treino' : 'Prova'} · {title}
          {phase === 'TRAINING'
            ? parts[0] ? ` · ${parts[0]}` : ''
            : ` · Item ${itemIndex + 1} de ${units.length}`}
        </p>
        <p className="task-meta-script">
          {isProduction
            ? phase === 'TRAINING'
              ? 'Fale um som ou sílaba e peça uma palavra que comece com ele. Faça os exemplos juntos antes da prova.'
              : 'Fale o som/sílaba e a criança diz uma palavra que comece com ele. Marque acerto ou erro.'
            : isComprehension
              ? (phase === 'TRAINING'
                  ? `Leia em voz alta: “${comprehensionSentence}”. Faça os exemplos juntos antes da prova.`
                  : `Leia em voz alta: “${comprehensionSentence}”. A criança toca na figura que completa a frase.`)
              : isPhoneme
                ? phase === 'TRAINING'
                  ? 'Mostre a figura e peça à criança que toque na letra com que a palavra começa. Faça os exemplos juntos antes da prova.'
                  : 'Peça à criança que toque na letra com que a palavra da figura começa.'
                : phase === 'TRAINING'
                  ? 'Peça à criança para separar a palavra em sílabas e marque o resultado.'
                  : 'Mostre a imagem e o nome. A criança fala a palavra separada em sílabas e o avaliador marca acerto ou erro.'}
        </p>
        {isProduction ? (
          <div className="production-reference">
            <div className="production-prompt" aria-label="Som ou sílaba apresentada">
              {letterImage ? (
                <img src={storageUrl(letterImage)} alt={`Som ${syllables}`} className="production-letter" />
              ) : (
                <span className="production-letter-text">{mappedLetter ?? syllables}</span>
              )}
            </div>
            {phase === 'TRAINING' && productionExamples.length > 0 && (
              <div className="production-word">
                <span className="segmentation-word-label">Exemplos aceitos</span>
                <strong>{productionExamples.join(', ')}...</strong>
                {productionExampleImages.length > 0 && (
                  <div className="production-example-images">
                    {productionExampleImages.map((e) => (
                      <figure key={e.word} className="production-example-figure">
                        <img src={storageUrl(`producao/objetos/${e.image}`)} alt={`Exemplo: ${e.word}`} />
                        <figcaption>{e.word}</figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : isComprehension || isPhoneme ? null : (
          <div className="segmentation-reference" aria-label="Material apresentado">
            {hasImage && <img src={storageUrl(imageKey)} alt={`Figura da palavra ${word}`} className="segmentation-image" />}
            <div className="segmentation-word">
              <span className="segmentation-word-label">{isPhoneme ? 'Respostas aceitas' : 'Palavra'}</span>
              <strong>{word}</strong>
              <span className="segmentation-syllables">{syllables}</span>
            </div>
          </div>
        )}
      </section>

      {isComprehension && comprehensionQuestionImage && (
        <div className="comprehension-question">
          <img
            src={storageUrl(comprehensionQuestionImage)}
            alt=""
            className="comprehension-scene"
          />
        </div>
      )}

      {isComprehension && (
        <div className="synthesis-options production-options" role="group" aria-label="Figuras de resposta">
          {comprehensionOptions.map((option) => {
            const chosenWord = option.imageKey.split('/').pop()?.replace(/\.(png|jpg|jpeg)$/i, '') ?? '';
            const norm = (s: string) => s.trim().toLowerCase();
            const isCorrectImage = norm(chosenWord) === norm(comprehensionTargetFile.replace(/\.(png|jpg|jpeg)$/i, ''));
            // Verde só na figura correta; vermelho só na figura clicada (visitedFile).
            const stateClass = visitedMark === null
              ? ''
              : visitedMark
                ? (isCorrectImage ? ' selected correct' : '')
                : (norm(chosenWord) === visitedFile ? ' selected wrong' : '');
            return (
              <button
                key={option.imageKey}
                type="button"
                className={`synthesis-option${stateClass}`}
                aria-label="Figura de resposta"
                aria-pressed={stateClass !== ''}
                onClick={() => {
                  const correct = isCorrectImage;
                  setVisitedMark(correct);
                  setVisitedFile(norm(chosenWord));
                  if (phase === 'TRAINING') {
                    setTrainingMark(correct ? true : false);
                  } else {
                    setUnit(currentUnit.itemNumber, {
                      isCorrect: correct,
                      childAnswer: correct ? word : chosenWord,
                      prompt: syllables,
                      expectedAnswer: word,
                    });
                  }
                }}
              >
                <img src={storageUrl(option.imageKey)} alt="" />
              </button>
            );
          })}
        </div>
      )}

      {isPhoneme && phonemeImage && (
        <div className="phoneme-stimulus">
          <img src={storageUrl(phonemeImage)} alt="" />
        </div>
      )}

      {isPhoneme && phonemeLetterOptions.length > 0 && (
        <div className="alphabet-options phoneme-letter-options" role="group" aria-label="Escolha uma letra">
          {phonemeLetterOptions.map((letter) => {
            const correct = letter === phonemeLetter;
            // Verde na certa; vermelho so na que foi tocada.
            const stateClass = visitedMark === null || letter !== visitedFile
              ? ''
              : correct
                ? ' selected correct'
                : ' selected wrong';
            return (
              <button
                key={letter}
                type="button"
                className={`alphabet-option${stateClass}`}
                aria-pressed={letter === visitedFile}
                onClick={() => {
                  setVisitedMark(correct);
                  setVisitedFile(letter);
                  if (phase === 'TRAINING') {
                    setTrainingMark(correct);
                  } else if (currentUnit) {
                    setUnit(currentUnit.itemNumber, {
                      isCorrect: correct,
                      childAnswer: letter,
                      prompt: syllables,
                      expectedAnswer: word,
                    });
                  }
                }}
              >
                {letter}
              </button>
            );
          })}
        </div>
      )}

      {isProduction && (
        <div className="synthesis-options production-options" role="group" aria-label="Figuras de apoio">
          {productionOptions.map((option) => {
            // Compara chave com chave. Passar o lado direito por
            // storageUrl() montava uma URL, que nunca é igual ao imageKey
            // cru da opção — então nenhuma resposta era aceita.
            const isCorrectImage = option.imageKey === productionCorrectKey;
            // Marcação visual é local da visita: verde na figura certa, vermelho na errada.
            // Verde na figura certa; vermelho so na figura tocada. Pintar
            // todas as erradas acendia duas de uma vez e escondia qual
            // delas a crianca escolheu.
            const stateClass = visitedMark === null
              ? ''
              : visitedMark
                ? (isCorrectImage ? ' selected correct' : '')
                : (option.imageKey === visitedFile ? ' selected wrong' : '');
            return (
              <button
                key={option.imageKey}
                type="button"
                className={`synthesis-option${stateClass}`}
                aria-label="Figura de apoio"
                aria-pressed={stateClass !== ''}
                onClick={() => {
                  const correct = isCorrectImage;
                  setVisitedMark(correct);
                  setVisitedFile(option.imageKey);
                  if (phase === 'TRAINING') {
                    setTrainingMark(correct ? true : false);
                  } else {
                    setUnit(currentUnit.itemNumber, { isCorrect: correct, childAnswer: correct ? word : '', prompt: syllables, expectedAnswer: word });
                  }
                }}
              >
                <img src={storageUrl(option.imageKey)} alt="" />
              </button>
            );
          })}
        </div>
      )}

      {/* Onde a crianca responde tocando na figura, o toque ja registra o
          resultado. Manter tambem a marcacao manual daria duas entradas
          para a mesma resposta, que poderiam discordar entre si. */}
      {!isProduction && !isComprehension && !isPhoneme && (
        <div className="correct-row segmentation-mark-row" role="group" aria-label="Marcação de acerto ou erro">
          <button
            type="button"
            className={`mark-btn correct${mark === true ? ' active' : ''}`}
            onClick={() => {
              if (phase === 'TRAINING') setTrainingMark(true);
              else setUnit(currentUnit.itemNumber, { isCorrect: true, childAnswer: word, prompt: syllables, expectedAnswer: word });
            }}
          >
            Acerto
          </button>
          <button
            type="button"
            className={`mark-btn wrong${mark === false ? ' active' : ''}`}
            onClick={() => {
              if (phase === 'TRAINING') setTrainingMark(false);
              else setUnit(currentUnit.itemNumber, { isCorrect: false, childAnswer: '', prompt: syllables, expectedAnswer: word });
            }}
          >
            Erro
          </button>
        </div>
      )}

      <div className="step-nav">
        <button className="btn btn-secondary" type="button" onClick={onBack}><IconArrowLeft /> Voltar</button>
        <button className="btn btn-primary" type="button" onClick={onNext} disabled={!canContinue}>
          {phase === 'TRAINING' ? itemIndex < examples.length - 1 ? 'Próximo exemplo' : 'Ir para a prova' : itemIndex < units.length - 1 ? 'Prosseguir' : 'Concluir etapa'}
          <IconArrowRight />
        </button>
      </div>
    </div>
  );
}

function SynthesisStepView({
  phase,
  itemIndex,
  units,
  showExpectedWord,
  states,
  setUnit,
  onBack,
  onNext,
}: {
  phase: 'TRAINING' | 'TEST';
  itemIndex: number;
  units: Unit[];
  showExpectedWord: boolean;
  states: Record<string, UnitState>;
  setUnit: (itemNumber: number, patch: Partial<UnitState>) => void;
  onBack: () => void;
  onNext: () => void | Promise<void>;
}) {
  const [trainingAnswer, setTrainingAnswer] = useState<string | null>(null);
  const currentUnit = units[itemIndex];
  const examples = units[0]?.substep.trainingExamples ?? [];
  const parts = phase === 'TRAINING' ? (examples[itemIndex] ?? '').split('|') : [];
  const syllables = phase === 'TRAINING' ? parts[1] ?? '' : currentUnit?.prompt ?? '';
  const targetAnswer = phase === 'TRAINING' ? parts[2] ?? '' : currentUnit?.expectedAnswer ?? '';
  const targetImage = phase === 'TRAINING' ? `sintese_silabica/${parts[3] ?? ''}` : currentUnit?.imageKey ?? '';
  const selectedAnswer = phase === 'TRAINING'
    ? trainingAnswer
    : states[String(currentUnit?.itemNumber)]?.childAnswer ?? null;
  const options = useMemo(() => {
    const distractors = SYNTHESIS_CHOICES
      .filter(([, image]) => `sintese_silabica/${image}` !== targetImage)
      .sort(() => Math.random() - 0.5)
      .slice(0, 2)
      .map(([answer, image]) => ({ answer, imageKey: `sintese_silabica/${image}` }));
    return [...distractors, { answer: targetAnswer, imageKey: targetImage }].sort(() => Math.random() - 0.5);
  }, [targetAnswer, targetImage]);

  useEffect(() => {
    setTrainingAnswer(null);
  }, [phase, itemIndex]);

  if (!currentUnit && phase === 'TEST') return null;
  const canContinue = selectedAnswer !== null && selectedAnswer !== '';

  return (
    <div className="step-view synthesis-step-view">
      <section className="task-meta task-meta-stacked" aria-live="polite">
        <p className="task-meta-text">
          {phase === 'TRAINING' ? 'Treino' : 'Prova'} · Síntese silábica
          {phase === 'TRAINING'
            ? parts[0] ? ` · ${parts[0]}` : ''
            : ` · Item ${itemIndex + 1} de ${units.length}`}
        </p>
        <p className="task-meta-script">Selecione a imagem correspondente à síntese silábica.</p>
        <div className="synthesis-reference" aria-label="Referência do avaliador">
          <span>Sílabas: <strong>{syllables}</strong></span>
          {showExpectedWord && <span>Resposta esperada: <strong>{targetAnswer}</strong></span>}
        </div>

      </section>
      <div className="synthesis-options" role="group" aria-label="Imagens de resposta">
        {options.map((option) => {
          const selected = selectedAnswer === option.answer;
          return (
            <button
              key={option.imageKey}
              type="button"
              className={`synthesis-option${selected ? ' selected' : ''}`}
              aria-label="Imagem de resposta"
              aria-pressed={selected}
              onClick={() => {
                const correct = option.imageKey === targetImage;
                if (phase === 'TRAINING') setTrainingAnswer(option.answer);
                else setUnit(currentUnit.itemNumber, { childAnswer: option.answer, isCorrect: correct, prompt: syllables, expectedAnswer: targetAnswer });
              }}
            >
              <img src={storageUrl(option.imageKey)} alt="" />
            </button>
          );
        })}
      </div>
      <div className="step-nav">
        <button className="btn btn-secondary" type="button" onClick={onBack}><IconArrowLeft /> Voltar</button>
        <button className="btn btn-primary" type="button" onClick={onNext} disabled={!canContinue}>
          {phase === 'TRAINING' ? itemIndex < examples.length - 1 ? 'Próximo exemplo' : 'Ir para a prova' : itemIndex < units.length - 1 ? 'Prosseguir' : 'Concluir etapa'}
          <IconArrowRight />
        </button>
      </div>
    </div>
  );
}

function AlphabetStepView({
  phase,
  itemIndex,
  units,
  groupNumber,
  totalGroups,
  states,
  setUnit,
  onBack,
  onNext,
}: {
  phase: 'TRAINING' | 'TEST';
  itemIndex: number;
  units: Unit[];
  groupNumber: number;
  totalGroups: number;
  states: Record<string, UnitState>;
  setUnit: (itemNumber: number, patch: Partial<UnitState>) => void;
  onBack: () => void;
  onNext: () => void | Promise<void>;
}) {
  const [trainingAnswer, setTrainingAnswer] = useState<string | null>(null);
  const currentUnit = units[itemIndex];
  const examples = units[0]?.substep.trainingExamples ?? [];
  const currentExample = examples[itemIndex] ?? '';
  const target = phase === 'TRAINING' ? trainingTarget(currentExample) : currentUnit?.expectedAnswer ?? '';

  useEffect(() => {
    setTrainingAnswer(null);
  }, [phase, itemIndex]);

  if (!currentUnit && phase === 'TEST') return null;

  const choiceUnit: Unit = phase === 'TRAINING'
    ? { ...units[0], itemNumber: 0, expectedAnswer: target, prompt: null }
    : currentUnit;
  const selectedAnswer = phase === 'TRAINING'
    ? trainingAnswer
    : states[String(currentUnit.itemNumber)]?.childAnswer ?? null;
  const canContinue = selectedAnswer !== null && selectedAnswer !== '';

  function speakQuestion() {
    const spokenTarget = target === 'E' ? 'É' : target === 'O' ? 'Ó' : target;
    speak(`Onde está a letra ${spokenTarget}?`);
  }

  // Quando o aparelho nao tem voz em portugues o motor responde
  // synthesis-failed e nada toca. Sem um aviso, o avaliador acha que
  // leu para a crianca quando ninguem leu.
  const [semVoz, setSemVoz] = useState(false);

  useEffect(() => {
    speakQuestion();
    const check = window.setTimeout(() => setSemVoz(speechUnavailable()), 1600);
    return () => {
      window.clearTimeout(check);
      cancelSpeech();
    };
  }, [phase, itemIndex]);

  return (
    <div className="step-view alphabet-step-view">
      <section className="task-meta" aria-live="polite">
        <p className="task-meta-text">
          {phase === 'TRAINING' ? 'Treino' : 'Prova'} · Grupo {groupNumber} de {totalGroups}
          {phase === 'TRAINING'
            ? ` · ${currentExample.split(':')[0]}`
            : ` · Item ${itemIndex + 1} de ${units.length}`}
        </p>
        <button className="audio-question-button" type="button" onClick={speakQuestion}>
          Ouvir pergunta
        </button>
        {semVoz && (
          <p className="task-meta-alert" role="status">
            Este aparelho nao tem voz em portugues: leia a pergunta em voz alta.
          </p>
        )}
      </section>

      <AlphabetChoice
        key={`${phase}-${itemIndex}`}
        unit={choiceUnit}
        onChange={(patch) => {
          if (phase === 'TRAINING') {
            setTrainingAnswer(patch.childAnswer ?? null);
          } else {
            setUnit(currentUnit.itemNumber, patch);
          }
        }}
      />

      <div className="step-nav">
        <button className="btn btn-secondary" type="button" onClick={onBack}>
          <IconArrowLeft /> Voltar
        </button>
        <button className="btn btn-primary" type="button" onClick={onNext} disabled={!canContinue}>
          {phase === 'TRAINING'
            ? itemIndex < examples.length - 1 ? 'Próximo exemplo' : 'Ir para a prova'
            : itemIndex < units.length - 1 ? 'Prosseguir' : 'Concluir etapa'}
          <IconArrowRight />
        </button>
      </div>
    </div>
  );
}

function StepView({
  stepNumber,
  stepStatus,
  units,
  states,
  setUnit,
  onBack,
  onNext,
}: {
  stepNumber: number;
  stepStatus: string;
  units: Unit[];
  states: Record<string, UnitState>;
  setUnit: (itemNumber: number, patch: Partial<UnitState>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const isTimer = stepNumber === 3;

  return (
    <div className="step-view">
      {stepStatus === 'COMPLETED' && (
        <Alert variant="info">Esta etapa já foi concluída. Você pode revisar ou alterar as respostas.</Alert>
      )}

      {units.length === 0 && <Alert variant="info">Nenhum item cadastrado para esta etapa no protocolo.</Alert>}

      {units.map((unit) => {
        const st = states[String(unit.itemNumber)] ?? EMPTY_STATE;
        return (
          <div className="item-card" key={unit.itemNumber}>
            <div className="item-card-header">
              <span className="item-number">Item {unit.itemNumber}</span>
              {unit.substep && <span className="item-substep">{unit.substep.title}</span>}
              {unit.isPending && <span className="badge-pending">Aguardando conferência</span>}
            </div>

            {/* Na etapa cronometrada o exemplo tem fase propria, com a
                prancha de verdade; a lista crua aqui so repetiria. */}
            {!isTimer && unit.substep && unit.substep.trainingExamples.length > 0 && (
              <details className="training-box">
                <summary>Exemplos de treinamento</summary>
                <ul>
                  {unit.substep.trainingExamples.map((ex, i) => (
                    <li key={i}>{ex}</li>
                  ))}
                </ul>
              </details>
            )}

            {isTimer ? (
              <TimerUnit
                unit={unit}
                state={st}
                onChange={(patch) => setUnit(unit.itemNumber, patch)}
              />
            ) : stepNumber === 1 && unit.responseType === 'LETTER' ? (
              <AlphabetChoice
                unit={unit}
                onChange={(patch) => setUnit(unit.itemNumber, patch)}
              />
            ) : (
              <ItemForm
                unit={unit}
                state={st}
                onChange={(patch) => setUnit(unit.itemNumber, patch)}
              />
            )}
          </div>
        );
      })}

      <div className="step-nav">
        <button className="btn btn-secondary" type="button" onClick={onBack}>
          <IconArrowLeft /> Voltar
        </button>
        <button className="btn btn-primary" type="button" onClick={onNext}>
          Continuar <IconArrowRight />
        </button>
      </div>
    </div>
  );
}

function AlphabetChoice({
  unit,
  onChange,
}: {
  unit: Unit;
  onChange: (patch: Partial<UnitState>) => void;
}) {
  const target = (unit.expectedAnswer ?? '').trim().toUpperCase();
  const pool = unit.substep.order === 1 ? VOWELS : CONSONANTS;
  const options = useMemo(() => {
    const distractors = shuffled(pool.filter((letter) => letter !== target)).slice(0, 2);
    return shuffled([target, ...distractors]);
  }, [pool, target]);

  // A marcação visual é local da visita, não vem da resposta gravada: ao
  // voltar para um item já respondido, ou ao reentrar na etapa, a tela
  // aparece limpa. A resposta continua salva, apenas não fica destacada,
  // para que a criança não seja induzida pela escolha anterior.
  const [visitAnswer, setVisitAnswer] = useState<string | null>(null);
  useEffect(() => {
    setVisitAnswer(null);
  }, [unit.itemNumber, target]);

  return (
    <div className="alphabet-choice" aria-label="Opções de resposta">
      <div className="alphabet-options" role="group" aria-label="Escolha uma letra">
        {options.map((option) => {
          const selected = visitAnswer === option;
          const correct = selected && option === target;
          const wrong = selected && option !== target;
          return (
            <button
              key={option}
              type="button"
              className={`alphabet-option${selected ? ' selected' : ''}${correct ? ' correct' : ''}${wrong ? ' wrong' : ''}`}
              aria-pressed={selected}
              onClick={() => {
                setVisitAnswer(option);
                onChange({ childAnswer: option, isCorrect: option === target });
              }}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ItemForm({
  unit,
  state,
  onChange,
}: {
  unit: Unit;
  state: UnitState;
  onChange: (patch: Partial<UnitState>) => void;
}) {
  const isLetter = unit.responseType === 'LETTER';
  return (
    <div className="item-form">
      {isLetter && unit.prompt && (
        <div className="letter-display" aria-label={`Apresente a letra ${unit.prompt}`}>
          {unit.prompt}
        </div>
      )}

      <div className="field">
        <label className="field-label" htmlFor={`prompt-${unit.itemNumber}`}>
          Material apresentado
        </label>
        <input
          id={`prompt-${unit.itemNumber}`}
          className="input"
          value={state.prompt}
          placeholder={unit.isPending ? 'Digite a palavra/sentença apresentada (item pendente de conferência)' : 'Enunciado apresentado'}
          onChange={(e) => onChange({ prompt: e.target.value })}
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor={`expected-${unit.itemNumber}`}>
          Resposta esperada
        </label>
        <input
          id={`expected-${unit.itemNumber}`}
          className="input"
          value={state.expectedAnswer}
          placeholder={unit.isPending ? 'Digite a resposta esperada' : 'Resposta esperada'}
          onChange={(e) => onChange({ expectedAnswer: e.target.value })}
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor={`answer-${unit.itemNumber}`}>
          Resposta da criança
        </label>
        <input
          id={`answer-${unit.itemNumber}`}
          className="input"
          value={state.childAnswer}
          onChange={(e) => onChange({ childAnswer: e.target.value })}
        />
      </div>

      <div className="correct-row" role="group" aria-label="Marcação de acerto ou erro">
        <button
          type="button"
          className={`mark-btn correct${state.isCorrect === true ? ' active' : ''}`}
          onClick={() => onChange({ isCorrect: state.isCorrect === true ? null : true })}
        >
          Acerto
        </button>
        <button
          type="button"
          className={`mark-btn wrong${state.isCorrect === false ? ' active' : ''}`}
          onClick={() => onChange({ isCorrect: state.isCorrect === false ? null : false })}
        >
          Erro
        </button>
      </div>

      <div className="field">
        <label className="field-label" htmlFor={`notes-${unit.itemNumber}`}>
          Observações
        </label>
        <textarea
          id={`notes-${unit.itemNumber}`}
          className="input"
          rows={2}
          value={state.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </div>
    </div>
  );
}

function TimerUnit({
  unit,
  state,
  onChange,
}: {
  unit: Unit;
  state: UnitState;
  onChange: (patch: Partial<UnitState>) => void;
}) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(state.responseTimeMs);

  // A prancha de exemplo serve so para a crianca nomear as figuras, sem
  // cronometro, como manda o protocolo. Vem dos exemplos de treino da
  // subetapa, em vez de fixada aqui.
  const exampleFile = (unit.substep?.trainingExamples?.[0] ?? '').split('|')[3] ?? '';
  const exampleKey = exampleFile ? `nomeacao_automatica/${exampleFile}` : '';
  // Quem ja cronometrou volta direto para a prova.
  const [showExample, setShowExample] = useState(
    Boolean(exampleKey) && state.responseTimeMs == null,
  );

  useEffect(() => {
    setElapsed(state.responseTimeMs);
  }, [state.responseTimeMs]);

  useEffect(() => {
    if (!running) return;
    const start = timersRef[String(unit.itemNumber)]?.start ?? Date.now();
    const interval = setInterval(() => {
      setElapsed(Date.now() - start);
    }, 100);
    return () => clearInterval(interval);
  }, [running, unit.itemNumber]);

  function start() {
    timersRef[String(unit.itemNumber)] = { start: Date.now() };
    setElapsed(0);
    setRunning(true);
    onChange({ responseTimeMs: 0 });
  }

  function stop() {
    if (!running) return;
    const start = timersRef[String(unit.itemNumber)]?.start ?? Date.now();
    const ms = Date.now() - start;
    setElapsed(ms);
    setRunning(false);
    onChange({ responseTimeMs: ms });
  }

  if (showExample) {
    return (
      <div className="timer-unit">
        <p className="field-hint">
          Exemplo: peça que a criança nomeie cada figura. Aqui não se marca tempo.
        </p>
        <img src={storageUrl(exampleKey)} alt="Prancha de exemplo" className="prancha-image" />
        <div className="timer-actions">
          <button className="btn btn-primary" type="button" onClick={() => setShowExample(false)}>
            Ir para a prova
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="timer-unit">
      {unit.imageKey && (
        <img src={storageUrl(unit.imageKey)} alt="Prancha de figuras" className="prancha-image" />
      )}
      <div className="timer-controls">
      <div className="timer-display" role="timer" aria-label="Tempo decorrido">
        <IconClock />
        {elapsed != null ? (elapsed / 1000).toFixed(1) : '0.0'} s
      </div>
      <div className="timer-actions">
        <button className="btn btn-primary" type="button" onClick={start} disabled={running}>
          Iniciar cronômetro
        </button>
        <button className="btn btn-secondary" type="button" onClick={stop} disabled={!running}>
          Finalizar aplicação (cronometrada)
        </button>
        {exampleKey && !running && (
          <button className="btn btn-secondary" type="button" onClick={() => setShowExample(true)}>
            Ver exemplo
          </button>
        )}
      </div>
      <div className="field">
        <label className="field-label" htmlFor={`timer-notes-${unit.itemNumber}`}>
          Itens pulados / observações
        </label>
        <textarea
          id={`timer-notes-${unit.itemNumber}`}
          className="input"
          rows={2}
          value={state.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </div>
      <p className="field-hint">
        O tempo é armazenado em milissegundos e exibido em segundos. Não é convertido em pontuação.
      </p>
      </div>
    </div>
  );
}

function ReviewView({
  app,
  onBack,
  onFinalize,
  onError,
}: {
  app: Application;
  onBack: () => void;
  onFinalize: (confirmIncomplete: boolean) => void;
  onError: (msg: string) => void;
}) {
  const [confirmIncomplete, setConfirmIncomplete] = useState(false);
  const steps = app.steps ?? [];

  const incomplete = steps.filter((s) => {
    if (s.status === 'COMPLETED') return false;
    if (s.stepNumber === 3) return !s.items.some((i) => i.responseTimeMs != null);
    return s.items.length === 0;
  });

  const total = steps
    .filter((s) => s.stepNumber !== 3)
    .reduce((acc, s) => acc + s.score, 0);

  return (
    <div className="review-view">
      <h2>Revisão da aplicação</h2>
      <div className="panel">
        <dl className="detail-list">
          <div>
            <dt>Criança</dt>
            <dd>{app.child?.name}</dd>
          </div>
          <div>
            <dt>Data de nascimento</dt>
            <dd>{app.child ? formatDate(app.child.birthDate) : '—'}</dd>
          </div>
          <div>
            <dt>Início</dt>
            <dd>{app.startedAt ? new Date(app.startedAt).toLocaleString('pt-BR') : '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="panel">
        <h3>Pontuação por etapa</h3>
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Etapa</th>
              <th scope="col">Status</th>
              <th scope="col">Pontuação</th>
              <th scope="col">Itens respondidos</th>
              <th scope="col">Tempo</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s) => (
              <tr key={s.id}>
                <td>{s.stepNumber} — {SKILL_LABELS[s.skill] ?? s.skill}</td>
                <td>{s.status === 'COMPLETED' ? 'Concluída' : s.status === 'IN_PROGRESS' ? 'Em andamento' : 'Não iniciada'}</td>
                <td>{s.score}{s.maxScore != null ? ` / ${s.maxScore}` : ''}</td>
                <td>{s.items.length}</td>
                <td>{s.stepNumber === 3 ? (s.items[0]?.responseTimeMs != null ? `${(s.items[0].responseTimeMs / 1000).toFixed(1)} s` : '—') : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Pontuação total (sem a etapa cronometrada)</td>
              <td><strong>{total}</strong></td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {incomplete.length > 0 && (
        <Alert variant="error">
          <strong>Etapas incompletas:</strong>
          <ul>
            {incomplete.map((s) => (
              <li key={s.id}>
                Etapa {s.stepNumber} —{' '}
                {s.stepNumber === 3
                  ? 'tempo da nomeação automática rápida não registrado'
                  : s.items.length === 0
                    ? 'nenhuma resposta registrada'
                    : 'etapa não marcada como concluída'}
              </li>
            ))}
          </ul>
          <label className="check-row">
            <input
              type="checkbox"
              checked={confirmIncomplete}
              onChange={(e) => setConfirmIncomplete(e.target.checked)}
            />
            <span>Confirmo que desejo finalizar mesmo com etapas incompletas.</span>
          </label>
        </Alert>
      )}

      <div className="step-nav">
        <button className="btn btn-secondary" type="button" onClick={onBack}>
          <IconArrowLeft /> Voltar para a última etapa
        </button>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => {
            if (incomplete.length > 0 && !confirmIncomplete) {
              onError('Confirme a finalização com etapas incompletas.');
              return;
            }
            onFinalize(incomplete.length > 0 && confirmIncomplete);
          }}
        >
          Finalizar aplicação
        </button>
      </div>
    </div>
  );
}